'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import type { Expense, Income, Budget } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

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
  "check a price in Cambodia",
]

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) buildContext() }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function buildContext() {
    try {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`

      const [{ data: expData }, { data: incData }, { data: budData }] = await Promise.all([
        supabase.from('expenses').select('*').eq('couple', user?.couple ?? 'union').gte('date', startDate).lte('date', endDate),
        supabase.from('income').select('*').eq('couple', user?.couple ?? 'union').gte('date', startDate).lte('date', endDate),
        supabase.from('budgets').select('*').eq('couple', user?.couple ?? 'union').eq('month', month).eq('year', year),
      ])

      const expenses = (expData as Expense[]) || []
      const incomes = (incData as Income[]) || []
      const budgets = (budData as Budget[]) || []

      const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
      const totalExpenses = expenses.filter(e => !e.currency || e.currency === 'USD').reduce((s, e) => s + Number(e.amount), 0)
      const balance = totalIncome - totalExpenses

      const byCategory: Record<string, number> = {}
      expenses.forEach(e => {
        if (!e.currency || e.currency === 'USD') byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
      })
      const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)

      const budgetLines = budgets.map(b => {
        const spent = byCategory[b.category] || 0
        const pct = Math.round((spent / Number(b.monthly_limit)) * 100)
        return `  ${b.category}: $${spent.toFixed(0)} / $${Number(b.monthly_limit).toFixed(0)} (${pct}%)`
      }).join('\n')

      setContext(`${now.toLocaleString('default', { month: 'long' })} ${year} summary:
- Income: ${formatCurrency(totalIncome)}
- Expenses (USD): ${formatCurrency(totalExpenses)}
- Balance: ${balance >= 0 ? '+' : ''}${formatCurrency(balance)}
- Transactions: ${expenses.length}
- Top categories: ${topCategories.map(([cat, amt]) => `${cat} ($${amt.toFixed(0)})`).join(', ')}
${budgetLines ? `- Budgets:\n${budgetLines}` : '- No budgets set'}
- User: ${user?.name} (couple: ${user?.couple})`)
    } catch {
      // context stays empty, API will still work
    }
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
    setMessages(prev => [...prev, userMsg])
    setInput('')
    const imgPayload = pendingImage
    setPendingImage(null)
    setSending(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: messageText, context, image: imgPayload?.base64, mimeType: imgPayload?.mimeType }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply || 'No response.',
        timestamp: new Date(),
      }])
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
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 160px)' }}>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleAttach} />

      {/* ── Empty / welcome state ─────────────────────────── */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center flex-1 px-5 pt-6 pb-4">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: `linear-gradient(135deg, ${user?.color || '#534AB7'}22, ${user?.color || '#534AB7'}44)`, border: `1.5px solid ${user?.color || '#534AB7'}33` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={user?.color || '#534AB7'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/>
              <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0"/>
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
              disabled={(!input.trim() && !pendingImage) || sending}
              sending={sending}
              color={user?.color || '#534AB7'}
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
        <div className="flex-1 px-4 pt-3 space-y-4" style={{ paddingBottom: 8 }}>
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
                      <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/>
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
            disabled={(!input.trim() && !pendingImage) || sending}
            sending={sending}
            color={user?.color || '#534AB7'}
          />
        </div>
      )}

      {/* Spacer when messages exist */}
      {!isEmpty && <div style={{ height: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }} />}
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
  inputRef, value, onChange, onKeyDown, onSend, onAttach, disabled, sending, color,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onAttach: () => void
  disabled: boolean
  sending: boolean
  color: string
}) {
  return (
    <div className="flex items-end gap-2 px-3 py-2.5 rounded-2xl"
      style={{
        backgroundColor: 'rgba(255,255,255,0.96)',
        border: '1px solid rgba(0,0,0,0.09)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.09)',
        backdropFilter: 'blur(14px)',
      }}>
      {/* Attach */}
      <button onClick={onAttach}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.38)' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>

      {/* Textarea */}
      <textarea
        ref={inputRef} value={value} onChange={onChange} onKeyDown={onKeyDown}
        placeholder="ask anything…"
        rows={1}
        className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
        style={{ color: '#1A1A1A', maxHeight: 128, overflowY: 'auto' }} />

      {/* Send */}
      <motion.button whileTap={{ scale: 0.88 }} onClick={onSend} disabled={disabled}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-25 transition-opacity"
        style={{ backgroundColor: color }}>
        {sending ? (
          <motion.svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"
            animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </motion.svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        )}
      </motion.button>
    </div>
  )
}
