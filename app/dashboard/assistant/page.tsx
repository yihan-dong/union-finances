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
  imagePreview?: string // data URL for preview
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
  "any tips for us?",
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0,1,2].map(i => (
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
      ))}
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

  useEffect(() => {
    if (user) buildContext()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function buildContext() {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate = `${year}-${String(month).padStart(2,'0')}-31`

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
      if (!e.currency || e.currency === 'USD') {
        byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
      }
    })
    const topCategories = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0, 5)

    const budgetLines = budgets.map(b => {
      const spent = byCategory[b.category] || 0
      const pct = Math.round((spent / Number(b.monthly_limit)) * 100)
      return `  ${b.category}: $${spent.toFixed(0)} / $${Number(b.monthly_limit).toFixed(0)} (${pct}%)`
    }).join('\n')

    const ctx = `Monthly summary (${now.toLocaleString('default', { month: 'long' })} ${year}):
- Total income: ${formatCurrency(totalIncome)}
- Total expenses (USD): ${formatCurrency(totalExpenses)}
- Balance: ${balance >= 0 ? '+' : ''}${formatCurrency(balance)}
- Number of transactions: ${expenses.length}
- Top spending categories: ${topCategories.map(([cat, amt]) => `${cat} ($${amt.toFixed(0)})`).join(', ')}
${budgetLines ? `- Budgets:\n${budgetLines}` : '- No budgets set yet'}
- User logged in: ${user?.name} (couple: ${user?.couple})`

    setContext(ctx)
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        bytes.forEach(b => binary += String.fromCharCode(b))
        const base64 = btoa(binary)
        setPendingImage({ base64, mimeType: 'application/pdf', preview: '' })
      } else {
        const { base64, mimeType } = await compressImage(file)
        const preview = `data:image/jpeg;base64,${base64}`
        setPendingImage({ base64, mimeType, preview })
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
      text: messageText || (pendingImage?.mimeType === 'application/pdf' ? '(attached document)' : '(attached image)'),
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
        body: JSON.stringify({
          message: messageText,
          context,
          image: imgPayload?.base64,
          mimeType: imgPayload?.mimeType,
        }),
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
        text: "Something went wrong. Try again.",
        timestamp: new Date(),
      }])
    } finally {
      setSending(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="px-5 pt-2" style={{ paddingBottom: '172px' }}>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleAttach} />

      {/* Empty state — welcome */}
      {isEmpty && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-8 pb-6">
          <div className="rounded-3xl p-5 mb-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p className="text-base font-medium mb-1" style={{ color: '#1A1A1A' }}>hi {user?.name?.toLowerCase()} 👋</p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
              ask me anything about your finances — spending patterns, savings advice, or snap a photo to check prices in Cambodia.
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-widest mb-2 px-1" style={{ color: 'rgba(0,0,0,0.3)' }}>quick questions</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_CHIPS.map(chip => (
              <motion.button key={chip} whileTap={{ scale: 0.95 }}
                onClick={() => sendMessage(chip)}
                className="px-3 py-2 rounded-full text-xs font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.85)', color: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                {chip}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Message list */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[78%]">
                  {msg.imagePreview && (
                    <div className="mb-1 flex justify-end">
                      <img src={msg.imagePreview} alt="attached" className="rounded-2xl max-h-36 object-cover" />
                    </div>
                  )}
                  {msg.text && (
                    <div className="px-4 py-3 rounded-3xl rounded-tr-md text-sm text-white"
                      style={{ backgroundColor: user?.color || '#534AB7' }}>
                      {msg.text}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-[84%] px-4 py-3 rounded-3xl rounded-tl-md text-sm leading-relaxed"
                  style={{ backgroundColor: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.8)' }}>
                  {msg.text}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="rounded-3xl rounded-tl-md"
              style={{ backgroundColor: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <TypingIndicator />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar — fixed above nav */}
      <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-4" style={{ bottom: 108, zIndex: 40 }}>
        {/* Pending image preview */}
        <AnimatePresence>
          {pendingImage?.preview && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="mb-2 flex items-center gap-2 px-3 py-2 rounded-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)' }}>
              <img src={pendingImage.preview} alt="preview" className="w-10 h-10 rounded-xl object-cover" />
              <p className="flex-1 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>image attached</p>
              <button onClick={() => setPendingImage(null)} style={{ color: 'rgba(0,0,0,0.3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </motion.div>
          )}
          {pendingImage && !pendingImage.preview && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-2 flex items-center gap-2 px-3 py-2 rounded-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(83,74,183,0.1)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.75" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p className="flex-1 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>PDF attached</p>
              <button onClick={() => setPendingImage(null)} style={{ color: 'rgba(0,0,0,0.3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 px-3 py-2.5 rounded-2xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backdropFilter: 'blur(12px)' }}>
          {/* Attach button */}
          <button onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.4)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          {/* Text input */}
          <textarea ref={inputRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="ask anything…"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
            style={{ color: '#1A1A1A', maxHeight: 120, overflowY: 'auto' }} />

          {/* Send button */}
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !pendingImage) || sending}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30"
            style={{ backgroundColor: user?.color || '#534AB7' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
