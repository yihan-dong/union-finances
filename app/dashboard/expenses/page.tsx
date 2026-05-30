'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ShineBorder } from '@/components/ui/shine-border'
import type { Expense, ExpenseCategory, BucketType, UserIdentity, CurrencyType } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

const CATEGORIES: ExpenseCategory[] = [
  'food & dining','rent & utilities','transport','shopping','health','entertainment','travel','subscriptions','other'
]

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'food & dining':   '#F59E0B',
  'rent & utilities':'#6366F1',
  'transport':       '#10B981',
  'shopping':        '#EC4899',
  'health':          '#14B8A6',
  'entertainment':   '#8B5CF6',
  'travel':          '#3B82F6',
  'subscriptions':   '#F97316',
  'other':           '#94A3B8',
}

const USER_COLORS: Record<string, string> = {
  yihan: '#534AB7',
  sun: '#1D9E75',
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.25 } }),
}

interface AddExpenseForm {
  amount: string
  description: string
  category: ExpenseCategory
  date: string
  paid_by: UserIdentity
  bucket: BucketType
  currency: CurrencyType
  note: string
}

const defaultForm = (user: UserIdentity): AddExpenseForm => ({
  amount: '',
  description: '',
  category: 'food & dining',
  date: new Date().toISOString().slice(0, 10),
  paid_by: user,
  bucket: 'utility',
  currency: 'USD',
  note: '',
})

interface ImportTx {
  id: string
  date: string
  description: string
  amount: number
  currency: CurrencyType
  type: 'debit' | 'credit'
  category: ExpenseCategory
  bucket: BucketType
}

function groupByDate(expenses: Expense[]): { date: string; items: Expense[] }[] {
  const map = new Map<string, Expense[]>()
  for (const e of expenses) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date)!.push(e)
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
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
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('failed')) }
    img.src = url
  })
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState<ExpenseCategory | 'all'>('all')
  const [filterBucket, setFilterBucket] = useState<BucketType | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AddExpenseForm>(defaultForm(user?.identity || 'yihan'))
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [showImport, setShowImport] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importItems, setImportItems] = useState<ImportTx[]>([])
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set())
  const [importSaving, setImportSaving] = useState(false)
  const pdfRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  async function fetchExpenses() {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate = `${year}-${String(month).padStart(2,'0')}-31`
    const { data } = await supabase.from('expenses').select('*')
      .gte('date', startDate).lte('date', endDate)
      .order('date', { ascending: false })
    setExpenses((data as Expense[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchExpenses() }, [])

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const { base64, mimeType } = await compressImage(file)
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      })
      const data = await res.json()
      const scanned: Partial<AddExpenseForm> = {}
      if (data.amount) scanned.amount = String(data.amount)
      if (data.description) scanned.description = data.description
      if (data.category && CATEGORIES.includes(data.category)) scanned.category = data.category
      if (data.date) scanned.date = data.date
      if (data.bucket === 'status' || data.bucket === 'utility') scanned.bucket = data.bucket
      if (data.currency === 'KHR') scanned.currency = 'KHR'
      setForm(f => ({ ...f, ...scanned }))
      setShowForm(true)
    } catch {
      // silent fail
    } finally {
      setScanning(false)
    }
    e.target.value = ''
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1]
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pdf: base64 }),
          })
          const data = await res.json()
          const items: ImportTx[] = (data.transactions || []).map((t: Omit<ImportTx, 'id'>) => ({
            ...t, id: crypto.randomUUID(),
          }))
          setImportItems(items)
          setImportSelected(new Set(items.filter(t => t.type === 'debit').map(t => t.id)))
          setShowImport(true)
        } catch { /* silent */ }
        setImportLoading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setImportLoading(false)
    }
    e.target.value = ''
  }

  async function confirmImport() {
    if (importSaving) return
    setImportSaving(true)
    const selected = importItems.filter(t => importSelected.has(t.id))
    const debits = selected.filter(t => t.type === 'debit')
    const credits = selected.filter(t => t.type === 'credit')
    if (debits.length > 0) {
      await supabase.from('expenses').insert(debits.map(t => ({
        amount: t.amount, description: t.description, category: t.category,
        date: t.date, paid_by: user?.identity || 'yihan',
        bucket: t.bucket, currency: t.currency, note: null,
      })))
    }
    if (credits.length > 0) {
      await supabase.from('income').insert(credits.map(t => ({
        amount: t.amount, source: t.description, type: 'other',
        date: t.date, owner: user?.identity || 'yihan', recurring: false,
      })))
    }
    await fetchExpenses()
    setShowImport(false)
    setImportItems([])
    setImportSelected(new Set())
    setImportSaving(false)
  }

  async function handleAdd() {
    if (!form.amount || !form.description || saving) return
    setSaving(true)
    await supabase.from('expenses').insert({
      amount: parseFloat(form.amount),
      description: form.description.trim(),
      category: form.category,
      date: form.date,
      paid_by: form.paid_by,
      bucket: form.bucket,
      currency: form.currency,
      note: form.note.trim() || null,
    })
    await fetchExpenses()
    setForm(defaultForm(user?.identity || 'yihan'))
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const filtered = expenses.filter(e => {
    if (filterCat !== 'all' && e.category !== filterCat) return false
    if (filterBucket !== 'all') {
      const bucket = e.bucket || 'utility'
      if (bucket !== filterBucket) return false
    }
    return true
  })
  const grouped = groupByDate(filtered)

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <motion.div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
          animate={{ scale: [1,1.5,1], opacity: [0.3,1,0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
      </div>
    )
  }

  return (
    <div className="px-5 pt-2 pb-4">
      {/* Header */}
      <div className="flex items-center justify-end mb-4 px-1">
        <div className="flex items-center gap-2">
          {/* Scan receipt */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanFile} />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: scanning ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.45)' }}
            title="Scan receipt"
          >
            {scanning ? (
              <motion.svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </motion.svg>
            ) : (
              <CameraIcon />
            )}
          </motion.button>
          {/* Import PDF */}
          <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={handleImportFile} />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => pdfRef.current?.click()}
            disabled={importLoading}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: importLoading ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.45)' }}
            title="Import bank statement"
          >
            {importLoading ? (
              <motion.svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </motion.svg>
            ) : (
              <DocumentIcon />
            )}
          </motion.button>
          {/* Add manually */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => { setShowForm(true); setForm(defaultForm(user?.identity || 'yihan')) }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-lg font-light"
            style={{ backgroundColor: user?.color || '#534AB7' }}
          >
            +
          </motion.button>
        </div>
      </div>

      {/* Bucket filter */}
      <div className="flex gap-2 mb-3">
        {(['all', 'utility', 'status'] as const).map(b => (
          <motion.button
            key={b}
            whileTap={{ scale: 0.94 }}
            onClick={() => setFilterBucket(b)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={filterBucket === b
              ? { backgroundColor: '#1A1A1A', color: '#fff' }
              : { backgroundColor: '#FFFFFF', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.08)' }
            }
          >
            {b === 'all' ? 'all' : b === 'utility' ? '🏠 for us' : '✨ status'}
          </motion.button>
        ))}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
        {(['all', ...CATEGORIES] as const).map(cat => (
          <motion.button
            key={cat}
            whileTap={{ scale: 0.94 }}
            onClick={() => setFilterCat(cat)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={filterCat === cat
              ? { backgroundColor: user?.color || '#534AB7', color: '#fff' }
              : { backgroundColor: '#FFFFFF', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.08)' }
            }
          >
            {cat}
          </motion.button>
        ))}
      </div>

      {/* Expense list */}
      {grouped.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-16">
          <p className="text-sm" style={{ color: 'rgba(0,0,0,0.3)' }}>no expenses yet</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ date, items }, gi) => (
            <motion.div key={date} custom={gi} variants={fadeUp} initial="hidden" animate="visible">
              <p className="text-[10px] uppercase tracking-widest mb-2 px-1" style={{ color: 'rgba(0,0,0,0.3)' }}>
                {formatDate(date)}
              </p>
              <div className="space-y-2">
                {items.map(exp => (
                  <div
                    key={exp.id}
                    className="relative rounded-2xl p-4 overflow-hidden"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <ShineBorder shineColor={USER_COLORS[exp.paid_by]} duration={18} />
                    <div className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#94A3B8' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{exp.description}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.4)' }}>
                            {exp.category}
                          </span>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: (exp.bucket === 'status') ? 'rgba(245,158,11,0.1)' : 'rgba(29,158,117,0.1)',
                              color: (exp.bucket === 'status') ? '#D97706' : '#1D9E75',
                            }}
                          >
                            {(exp.bucket === 'status') ? '✨ status' : '🏠 for us'}
                          </span>
                        </div>
                        {exp.note && (
                          <p className="text-[10px] mt-1" style={{ color: 'rgba(0,0,0,0.35)' }}>{exp.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-base font-semibold" style={{ color: '#EF4444' }}>
                          −{formatCurrency(Number(exp.amount), exp.currency || 'USD')}
                        </p>
                        <button onClick={() => handleDelete(exp.id)} className="p-1 rounded-full" style={{ color: 'rgba(0,0,0,0.22)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Expense Sheet */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              className="bg-white rounded-t-3xl p-6 w-full max-w-md max-h-[82vh] overflow-y-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl" style={{ fontFamily: 'var(--font-serif)' }}>add expense</h3>
                <button onClick={() => setShowForm(false)} style={{ color: 'rgba(0,0,0,0.32)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Amount */}
              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>amount</label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
                <span style={{ color: 'rgba(0,0,0,0.35)' }}>$</span>
                <input
                  type="number" inputMode="decimal"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="flex-1 text-2xl font-semibold bg-transparent outline-none"
                  style={{ color: '#1A1A1A' }}
                  autoFocus
                />
              </div>

              {/* Description */}
              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>description</label>
              <input
                type="text" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="what was this for?"
                className="w-full px-4 py-3 rounded-2xl mb-4 outline-none text-sm"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }}
              />

              {/* Bucket — key question */}
              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>was this for…</label>
              <div className="flex gap-2 mb-4">
                {([['utility', '🏠 for us', 'things that genuinely add to your life'], ['status', '✨ status', 'impressing others']] as [BucketType, string, string][]).map(([val, label, sub]) => (
                  <button
                    key={val}
                    onClick={() => setForm(f => ({ ...f, bucket: val }))}
                    className="flex-1 py-3 px-3 rounded-2xl text-left transition-all"
                    style={form.bucket === val
                      ? { backgroundColor: val === 'utility' ? 'rgba(29,158,117,0.12)' : 'rgba(245,158,11,0.12)', border: `1.5px solid ${val === 'utility' ? '#1D9E75' : '#D97706'}` }
                      : { backgroundColor: 'rgba(0,0,0,0.03)', border: '1.5px solid transparent' }
                    }
                  >
                    <p className="text-sm font-medium" style={{ color: form.bucket === val ? (val === 'utility' ? '#1D9E75' : '#D97706') : 'rgba(0,0,0,0.5)' }}>{label}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>{sub}</p>
                  </button>
                ))}
              </div>

              {/* Category */}
              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>category</label>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className="px-3 py-1.5 rounded-full text-xs transition-all"
                    style={form.category === cat
                      ? { backgroundColor: CATEGORY_COLORS[cat], color: '#fff' }
                      : { backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.5)' }
                    }
                  >{cat}</button>
                ))}
              </div>

              {/* Date */}
              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>date</label>
              <input
                type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl mb-4 outline-none text-sm"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }}
              />

              {/* Paid by */}
              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>paid from</label>
              <div className="flex gap-2 mb-4">
                {(['yihan', 'sun'] as UserIdentity[]).map(id => (
                  <button
                    key={id}
                    onClick={() => setForm(f => ({ ...f, paid_by: id }))}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
                    style={form.paid_by === id
                      ? { backgroundColor: USER_COLORS[id], color: '#fff' }
                      : { backgroundColor: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.07)' }
                    }
                  >
                    {id === 'yihan' ? 'Yihan' : 'Sun'}
                  </button>
                ))}
              </div>

              {/* Currency */}
              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>currency</label>
              <div className="flex gap-2 mb-4">
                {(['USD', 'KHR'] as CurrencyType[]).map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, currency: c }))}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
                    style={form.currency === c
                      ? { backgroundColor: '#1A1A1A', color: '#fff' }
                      : { backgroundColor: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.07)' }
                    }
                  >
                    {c === 'USD' ? '$ USD' : '₭ KHR'}
                  </button>
                ))}
              </div>

              {/* Note */}
              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>note (optional)</label>
              <input
                type="text" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="any extra details"
                className="w-full px-4 py-3 rounded-2xl mb-6 outline-none text-sm"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }}
              />

              <button
                onClick={handleAdd}
                disabled={!form.amount || !form.description || saving}
                className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: user?.color || '#534AB7' }}
              >
                {saving ? 'saving…' : 'add expense'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Review Sheet */}
      <AnimatePresence>
        {showImport && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-t-3xl w-full max-w-md max-h-[88vh] flex flex-col"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
                <div>
                  <h3 className="text-xl" style={{ fontFamily: 'var(--font-serif)' }}>review import</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    {importItems.filter(t => importSelected.has(t.id)).length} of {importItems.length} selected
                  </p>
                </div>
                <button onClick={() => setShowImport(false)} style={{ color: 'rgba(0,0,0,0.32)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Transaction list */}
              <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-2">
                {importItems.map(tx => {
                  const selected = importSelected.has(tx.id)
                  return (
                    <button
                      key={tx.id}
                      onClick={() => setImportSelected(prev => {
                        const next = new Set(prev)
                        if (next.has(tx.id)) next.delete(tx.id)
                        else next.add(tx.id)
                        return next
                      })}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all"
                      style={{
                        backgroundColor: selected ? 'rgba(0,0,0,0.03)' : 'transparent',
                        border: `1px solid ${selected ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)'}`,
                        opacity: selected ? 1 : 0.45,
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: selected ? (user?.color || '#534AB7') : 'rgba(0,0,0,0.08)' }}
                      >
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{tx.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px]" style={{ color: 'rgba(0,0,0,0.35)' }}>{tx.date}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.4)' }}>{tx.category}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                            backgroundColor: tx.type === 'credit' ? 'rgba(29,158,117,0.1)' : 'rgba(239,68,68,0.08)',
                            color: tx.type === 'credit' ? '#1D9E75' : '#EF4444',
                          }}>{tx.type === 'credit' ? 'income' : 'expense'}</span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold flex-shrink-0" style={{ color: tx.type === 'credit' ? '#1D9E75' : '#EF4444' }}>
                        {tx.type === 'credit' ? '+' : '−'}{formatCurrency(tx.amount, tx.currency)}
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Confirm button */}
              <div className="px-6 pb-8 pt-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <button
                  onClick={confirmImport}
                  disabled={importSelected.size === 0 || importSaving}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ backgroundColor: user?.color || '#534AB7' }}
                >
                  {importSaving ? 'importing…' : `import ${importItems.filter(t => importSelected.has(t.id)).length} transactions`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
