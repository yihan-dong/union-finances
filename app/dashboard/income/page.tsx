'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ShineBorder } from '@/components/ui/shine-border'
import type { Income, IncomeType, UserIdentity } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { IncomeTypeIcon } from '@/components/icons'
import Portal from '@/components/Portal'

const INCOME_TYPES: IncomeType[] = ['salary', 'freelance', 'investment', 'gift', 'other']

const USER_COLORS: Record<string, string> = {
  yihan: '#534AB7',
  sun: '#1D9E75',
  sokim: '#EAB308',
  sambath: '#DB2777',
}

const TYPE_COLORS: Record<IncomeType, string> = {
  salary:     '#6366F1',
  freelance:  '#10B981',
  investment: '#F59E0B',
  gift:       '#EC4899',
  other:      '#94A3B8',
}

const GLASS: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
}

const fade = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({ opacity: 1, transition: { delay: i * 0.05, duration: 0.22 } }),
}

interface AddIncomeForm {
  amount: string
  source: string
  type: IncomeType
  date: string
  owner: UserIdentity
  recurring: boolean
}

const defaultForm = (user: UserIdentity): AddIncomeForm => ({
  amount: '',
  source: '',
  type: 'salary',
  date: new Date().toISOString().slice(0, 10),
  owner: user,
  recurring: false,
})

function LightbulbIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="18" x2="15" y2="18"/>
      <line x1="10" y1="22" x2="14" y2="22"/>
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  )
}

export default function IncomePage() {
  const { user, resolveProfile } = useAuth()
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AddIncomeForm>(defaultForm(user?.identity || 'yihan'))
  const [saving, setSaving] = useState(false)
  const [savingsTip, setSavingsTip] = useState<number | null>(null)

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  async function fetchIncome() {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate = `${year}-${String(month).padStart(2,'0')}-31`
    const { data } = await supabase.from('income').select('*')
      .eq('couple', user?.couple ?? 'union')
      .gte('date', startDate).lte('date', endDate)
      .order('date', { ascending: false })
    setIncomes((data as Income[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchIncome() }, [])

  async function handleAdd() {
    if (!form.amount || !form.source || saving) return
    setSaving(true)
    const amount = parseFloat(form.amount)
    await supabase.from('income').insert({
      amount,
      source: form.source.trim(),
      type: form.type,
      date: form.date,
      owner: form.owner,
      recurring: form.recurring,
      couple: user?.couple ?? 'union',
    })
    await fetchIncome()
    setForm(defaultForm(user?.identity || 'yihan'))
    setShowForm(false)
    setSaving(false)
    setSavingsTip(amount)
    setTimeout(() => setSavingsTip(null), 5000)
  }

  async function handleDelete(id: string) {
    await supabase.from('income').delete().eq('id', id)
    setIncomes(prev => prev.filter(i => i.id !== id))
  }

  const members = user?.coupleMembers ?? (['yihan', 'sun'] as UserIdentity[])
  const member0Total = incomes.filter(i => i.owner === members[0]).reduce((s, i) => s + Number(i.amount), 0)
  const member1Total = incomes.filter(i => i.owner === members[1]).reduce((s, i) => s + Number(i.amount), 0)
  const combined = member0Total + member1Total

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
      {/* 10% savings tip */}
      <AnimatePresence>
        {savingsTip !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl px-4 py-3 mb-3 flex items-center gap-3"
            style={{ backgroundColor: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.15)' }}
          >
            <span style={{ color: '#1D9E75' }}><LightbulbIcon /></span>
            <div>
              <p className="text-xs font-medium" style={{ color: '#1D9E75' }}>
                10% rule: save {formatCurrency(savingsTip * 0.1)} first
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                treat it like rent — move it to a goal before spending
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monthly summary banner */}
      <motion.div
        custom={0} variants={fade} initial="hidden" animate="visible"
        className="relative rounded-3xl p-5 mb-4 overflow-hidden"
        style={GLASS}
      >
        <ShineBorder shineColor="#1D9E75" duration={18} />
        <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,0,0,0.3)' }}>this month</p>
        <p className="text-3xl font-semibold mb-3" style={{ color: '#1D9E75' }}>{formatCurrency(combined)}</p>
        <div className="flex gap-4">
          <div>
            <div className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: USER_COLORS[members[0]] }} />
            <p className="text-xs font-medium" style={{ color: '#1A1A1A' }}>{formatCurrency(member0Total)}</p>
            <p className="text-[10px]" style={{ color: 'rgba(0,0,0,0.3)' }}>{resolveProfile(members[0]).name}</p>
          </div>
          <div>
            <div className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: USER_COLORS[members[1]] }} />
            <p className="text-xs font-medium" style={{ color: '#1A1A1A' }}>{formatCurrency(member1Total)}</p>
            <p className="text-[10px]" style={{ color: 'rgba(0,0,0,0.3)' }}>{resolveProfile(members[1]).name}</p>
          </div>
          {combined > 0 && (
            <div className="ml-auto text-right">
              <p className="text-[10px]" style={{ color: 'rgba(0,0,0,0.3)' }}>10% target</p>
              <p className="text-xs font-medium" style={{ color: '#1D9E75' }}>{formatCurrency(combined * 0.1)}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Income list */}
      {incomes.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-12">
          <p className="text-sm" style={{ color: 'rgba(0,0,0,0.3)' }}>no income recorded yet</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {incomes.map((inc, i) => (
            <motion.div
              key={inc.id}
              custom={i + 1} variants={fade} initial="hidden" animate="visible"
              className="relative rounded-2xl p-4 overflow-hidden"
              style={GLASS}
            >
              <ShineBorder shineColor={USER_COLORS[inc.owner]} duration={18} />
              <div className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: `${TYPE_COLORS[inc.type]}18`, color: TYPE_COLORS[inc.type] }}
                >
                  <IncomeTypeIcon type={inc.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{inc.source}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: TYPE_COLORS[inc.type] + 'CC' }}>
                      {inc.type}
                    </span>
                    <span className="text-[9px]" style={{ color: 'rgba(0,0,0,0.35)' }}>{formatDate(inc.date)}</span>
                    {inc.recurring && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.4)' }}>
                        ↻ recurring
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-base font-semibold" style={{ color: '#1D9E75' }}>+{formatCurrency(Number(inc.amount))}</p>
                    <p className="text-[9px]" style={{ color: 'rgba(0,0,0,0.3)' }}>save {formatCurrency(Number(inc.amount) * 0.1)}</p>
                  </div>
                  <button onClick={() => handleDelete(inc.id)} className="p-1 rounded-full" style={{ color: 'rgba(0,0,0,0.22)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => { setShowForm(true); setForm(defaultForm(user?.identity || 'yihan')) }}
        className="fixed w-14 h-14 rounded-full flex items-center justify-center text-white text-3xl font-light z-40"
        style={{ bottom: 'calc(7.5rem + env(safe-area-inset-bottom, 0px))', right: 20, backgroundColor: user?.color || '#1D9E75', boxShadow: `0 6px 22px ${(user?.color || '#1D9E75')}55` }}
      >+</motion.button>

      {/* Add Income Sheet */}
      <Portal>
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)', touchAction: 'none' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-t-3xl w-full max-w-md max-h-[94vh] flex flex-col"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle pill */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }} />
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4" style={{ overscrollBehavior: 'contain', overscrollBehaviorX: 'none', touchAction: 'pan-y' }}>
                <div className="flex items-center justify-between mb-5 pt-2">
                  <h3 className="text-xl" style={{ fontFamily: 'var(--font-serif)' }}>add income</h3>
                  <button onClick={() => setShowForm(false)} className="p-2 -mr-2" style={{ color: 'rgba(0,0,0,0.32)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>amount</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-1" style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
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
                {form.amount && parseFloat(form.amount) > 0 && (
                  <p className="text-[10px] mb-3 px-1 flex items-center gap-1" style={{ color: '#1D9E75' }}>
                    <LightbulbIcon /> 10% = {formatCurrency(parseFloat(form.amount) * 0.1)} → add to a goal
                  </p>
                )}

                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>source</label>
                <input
                  type="text" value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="e.g. employer, client, bank"
                  className="w-full px-4 py-3 rounded-2xl mb-4 outline-none text-sm"
                  style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }}
                />

                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>type</label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {INCOME_TYPES.map(t => (
                    <button key={t}
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className="px-3 py-1.5 rounded-full text-xs transition-all"
                      style={form.type === t
                        ? { backgroundColor: TYPE_COLORS[t], color: '#fff' }
                        : { backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.5)' }
                      }
                    >{t}</button>
                  ))}
                </div>

                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>date</label>
                <input
                  type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl mb-4 outline-none text-sm"
                  style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }}
                />

                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>whose income</label>
                <div className="flex gap-2 mb-4">
                  {(user?.coupleMembers ?? ['yihan', 'sun'] as UserIdentity[]).map(id => (
                    <button key={id}
                      onClick={() => setForm(f => ({ ...f, owner: id }))}
                      className="flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all"
                      style={form.owner === id
                        ? { backgroundColor: USER_COLORS[id], color: '#fff' }
                        : { backgroundColor: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.07)' }
                      }
                    >{resolveProfile(id).name}</button>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-6 px-1">
                  <div>
                    <p className="text-sm" style={{ color: '#1A1A1A' }}>recurring</p>
                    <p className="text-[10px]" style={{ color: 'rgba(0,0,0,0.35)' }}>repeats monthly</p>
                  </div>
                  <button
                    onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
                    className="w-12 h-6 rounded-full transition-all relative"
                    style={{ backgroundColor: form.recurring ? (user?.color || '#534AB7') : 'rgba(0,0,0,0.12)' }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all"
                      style={{ left: form.recurring ? '26px' : '2px' }}
                    />
                  </button>
                </div>

              </div>

              {/* Sticky save footer */}
              <div className="flex-shrink-0 px-6 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}>
                <button
                  onClick={handleAdd}
                  disabled={!form.amount || !form.source || saving}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ backgroundColor: user?.color || '#1D9E75' }}
                >
                  {saving ? 'saving…' : 'add income'}
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
