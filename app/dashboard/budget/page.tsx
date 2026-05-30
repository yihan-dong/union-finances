'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ShineBorder } from '@/components/ui/shine-border'
import type { Budget, Expense, ExpenseCategory } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { CategoryIcon } from '@/components/icons'

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

interface AddBudgetForm {
  category: ExpenseCategory
  monthly_limit: string
}

export default function BudgetPage() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [spendByCategory, setSpendByCategory] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [form, setForm] = useState<AddBudgetForm>({ category: 'food & dining', monthly_limit: '' })
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear, setViewYear] = useState(now.getFullYear())

  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

  async function fetchData() {
    const startDate = `${viewYear}-${String(viewMonth).padStart(2,'0')}-01`
    const endDate = `${viewYear}-${String(viewMonth).padStart(2,'0')}-31`

    const [{ data: bData }, { data: eData }] = await Promise.all([
      supabase.from('budgets').select('*').eq('month', viewMonth).eq('year', viewYear),
      supabase.from('expenses').select('*').gte('date', startDate).lte('date', endDate),
    ])

    setBudgets((bData as Budget[]) || [])

    const spend: Record<string, number> = {}
    for (const exp of ((eData as Expense[]) || [])) {
      spend[exp.category] = (spend[exp.category] || 0) + Number(exp.amount)
    }
    setSpendByCategory(spend)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [viewMonth, viewYear])

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  async function handleSave() {
    if (!form.monthly_limit || saving) return
    setSaving(true)
    if (editingBudget) {
      await supabase.from('budgets').update({ monthly_limit: parseFloat(form.monthly_limit) }).eq('id', editingBudget.id)
    } else {
      const { data: existing } = await supabase.from('budgets').select('id')
        .eq('category', form.category).eq('owner', 'shared')
        .eq('month', viewMonth).eq('year', viewYear).single()
      if (existing) {
        await supabase.from('budgets').update({ monthly_limit: parseFloat(form.monthly_limit) }).eq('id', existing.id)
      } else {
        await supabase.from('budgets').insert({
          category: form.category,
          monthly_limit: parseFloat(form.monthly_limit),
          owner: 'shared',
          month: viewMonth,
          year: viewYear,
        })
      }
    }
    await fetchData()
    setShowForm(false)
    setEditingBudget(null)
    setForm({ category: 'food & dining', monthly_limit: '' })
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('budgets').delete().eq('id', id)
    setBudgets(prev => prev.filter(b => b.id !== id))
  }

  function getProgressColor(pct: number) {
    if (pct >= 0.9) return '#EF4444'
    if (pct >= 0.7) return '#F59E0B'
    return '#1D9E75'
  }

  const budgetedCategories = budgets.map(b => b.category)
  const unbudgetedCategories = CATEGORIES.filter(c => !budgetedCategories.includes(c))

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
      {/* Month selector */}
      <motion.div
        custom={0} variants={fade} initial="hidden" animate="visible"
        className="flex items-center justify-between px-5 py-3 rounded-2xl mb-4"
        style={GLASS}
      >
        <button onClick={prevMonth} style={{ color: 'rgba(0,0,0,0.35)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{monthNames[viewMonth - 1]} {viewYear}</p>
        <button onClick={nextMonth} style={{ color: 'rgba(0,0,0,0.35)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </motion.div>

      {/* Budget cards */}
      <div className="space-y-3">
        {budgets.map((budget, i) => {
          const spent = spendByCategory[budget.category] || 0
          const limit = Number(budget.monthly_limit)
          const pct = limit > 0 ? Math.min(spent / limit, 1) : 0
          const remaining = limit - spent
          const catColor = CATEGORY_COLORS[budget.category]

          return (
            <motion.div
              key={budget.id}
              custom={i + 1} variants={fade} initial="hidden" animate="visible"
              className="relative rounded-2xl p-4 overflow-hidden"
              style={GLASS}
            >
              <ShineBorder shineColor={catColor} duration={18} />
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: `${catColor}18`, color: catColor }}>
                    <CategoryIcon category={budget.category} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{budget.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingBudget(budget); setForm({ category: budget.category, monthly_limit: String(budget.monthly_limit) }); setShowForm(true) }}
                    style={{ color: 'rgba(0,0,0,0.3)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(budget.id)} style={{ color: 'rgba(0,0,0,0.22)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full mb-2" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, backgroundColor: getProgressColor(pct) }} />
              </div>

              <div className="flex justify-between">
                <p className="text-xs" style={{ color: 'rgba(0,0,0,0.45)' }}>{formatCurrency(spent)} spent</p>
                <p className="text-xs font-medium" style={{ color: remaining >= 0 ? '#1D9E75' : '#EF4444' }}>
                  {remaining >= 0 ? formatCurrency(remaining) + ' left' : formatCurrency(Math.abs(remaining)) + ' over'}
                </p>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(0,0,0,0.3)' }}>limit: {formatCurrency(limit)}/mo</p>
            </motion.div>
          )
        })}

        {/* Unbudgeted categories */}
        {unbudgetedCategories.map((cat, i) => {
          const spent = spendByCategory[cat] || 0
          const catColor = CATEGORY_COLORS[cat]
          return (
            <motion.div key={cat} custom={budgets.length + i + 1} variants={fade} initial="hidden" animate="visible"
              className="rounded-2xl p-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.5)', opacity: 0.6 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: `${catColor}18`, color: catColor + '88' }}>
                    <CategoryIcon category={cat} />
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(0,0,0,0.5)' }}>{cat}</p>
                </div>
                <div className="flex items-center gap-2">
                  {spent > 0 && <p className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{formatCurrency(spent)} spent</p>}
                  <button
                    onClick={() => { setForm({ category: cat, monthly_limit: '' }); setEditingBudget(null); setShowForm(true) }}
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.4)' }}
                  >
                    set limit
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => { setShowForm(true); setEditingBudget(null); setForm({ category: 'food & dining', monthly_limit: '' }) }}
        className="fixed w-14 h-14 rounded-full flex items-center justify-center text-white text-3xl font-light z-40"
        style={{ bottom: 108, right: 20, backgroundColor: user?.color || '#534AB7', boxShadow: `0 6px 22px ${(user?.color || '#534AB7')}55` }}
      >+</motion.button>

      {/* Add/Edit Budget Sheet */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="fixed inset-0 z-[200] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-t-3xl w-full max-w-md max-h-[82vh] flex flex-col"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}>

              {/* Handle pill */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }} />
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-2" style={{ overscrollBehavior: 'contain' }}>
                <div className="flex items-center justify-between mb-5 pt-2">
                  <h3 className="text-xl" style={{ fontFamily: 'var(--font-serif)' }}>{editingBudget ? 'edit budget' : 'set budget'}</h3>
                  <button onClick={() => { setShowForm(false); setEditingBudget(null) }} style={{ color: 'rgba(0,0,0,0.32)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {!editingBudget && (
                  <>
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
                  </>
                )}

                <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>monthly limit</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-6" style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
                  <span style={{ color: 'rgba(0,0,0,0.35)' }}>$</span>
                  <input type="number" inputMode="decimal" value={form.monthly_limit}
                    onChange={e => setForm(f => ({ ...f, monthly_limit: e.target.value }))}
                    placeholder="0.00"
                    className="flex-1 text-2xl font-semibold bg-transparent outline-none" style={{ color: '#1A1A1A' }} autoFocus />
                </div>

                <button onClick={handleSave} disabled={!form.monthly_limit || saving}
                  className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40 mb-2"
                  style={{ backgroundColor: user?.color || '#534AB7' }}>
                  {saving ? 'saving…' : editingBudget ? 'update' : 'set budget'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
