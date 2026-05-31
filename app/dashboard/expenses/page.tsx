'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ShineBorder } from '@/components/ui/shine-border'
import type { Expense, ExpenseCategory, BucketType, UserIdentity, CurrencyType, PaidByType } from '@/lib/types'
import { formatCurrency, formatDate, toUSD } from '@/lib/utils'
import { CategoryIcon, HouseIcon, StarIcon, PencilIcon } from '@/components/icons'
import LoadingOverlay from '@/components/LoadingOverlay'
import Portal from '@/components/Portal'

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

const USER_COLORS: Record<string, string> = { yihan: '#534AB7', sun: '#1D9E75', sokim: '#EAB308', sambath: '#DB2777' }

// Combined filter: 'all' | bucket | category
type FilterValue = 'all' | 'utility' | 'status' | ExpenseCategory

const fadeUp = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({ opacity: 1, transition: { delay: i * 0.05, duration: 0.22 } }),
}

// ── SVG Icons ──────────────────────────────────────────────
function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

function DocumentIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

function PriceCheckIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  )
}

function SpinIcon() {
  return (
    <motion.svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </motion.svg>
  )
}

// ── Image compression ──────────────────────────────────────
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

// ── Types ──────────────────────────────────────────────────
interface ExpenseForm {
  amount: string; description: string; category: ExpenseCategory
  date: string; paid_by: PaidByType; bucket: BucketType
  currency: CurrencyType; note: string
}

interface ImportTx {
  id: string; date: string; description: string; amount: number
  currency: CurrencyType; type: 'debit' | 'credit'; category: ExpenseCategory; bucket: BucketType
}

interface PriceResult {
  product: string; priceRange: string; verdict: 'good deal' | 'fair price' | 'overpriced' | 'unknown'
  advice: string; sources: string[]
}

function defaultForm(user: UserIdentity): ExpenseForm {
  return {
    amount: '', description: '', category: 'food & dining',
    date: new Date().toISOString().slice(0, 10),
    paid_by: user, bucket: 'utility', currency: 'USD', note: '',
  }
}

function groupByDate(expenses: Expense[]): { date: string; items: Expense[] }[] {
  const map = new Map<string, Expense[]>()
  for (const e of expenses) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date)!.push(e)
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
}

function shineColor(paid_by: PaidByType): string | string[] {
  if (paid_by === 'both') return [USER_COLORS.yihan, USER_COLORS.sun]
  return USER_COLORS[paid_by] || USER_COLORS.yihan
}

const VERDICT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  'good deal':  { bg: 'rgba(29,158,117,0.12)', color: '#1D9E75',  label: 'Good deal' },
  'fair price': { bg: 'rgba(245,158,11,0.12)', color: '#D97706',  label: 'Fair price' },
  'overpriced': { bg: 'rgba(239,68,68,0.10)',  color: '#EF4444',  label: 'Overpriced' },
  'unknown':    { bg: 'rgba(0,0,0,0.06)',       color: 'rgba(0,0,0,0.45)', label: 'Unknown' },
}

// ── Main Component ─────────────────────────────────────────
export default function ExpensesPage() {
  const { user, resolveProfile } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all')

  // Form
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseForm>(defaultForm(user?.identity || 'yihan'))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  // Scan
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importItems, setImportItems] = useState<ImportTx[]>([])
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set())
  const [importSaving, setImportSaving] = useState(false)
  const pdfRef = useRef<HTMLInputElement>(null)

  // Price check
  const [priceChecking, setPriceChecking] = useState(false)
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null)
  const [showPriceResult, setShowPriceResult] = useState(false)
  const priceRef = useRef<HTMLInputElement>(null)

  // Loading overlay context
  type LoadCtx = 'scan' | 'import' | 'price-check' | 'save' | 'generic'
  const loadingCtx: LoadCtx =
    scanning ? 'scan' :
    importLoading ? 'import' :
    priceChecking ? 'price-check' :
    saving ? 'save' :
    'generic'
  const anyLoading = scanning || importLoading || priceChecking || saving

  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  async function fetchExpenses() {
    try {
      const startDate = `${year}-${String(month).padStart(2,'0')}-01`
      const endDate   = `${year}-${String(month).padStart(2,'0')}-31`
      const { data } = await supabase.from('expenses').select('*')
        .eq('couple', user?.couple ?? 'union')
        .gte('date', startDate).lte('date', endDate).order('date', { ascending: false })
      setExpenses((data as Expense[]) || [])
    } catch {
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExpenses() }, [])

  function openAdd() {
    setFormMode('add'); setEditingId(null)
    setSaveError(''); setSaveSuccess(''); setSaving(false)
    setForm(defaultForm(user?.identity || 'yihan'))
    setShowForm(true)
  }

  function openEdit(exp: Expense) {
    setFormMode('edit'); setEditingId(exp.id)
    setSaveError(''); setSaveSuccess(''); setSaving(false)
    setForm({
      amount: String(exp.amount), description: exp.description, category: exp.category,
      date: exp.date, paid_by: exp.paid_by, bucket: exp.bucket || 'utility',
      currency: exp.currency || 'USD', note: exp.note || '',
    })
    setShowForm(true)
  }

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setScanning(true)
    try {
      let base64: string
      let mimeType: string
      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        bytes.forEach(b => binary += String.fromCharCode(b))
        base64 = btoa(binary)
        mimeType = 'application/pdf'
      } else {
        const compressed = await compressImage(file)
        base64 = compressed.base64
        mimeType = compressed.mimeType
      }
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: base64, mimeType }) })
      const data = await res.json()
      const scanned: Partial<ExpenseForm> = {}
      if (data.amount)    scanned.amount      = String(data.amount)
      if (data.description) scanned.description = data.description
      if (data.category && CATEGORIES.includes(data.category)) scanned.category = data.category
      if (data.date)      scanned.date        = data.date
      if (data.bucket === 'status' || data.bucket === 'utility') scanned.bucket = data.bucket
      if (data.currency === 'KHR') scanned.currency = 'KHR'
      setFormMode('add'); setEditingId(null)
      setSaveError('')
      setForm(f => ({ ...f, ...scanned }))
      setShowForm(true)
    } catch { /* silent */ }
    finally { setScanning(false) }
    e.target.value = ''
  }

  async function handlePriceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setPriceChecking(true)
    try {
      const { base64, mimeType } = await compressImage(file)
      const res  = await fetch('/api/price-check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: base64, mimeType }) })
      const data = await res.json()
      if (data.product) {
        setPriceResult(data as PriceResult)
        setShowPriceResult(true)
      }
    } catch { /* silent */ }
    finally { setPriceChecking(false) }
    e.target.value = ''
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImportLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1]
          const res  = await fetch('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pdf: base64 }) })
          const data = await res.json()
          const items: ImportTx[] = (data.transactions || []).map((t: Omit<ImportTx, 'id'>) => ({ ...t, id: crypto.randomUUID() }))
          setImportItems(items)
          setImportSelected(new Set(items.filter(t => t.type === 'debit').map(t => t.id)))
          setShowImport(true)
        } catch { /* silent */ }
        setImportLoading(false)
      }
      reader.readAsDataURL(file)
    } catch { setImportLoading(false) }
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
        date: t.date, paid_by: user?.identity || 'yihan', bucket: t.bucket, currency: t.currency, note: null,
        couple: user?.couple ?? 'union',
      })))
    }
    if (credits.length > 0) {
      await supabase.from('income').insert(credits.map(t => ({
        amount: t.amount, source: t.description, type: 'other',
        date: t.date, owner: user?.identity || 'yihan', recurring: false,
        couple: user?.couple ?? 'union',
      })))
    }
    await fetchExpenses()
    setShowImport(false); setImportItems([]); setImportSelected(new Set()); setImportSaving(false)
  }

  async function handleSave() {
    if (!form.amount || !form.description || saving) return
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      setSaveError('please enter a valid amount')
      setSaving(false)
      return
    }
    try {
      const payload: Record<string, unknown> = {
        amount,
        description: form.description.trim(),
        category: form.category,
        date: form.date,
        paid_by: form.paid_by,
        bucket: form.bucket,
        currency: form.currency,
        note: form.note.trim() || null,
        couple: user?.couple ?? 'union',
      }

      // Save, but if a column (e.g. `couple`) is missing in the DB,
      // strip it and retry so saving never silently fails.
      async function save(p: Record<string, unknown>): Promise<void> {
        const run = () =>
          formMode === 'edit' && editingId
            ? supabase.from('expenses').update(p).eq('id', editingId)
            : supabase.from('expenses').insert(p)
        const { error } = await run()
        if (error) {
          // Postgres "column ... does not exist" → drop the offending key & retry
          const m = /column ["']?(\w+)["']? .* does not exist|Could not find the '(\w+)' column/i.exec(error.message || '')
          const badCol = m?.[1] || m?.[2]
          if (badCol && badCol in p) {
            const { [badCol]: _drop, ...rest } = p
            return save(rest)
          }
          throw error
        }
      }
      await save(payload)

      await fetchExpenses()
      setShowForm(false)
      setSaveSuccess('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'save failed'
      setSaveError(`couldn't save — ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  // Filter logic
  const filtered = expenses.filter(e => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'utility') return !e.bucket || e.bucket === 'utility'
    if (activeFilter === 'status') return e.bucket === 'status'
    return e.category === activeFilter
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
      {/* Loading overlay */}
      <Portal><LoadingOverlay visible={anyLoading} context={loadingCtx} /></Portal>

      {/* Hidden inputs */}
      <input ref={fileRef}  type="file" accept="image/*,application/pdf" className="hidden" onChange={handleScanFile} />
      <input ref={pdfRef}   type="file" accept="application/pdf"               className="hidden" onChange={handleImportFile} />
      <input ref={priceRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePriceFile} />

      {/* ── Single combined filter row ───────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
        {/* All */}
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => setActiveFilter('all')}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={activeFilter === 'all'
            ? { backgroundColor: '#1A1A1A', color: '#fff' }
            : { backgroundColor: 'rgba(255,255,255,0.7)', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.08)' }
          }>all</motion.button>

        {/* Bucket filters — house / star icons */}
        {([['utility', 'for us'] as const, ['status', 'for others'] as const]).map(([val, label]) => (
          <motion.button key={val} whileTap={{ scale: 0.94 }} onClick={() => setActiveFilter(val)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={activeFilter === val
              ? { backgroundColor: val === 'utility' ? '#1D9E75' : '#D97706', color: '#fff' }
              : { backgroundColor: 'rgba(255,255,255,0.7)', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.08)' }
            }>
            {val === 'utility' ? <HouseIcon /> : <StarIcon />}
            {label}
          </motion.button>
        ))}

        {/* Thin divider */}
        <div className="flex-shrink-0 w-px my-1" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }} />

        {/* Category filters */}
        {CATEGORIES.map(cat => (
          <motion.button key={cat} whileTap={{ scale: 0.94 }} onClick={() => setActiveFilter(cat)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={activeFilter === cat
              ? { backgroundColor: user?.color || '#534AB7', color: '#fff' }
              : { backgroundColor: 'rgba(255,255,255,0.7)', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.08)' }
            }>{cat}</motion.button>
        ))}
      </div>

      {/* ── Expense list ─────────────────────────────────── */}
      {grouped.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-16">
          <p className="text-sm" style={{ color: 'rgba(0,0,0,0.3)' }}>no expenses yet</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ date, items }, gi) => (
            <motion.div key={date} custom={gi} variants={fadeUp} initial="hidden" animate="visible">
              {(() => {
                const dayTotal = items.reduce((s, e) => s + toUSD(Number(e.amount), e.currency || 'USD'), 0)
                return (
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(0,0,0,0.3)' }}>
                      {formatDate(date)}
                    </p>
                    {dayTotal > 0 && (
                      <p className="text-[10px] font-medium" style={{ color: 'rgba(0,0,0,0.35)' }}>
                        −${dayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                )
              })()}
              <div className="space-y-2">
                {items.map(exp => (
                  <div key={exp.id} className="relative rounded-2xl p-4 overflow-hidden"
                    style={{ backgroundColor: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                    <ShineBorder shineColor={shineColor(exp.paid_by)} duration={18} />
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: `${CATEGORY_COLORS[exp.category] || '#94A3B8'}18`, color: CATEGORY_COLORS[exp.category] || '#94A3B8' }}>
                        <CategoryIcon category={exp.category} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{exp.description}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.4)' }}>
                            {exp.category}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                            style={{
                              backgroundColor: exp.bucket === 'status' ? 'rgba(245,158,11,0.1)' : 'rgba(29,158,117,0.1)',
                              color: exp.bucket === 'status' ? '#D97706' : '#1D9E75',
                            }}>
                            {exp.bucket === 'status' ? <StarIcon size={8} /> : <HouseIcon size={8} />}
                            {exp.bucket === 'status' ? 'for others' : 'for us'}
                          </span>
                          {exp.paid_by === 'both' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(83,74,183,0.08)', color: '#534AB7' }}>both</span>
                          )}
                        </div>
                        {exp.note && <p className="text-[10px] mt-1" style={{ color: 'rgba(0,0,0,0.35)' }}>{exp.note}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <p className="text-base font-semibold" style={{ color: '#EF4444' }}>
                          −{formatCurrency(Number(exp.amount), exp.currency || 'USD')}
                        </p>
                        <button onClick={() => openEdit(exp)} className="p-1 rounded-full" style={{ color: 'rgba(0,0,0,0.28)' }}>
                          <PencilIcon />
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="p-1 rounded-full" style={{ color: 'rgba(0,0,0,0.22)' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
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

      {/* ── FAB cluster ──────────────────────────────────── */}
      <div className="fixed right-5 z-40 flex items-center gap-2.5" style={{ bottom: 'calc(7.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* PDF import */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => pdfRef.current?.click()} disabled={importLoading}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', color: importLoading ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)' }}
          title="Import bank statement">
          {importLoading ? <SpinIcon /> : <DocumentIcon />}
        </motion.button>

        {/* Price check */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => priceRef.current?.click()} disabled={priceChecking}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', color: priceChecking ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)' }}
          title="Price check in Cambodia">
          {priceChecking ? <SpinIcon /> : <PriceCheckIcon />}
        </motion.button>

        {/* Scan receipt */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => fileRef.current?.click()} disabled={scanning}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 14px rgba(0,0,0,0.1)', color: scanning ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)' }}
          title="Scan receipt">
          {scanning ? <SpinIcon /> : <CameraIcon />}
        </motion.button>

        {/* Add expense — main FAB */}
        <motion.button whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.04 }} onClick={openAdd}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-3xl font-light"
          style={{ backgroundColor: user?.color || '#534AB7', boxShadow: `0 6px 22px ${(user?.color || '#534AB7')}55` }}>
          +
        </motion.button>
      </div>

      {/* ── Add / Edit form sheet ─────────────────────────── */}
      <Portal>
      <AnimatePresence>
        {showForm && (
          <motion.div className="fixed inset-0 z-[200] flex items-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', touchAction: 'none' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-t-3xl w-full max-w-md mx-auto max-h-[94vh] flex flex-col"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()} style={{ overscrollBehavior: 'contain' }}>
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }} />
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4" style={{ overscrollBehavior: 'contain', overscrollBehaviorX: 'none', touchAction: 'pan-y' }}>
                <div className="flex items-center justify-between mb-5 pt-2">
                  <h3 className="text-xl" style={{ fontFamily: 'var(--font-serif)' }}>
                    {formMode === 'edit' ? 'edit expense' : 'add expense'}
                  </h3>
                  <button onClick={() => setShowForm(false)} className="p-2 -mr-2" style={{ color: 'rgba(0,0,0,0.32)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {/* Amount */}
                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>amount</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
                  <span style={{ color: 'rgba(0,0,0,0.35)' }}>{form.currency === 'KHR' ? '៛' : '$'}</span>
                  <input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={form.amount}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) setForm(f => ({ ...f, amount: v }))
                    }}
                    placeholder="0.00" className="flex-1 text-2xl font-semibold bg-transparent outline-none"
                    style={{ color: '#1A1A1A' }} autoFocus />
                </div>

                {/* Description */}
                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>what was this for?</label>
                <input type="text" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. coffee & croissant, groceries…"
                  className="w-full px-4 py-3 rounded-2xl mb-4 outline-none text-sm"
                  style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }} />

                {/* Bucket */}
                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>was this for…</label>
                <div className="flex gap-2 mb-4">
                  {([
                    ['utility', 'for us',     'things that add to your life'] as const,
                    ['status',  'for others',  'impressing or giving to others'] as const,
                  ]).map(([val, label, sub]) => (
                    <button key={val} onClick={() => setForm(f => ({ ...f, bucket: val }))}
                      className="flex-1 py-3 px-3 rounded-2xl text-left transition-all"
                      style={form.bucket === val
                        ? { backgroundColor: val === 'utility' ? 'rgba(29,158,117,0.12)' : 'rgba(245,158,11,0.12)', border: `1.5px solid ${val === 'utility' ? '#1D9E75' : '#D97706'}` }
                        : { backgroundColor: 'rgba(0,0,0,0.03)', border: '1.5px solid transparent' }
                      }>
                      <p className="text-sm font-medium flex items-center gap-1.5"
                        style={{ color: form.bucket === val ? (val === 'utility' ? '#1D9E75' : '#D97706') : 'rgba(0,0,0,0.5)' }}>
                        {val === 'utility' ? <HouseIcon size={13} /> : <StarIcon size={13} />}
                        {label}
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>{sub}</p>
                    </button>
                  ))}
                </div>

                {/* Category */}
                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>category</label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className="px-3 py-1.5 rounded-full text-xs transition-all"
                      style={form.category === cat
                        ? { backgroundColor: CATEGORY_COLORS[cat], color: '#fff' }
                        : { backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.5)' }
                      }>{cat}</button>
                  ))}
                </div>

                {/* Date */}
                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 rounded-2xl mb-4 outline-none text-sm"
                  style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A', height: 46, fontSize: 14, WebkitAppearance: 'none', appearance: 'none' }} />

                {/* Paid by */}
                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>paid from</label>
                <div className="flex gap-2 mb-4">
                  {(() => {
                    const members = user?.coupleMembers ?? ['yihan', 'sun']
                    const paidByOptions: PaidByType[] = [members[0], 'both', members[1]]
                    return paidByOptions.map(id => (
                      <button key={id} onClick={() => setForm(f => ({ ...f, paid_by: id }))}
                        className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
                        style={form.paid_by === id
                          ? {
                              background: id === 'both'
                                ? `linear-gradient(135deg, ${USER_COLORS[members[0]]}, ${USER_COLORS[members[1]]})`
                                : USER_COLORS[id],
                              color: '#fff',
                            }
                          : { backgroundColor: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.07)' }
                        }>
                        {id === 'both' ? 'Both' : resolveProfile(id as UserIdentity).name}
                      </button>
                    ))
                  })()}
                </div>

                {/* Currency */}
                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>currency</label>
                <div className="flex gap-2 mb-4">
                  {(['USD', 'KHR'] as CurrencyType[]).map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, currency: c }))}
                      className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
                      style={form.currency === c
                        ? { backgroundColor: '#1A1A1A', color: '#fff' }
                        : { backgroundColor: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.07)' }
                      }>
                      {c === 'USD' ? '$ USD' : '៛ KHR'}
                    </button>
                  ))}
                </div>

                {/* Note */}
                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>note (optional)</label>
                <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="any extra details"
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }} />
              </div>

              {/* ── Sticky save footer — always visible ──────── */}
              <div className="flex-shrink-0 px-6 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}>
                {saveError && (
                  <div className="mb-2.5 px-4 py-3 rounded-2xl text-sm font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#DC2626', border: '1.5px solid rgba(239,68,68,0.25)' }}>
                    ⚠️ {saveError}
                  </div>
                )}
                <button onClick={handleSave} disabled={!form.amount || !form.description || saving}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ backgroundColor: user?.color || '#534AB7' }}>
                  {saving ? 'saving…' : formMode === 'edit' ? 'update expense' : 'add expense'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </Portal>

      {/* ── Price Check Result Sheet ──────────────────────── */}
      <Portal>
      <AnimatePresence>
        {showPriceResult && priceResult && (
          <motion.div className="fixed inset-0 z-[200] flex items-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', touchAction: 'none' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-t-3xl w-full max-w-md mx-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}>
              {/* Handle */}
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

                {/* Price + Verdict */}
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

                {/* Advice */}
                <div className="px-4 py-3 rounded-2xl mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'rgba(0,0,0,0.3)' }}>advice</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(0,0,0,0.7)' }}>{priceResult.advice}</p>
                </div>

                {/* Sources */}
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
      </Portal>

      {/* ── Import Review Sheet ───────────────────────────── */}
      <Portal>
      <AnimatePresence>
        {showImport && (
          <motion.div className="fixed inset-0 z-[200] flex items-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', touchAction: 'none' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-t-3xl w-full max-w-md mx-auto max-h-[88vh] flex flex-col"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }} />
              </div>
              <div className="flex items-center justify-between px-6 pt-2 pb-4 flex-shrink-0">
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
              <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-2" style={{ overscrollBehavior: 'contain' }}>
                {importItems.map(tx => {
                  const sel = importSelected.has(tx.id)
                  return (
                    <button key={tx.id} onClick={() => setImportSelected(prev => {
                      const next = new Set(prev)
                      sel ? next.delete(tx.id) : next.add(tx.id)
                      return next
                    })} className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all"
                      style={{ backgroundColor: sel ? 'rgba(0,0,0,0.03)' : 'transparent', border: `1px solid ${sel ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)'}`, opacity: sel ? 1 : 0.45 }}>
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: sel ? (user?.color || '#534AB7') : 'rgba(0,0,0,0.08)' }}>
                        {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{tx.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px]" style={{ color: 'rgba(0,0,0,0.35)' }}>{tx.date}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.4)' }}>{tx.category}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tx.type === 'credit' ? 'rgba(29,158,117,0.1)' : 'rgba(239,68,68,0.08)', color: tx.type === 'credit' ? '#1D9E75' : '#EF4444' }}>
                            {tx.type === 'credit' ? 'income' : 'expense'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold flex-shrink-0" style={{ color: tx.type === 'credit' ? '#1D9E75' : '#EF4444' }}>
                        {tx.type === 'credit' ? '+' : '−'}{formatCurrency(tx.amount, tx.currency)}
                      </p>
                    </button>
                  )
                })}
              </div>
              <div className="px-6 pb-8 pt-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <button onClick={confirmImport} disabled={importSelected.size === 0 || importSaving}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ backgroundColor: user?.color || '#534AB7' }}>
                  {importSaving ? 'importing…' : `import ${importItems.filter(t => importSelected.has(t.id)).length} transactions`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </Portal>
    </div>
  )
}
