'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import type { Expense, Income, Budget, Goal } from '@/lib/types'
import { formatCurrency, toUSD } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  imagePreview?: string
  timestamp: Date
}

async function compressImage(file: File): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 900
      const scale = img.width > MAX ? MAX / img.width : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('failed')) }
    img.src = url
  })
}

const QUICK_CHIPS = [
  "how's our spending this month?",
  "where are we overspending?",
  "how much should we save?",
  "any savings tips for us?",
]

interface PriceResult {
  product: string; priceRange: string; verdict: 'good deal' | 'fair price' | 'overpriced' | 'unknown'
  advice: string; sources: string[]
}

const VERDICT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  'good deal':  { bg: 'rgba(29,158,117,0.12)', color: '#1D9E75',  label: 'Good deal' },
  'fair price': { bg: 'rgba(245,158,11,0.12)', color: '#D97706',  label: 'Fair price' },
  'overpriced': { bg: 'rgba(239,68,68,0.10)',  color: '#EF4444',  label: 'Overpriced' },
  'unknown':    { bg: 'rgba(0,0,0,0.06)',       color: 'rgba(0,0,0,0.45)', label: 'Unknown' },
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <motion.span key={i}
          className="block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.14 }} />
      ))}
    </div>
  )
}

// Very basic markdown: bold, lists, line breaks
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />
        // bullet list
        const isBullet = /^[-•*]\s/.test(line.trim())
        const content = line.replace(/^[-•*]\s/, '')
        // bold: **text**
        const parts = content.split(/(\*\*[^*]+\*\*)/)
        const rendered = parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} style={{ color: '#1A1A1A' }}>{p.slice(2, -2)}</strong>
            : p
        )
        if (isBullet) {
          return (
            <div key={i} className="flex gap-2">
              <span className="flex-shrink-0 mt-0.5 text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>•</span>
              <span>{rendered}</span>
            </div>
          )
        }
        return <p key={i}>{rendered}</p>
      })}
    </div>
  )
}

export default function AssistantPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)
  const [context, setContext] = useState('')
  const [priceChecking, setPriceChecking] = useState(false)
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null)
  const [showPriceResult, setShowPriceResult] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) buildContext() }, [user])

  useEffect(() => {
    if (messages.length === 0 && !sending) return
    const t = setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 40)
    return () => clearTimeout(t)
  }, [messages, sending])

  async function buildContext() {
    try {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate   = `${year}-${String(month).padStart(2, '0')}-31`
      const cv = user?.couple ?? 'union'

      // Try with couple filter; if error/empty, fall back to all rows (handles missing column)
      const expR  = await supabase.from('expenses').select('*').eq('couple', cv).gte('date', startDate).lte('date', endDate)
      const incR  = await supabase.from('income').select('*').eq('couple', cv).gte('date', startDate).lte('date', endDate)
      const budR  = await supabase.from('budgets').select('*').eq('couple', cv).eq('month', month).eq('year', year)
      const goalR = await supabase.from('goals').select('*').eq('couple', cv)
      const memR  = await supabase.from('assistant_memory').select('*').eq('couple', cv).eq('app', 'finances').order('created_at', { ascending: false }).limit(30)

      const expFB = (expR.error || !expR.data?.length) ? await supabase.from('expenses').select('*').gte('date', startDate).lte('date', endDate) : expR
      const incFB = (incR.error || !incR.data?.length) ? await supabase.from('income').select('*').gte('date', startDate).lte('date', endDate) : incR
      const budFB = (budR.error || !budR.data?.length) ? await supabase.from('budgets').select('*').eq('month', month).eq('year', year) : budR

      const expenses = (expFB.data as Expense[]) || []
      const incomes  = (incFB.data as Income[])  || []
      const budgets  = (budFB.data as Budget[])  || []
      const goals    = (goalR.data as Goal[])     || []
      const memories = (memR.data as { fact: string }[]) || []

      const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
      const totalExpenses = expenses.reduce((s, e) => s + toUSD(Number(e.amount), e.currency || 'USD'), 0)
      const balance = totalIncome - totalExpenses

      const byCategory: Record<string, number> = {}
      expenses.forEach(e => {
        byCategory[e.category] = (byCategory[e.category] || 0) + toUSD(Number(e.amount), e.currency || 'USD')
      })
      const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)

      const budgetLines = budgets.map(b => {
        const spent = byCategory[b.category] || 0
        const pct = Math.round((spent / Number(b.monthly_limit)) * 100)
        return `  ${b.category}: $${spent.toFixed(0)} / $${Number(b.monthly_limit).toFixed(0)} (${pct}%)`
      }).join('\n')

      const goalLines = goals.map(g => {
        const pct = Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)
        const deadline = g.deadline ? ` | due ${g.deadline}` : ''
        return `  ${g.name}: $${Number(g.current_amount).toFixed(0)} / $${Number(g.target_amount).toFixed(0)} (${pct}%)${deadline}`
      }).join('\n')

      const allTx = expenses.map(e => {
        const usdAmt = toUSD(Number(e.amount), e.currency || 'USD')
        const note = e.currency === 'KHR' ? ` (${formatCurrency(Number(e.amount), 'KHR')} → $${usdAmt.toFixed(2)})` : ''
        return `  ${e.date} | ${e.description} | ${formatCurrency(Number(e.amount), e.currency || 'USD')}${note} | ${e.category} | paid by ${e.paid_by}`
      }).join('\n')

      const memoryLines = memories.map(m => `• ${m.fact}`).join('\n')

      setContext(`${now.toLocaleString('default', { month: 'long' })} ${year} summary for ${user?.name} (${user?.couple}):
- Income: ${formatCurrency(totalIncome)}
- Total expenses: ${formatCurrency(totalExpenses)} across ${expenses.length} transactions (KHR converted at 4,000/USD)
- Balance: ${balance >= 0 ? '+' : ''}${formatCurrency(balance)}
- Top categories: ${topCategories.map(([cat, amt]) => `${cat} ($${amt.toFixed(0)})`).join(', ')}
${budgetLines ? `- Budgets:\n${budgetLines}` : '- No budgets set yet'}
${goalLines ? `- Savings goals:\n${goalLines}` : '- No goals set yet'}
- All transactions this month:\n${allTx || '  (none)'}
${memoryLines ? `\n=== MEMORY FROM PAST CONVERSATIONS ===\n${memoryLines}` : ''}`)
    } catch {
      // context stays empty, API will still work
    }
  }

  async function maybeSaveMemory(msgs: Message[]) {
    const userMsgs = msgs.filter(m => m.role === 'user')
    if (userMsgs.length === 0 || userMsgs.length % 4 !== 0) return

    const cv = user?.couple ?? 'union'
    const lastSix = msgs.slice(-6)
    const extractPrompt = `Based on this conversation excerpt about finances, extract 1-2 key facts worth remembering about Yihan and Sun's financial habits, preferences, or goals. Reply ONLY with a JSON array of strings. If nothing is worth saving, reply with [].

Conversation:
${lastSix.map(m => `${m.role}: ${m.text}`).join('\n')}`

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: extractPrompt, context: '', history: [] }),
      })
      const data = await res.json()
      const raw = data.reply || ''
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) return
      const facts: string[] = JSON.parse(match[0])
      if (!Array.isArray(facts) || facts.length === 0) return
      for (const fact of facts) {
        if (typeof fact === 'string' && fact.trim()) {
          await supabase.from('assistant_memory').insert({ couple: cv, app: 'finances', fact: fact.trim() })
        }
      }
    } catch {
      // background — silent failure
    }
  }

  async function handlePriceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setPriceChecking(true)
    try {
      const { base64, mimeType } = await compressImage(file)
      const res  = await fetch('/api/price-check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: base64, mimeType }) })
      const data = await res.json()
      if (data.product) { setPriceResult(data as PriceResult); setShowPriceResult(true) }
    } catch { /* silent */ }
    finally { setPriceChecking(false) }
    e.target.value = ''
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        bytes.forEach(b => binary += String.fromCharCode(b))
        setPendingImage({ base64: btoa(binary), mimeType: 'application/pdf', preview: '' })
      } else {
        const { base64, mimeType } = await compressImage(file)
        setPendingImage({ base64, mimeType, preview: `data:image/jpeg;base64,${base64}` })
      }
    } catch {}
    e.target.value = ''
  }

  async function sendMessage(text?: string) {
    const messageText = (text ?? input).trim()
    if ((!messageText && !pendingImage) || sending) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: messageText || (pendingImage?.mimeType === 'application/pdf' ? '(attached PDF)' : '(attached image)'),
      imagePreview: pendingImage?.preview || undefined,
      timestamp: new Date(),
    }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    const imgPayload = pendingImage
    setPendingImage(null)
    setSending(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          context,
          history: updatedMessages.slice(-20).map(m => ({ role: m.role, text: m.text })),
          image: imgPayload?.base64,
          mimeType: imgPayload?.mimeType,
        }),
      })
      const data = await res.json()
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply || 'No response.',
        timestamp: new Date(),
      }
      const finalMessages = [...updatedMessages, assistantMsg]
      setMessages(finalMessages)
      // Background memory extraction — don't await
      maybeSaveMemory(finalMessages)
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Something went wrong. Try again.',
        timestamp: new Date(),
      }])
    } finally {
      setSending(false)
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  const isEmpty = messages.length === 0

  return (
    <div>
      <input ref={fileRef}  type="file" accept="image/*,application/pdf" className="hidden" onChange={handleAttach} />
      <input ref={priceRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePriceFile} />

      {/* ── Empty / welcome state ─────────────────────────── */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-5 pt-6 pb-4"
          style={{ minHeight: 'calc(100vh - 200px)' }}>
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: `linear-gradient(135deg, ${user?.color || '#534AB7'}22, ${user?.color || '#534AB7'}44)`, border: `1.5px solid ${user?.color || '#534AB7'}33` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={user?.color || '#534AB7'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {/* Peanut butter jar */}
              <rect x="3.5" y="3" width="17" height="3" rx="1.5"/>
              <path d="M5.5 6h13v14a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 20V6z"/>
              <rect x="7" y="9" width="10" height="7" rx="1.5"/>
              <path d="M8.5 12.5Q10.5 11 12.5 12.5Q14.5 14 16.5 12.5"/>
            </svg>
          </div>

          <h2 className="text-2xl text-center mb-1.5" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
            what can I help with?
          </h2>
          <p className="text-sm text-center mb-8" style={{ color: 'rgba(0,0,0,0.38)', maxWidth: 260 }}>
            ask about your finances, search prices in Cambodia, or attach a photo.
          </p>

          {/* Centered input box on empty state */}
          <div className="w-full mb-6">
            <PendingImagePreview pendingImage={pendingImage} onClear={() => setPendingImage(null)} />
            <InputBox
              inputRef={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e.target) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              onSend={() => sendMessage()}
              onAttach={() => fileRef.current?.click()}
              onPriceCheck={() => priceRef.current?.click()}
              priceChecking={priceChecking}
              disabled={(!input.trim() && !pendingImage) || sending}
              sending={sending}
              color={user?.color || '#534AB7'}
              big
            />
          </div>

          {/* Quick chips */}
          <div className="w-full">
            <p className="text-[10px] uppercase tracking-widest mb-3 text-center" style={{ color: 'rgba(0,0,0,0.28)' }}>
              suggestions
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_CHIPS.map(chip => (
                <motion.button key={chip} whileTap={{ scale: 0.96 }}
                  onClick={() => sendMessage(chip)}
                  className="px-3 py-2.5 rounded-2xl text-left text-xs leading-snug"
                  style={{ backgroundColor: 'rgba(255,255,255,0.82)', color: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  {chip}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Conversation ─────────────────────────────────── */
        <div className="px-4 pt-3 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar */}
                {msg.role === 'assistant' ? (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center self-end mb-0.5"
                    style={{ background: `linear-gradient(135deg, ${user?.color || '#534AB7'}33, ${user?.color || '#534AB7'}55)` }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={user?.color || '#534AB7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3.5" y="3" width="17" height="3" rx="1.5"/>
                      <path d="M5.5 6h13v14a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 20V6z"/>
                      <rect x="7" y="9" width="10" height="7" rx="1.5"/>
                      <path d="M8.5 12.5Q10.5 11 12.5 12.5Q14.5 14 16.5 12.5"/>
                    </svg>
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center self-end mb-0.5 text-white text-[9px] font-semibold overflow-hidden"
                    style={{ backgroundColor: user?.color || '#534AB7' }}>
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : user?.initials}
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[76%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {msg.imagePreview && (
                    <img src={msg.imagePreview} alt="attached" className="rounded-2xl max-h-40 object-cover" />
                  )}
                  {msg.text && (
                    msg.role === 'user' ? (
                      <div className="px-4 py-2.5 rounded-3xl rounded-br-md text-sm text-white leading-relaxed"
                        style={{ backgroundColor: user?.color || '#534AB7' }}>
                        {msg.text}
                      </div>
                    ) : (
                      <div className="px-4 py-3 rounded-3xl rounded-bl-md text-sm leading-relaxed"
                        style={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.65)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.78)' }}>
                        <FormattedText text={msg.text} />
                      </div>
                    )
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {sending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${user?.color || '#534AB7'}33, ${user?.color || '#534AB7'}55)` }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={user?.color || '#534AB7'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/>
                </svg>
              </div>
              <div className="px-4 py-3 rounded-3xl rounded-bl-md"
                style={{ backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.65)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <TypingDots />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Fixed input bar (when there are messages) ──────── */}
      {!isEmpty && (
        <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-4"
          style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))', zIndex: 40 }}>
          <PendingImagePreview pendingImage={pendingImage} onClear={() => setPendingImage(null)} />
          <InputBox
            inputRef={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(e.target) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            onSend={() => sendMessage()}
            onAttach={() => fileRef.current?.click()}
            onPriceCheck={() => priceRef.current?.click()}
            priceChecking={priceChecking}
            disabled={(!input.trim() && !pendingImage) || sending}
            sending={sending}
            color={user?.color || '#534AB7'}
          />
        </div>
      )}

      {/* Spacer: clears fixed input bar (6.5rem) + input height (~64px) + breathing room */}
      {!isEmpty && <div style={{ height: 'calc(10rem + env(safe-area-inset-bottom, 0px))' }} />}

      {/* ── Price Check Result Sheet ──────────────────────── */}
      <AnimatePresence>
        {showPriceResult && priceResult && (
          <motion.div className="fixed inset-0 z-[200] flex items-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', touchAction: 'none' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowPriceResult(false)}>
            <motion.div className="bg-white rounded-t-3xl w-full max-w-md mx-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }} />
              </div>
              <div className="px-6 pt-3 pb-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 pr-3">
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.3)' }}>product identified</p>
                    <h3 className="text-lg font-semibold leading-tight" style={{ color: '#1A1A1A' }}>{priceResult.product}</h3>
                  </div>
                  <button onClick={() => setShowPriceResult(false)} style={{ color: 'rgba(0,0,0,0.32)', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 px-4 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.3)' }}>price in cambodia</p>
                    <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>{priceResult.priceRange || '—'}</p>
                  </div>
                  {(() => {
                    const vs = VERDICT_STYLE[priceResult.verdict] || VERDICT_STYLE.unknown
                    return (
                      <div className="px-4 py-3 rounded-2xl text-center flex-shrink-0" style={{ backgroundColor: vs.bg }}>
                        <p className="text-sm font-semibold" style={{ color: vs.color }}>{vs.label}</p>
                      </div>
                    )
                  })()}
                </div>
                <div className="px-4 py-3 rounded-2xl mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'rgba(0,0,0,0.3)' }}>advice</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(0,0,0,0.7)' }}>{priceResult.advice}</p>
                </div>
                {priceResult.sources?.length > 0 && (
                  <p className="text-[9px] px-1" style={{ color: 'rgba(0,0,0,0.3)' }}>
                    sources: {priceResult.sources.join(' · ')}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────

function PendingImagePreview({
  pendingImage,
  onClear,
}: {
  pendingImage: { base64: string; mimeType: string; preview: string } | null
  onClear: () => void
}) {
  if (!pendingImage) return null
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="mb-2 flex items-center gap-2 px-3 py-2 rounded-2xl"
        style={{ backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)' }}>
        {pendingImage.preview ? (
          <img src={pendingImage.preview} alt="preview" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(83,74,183,0.1)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.75" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
        )}
        <p className="flex-1 text-xs" style={{ color: 'rgba(0,0,0,0.45)' }}>
          {pendingImage.preview ? 'image attached' : 'PDF attached'}
        </p>
        <button onClick={onClear} style={{ color: 'rgba(0,0,0,0.3)', padding: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </motion.div>
    </AnimatePresence>
  )
}

function InputBox({
  inputRef, value, onChange, onKeyDown, onSend, onAttach, onPriceCheck, priceChecking = false,
  disabled, sending, color, big = false,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onAttach: () => void
  onPriceCheck?: () => void
  priceChecking?: boolean
  disabled: boolean
  sending: boolean
  color: string
  big?: boolean
}) {
  return (
    <div className="rounded-3xl px-3 pt-3 pb-2.5"
      style={{
        backgroundColor: 'rgba(255,255,255,0.96)',
        border: '1px solid rgba(0,0,0,0.09)',
        boxShadow: big ? '0 8px 32px rgba(0,0,0,0.1)' : '0 4px 24px rgba(0,0,0,0.09)',
        backdropFilter: 'blur(14px)',
      }}>
      {/* Textarea on top — full width */}
      <textarea
        ref={inputRef} value={value} onChange={onChange} onKeyDown={onKeyDown}
        placeholder="ask anything…"
        rows={big ? 3 : 1}
        className="w-full bg-transparent outline-none resize-none text-sm leading-relaxed px-1.5"
        style={{ color: '#1A1A1A', minHeight: big ? 66 : 24, maxHeight: 140, overflowY: 'auto' }} />

      {/* Bottom row: attach · price check (left) · send (right) */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1.5">
          {/* Attach */}
          <button onClick={onAttach}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.4)' }}
            title="attach image or PDF">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          {/* Price check */}
          {onPriceCheck && (
            <button onClick={onPriceCheck} disabled={priceChecking}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: priceChecking ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.4)' }}
              title="price check in Cambodia">
              {priceChecking ? (
                <motion.svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </motion.svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              )}
            </button>
          )}
        </div>

        <motion.button whileTap={{ scale: 0.88 }} onClick={onSend} disabled={disabled}
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-25 transition-opacity"
          style={{ backgroundColor: color }}>
          {sending ? (
            <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </motion.svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          )}
        </motion.button>
      </div>
    </div>
  )
}
