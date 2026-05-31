'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { ShineBorder } from '@/components/ui/shine-border'
import type { Expense, Income, Goal } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

// ── Category colours ───────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
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

// ── Category SVG icons ─────────────────────────────────────
function CategoryIcon({ category }: { category: string }) {
  const props = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (category) {
    case 'food & dining':
      return <svg {...props}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>
    case 'rent & utilities':
      return <svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    case 'transport':
      return <svg {...props}><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
    case 'shopping':
      return <svg {...props}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
    case 'health':
      return <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    case 'entertainment':
      return <svg {...props}><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
    case 'travel':
      return <svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
    case 'subscriptions':
      return <svg {...props}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
    default:
      return <svg {...props}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
  }
}

// ── Bucket icons ───────────────────────────────────────────
function HouseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
    </svg>
  )
}

// ── Animation ──────────────────────────────────────────────
const fade = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({ opacity: 1, transition: { delay: i * 0.05, duration: 0.22 } }),
}

// ── Glass card helper ──────────────────────────────────────
const GLASS: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
}

const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december']

export default function OverviewPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes,  setIncomes]  = useState<Income[]>([])
  const [goals,    setGoals]    = useState<Goal[]>([])
  const [loading,  setLoading]  = useState(true)
  const [command,     setCommand]    = useState('')
  const [cmdLoading,  setCmdLoading] = useState(false)
  const [cmdMessage,  setCmdMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  async function fetchData() {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate   = `${year}-${String(month).padStart(2,'0')}-31`
    const [{ data: expData }, { data: incData }, { data: goalData }] = await Promise.all([
      supabase.from('expenses').select('*').eq('couple', user?.couple ?? 'union').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
      supabase.from('income').select('*').eq('couple', user?.couple ?? 'union').gte('date', startDate).lte('date', endDate),
      supabase.from('goals').select('*'),
    ])
    setExpenses((expData as Expense[]) || [])
    setIncomes((incData as Income[]) || [])
    setGoals((goalData as Goal[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Calculations ───────────────────────────────────────
  const totalIncome       = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const usdExpenses       = expenses.filter(e => !e.currency || e.currency === 'USD')
  const khrExpenses       = expenses.filter(e => e.currency === 'KHR')
  const totalExpensesUSD  = usdExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalExpensesKHR  = khrExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const saved             = totalIncome - totalExpensesUSD
  const savingsRate       = totalIncome > 0 ? (saved / totalIncome) * 100 : 0
  const wealth            = goals.reduce((s, g) => s + Number(g.current_amount), 0)

  const utilitySpend = usdExpenses.filter(e => !e.bucket || e.bucket === 'utility').reduce((s, e) => s + Number(e.amount), 0)
  const statusSpend  = usdExpenses.filter(e => e.bucket === 'status').reduce((s, e) => s + Number(e.amount), 0)
  const statusPct    = totalExpensesUSD > 0 ? statusSpend / totalExpensesUSD : 0

  const recentExpenses = expenses.slice(0, 6)

  async function handleCommand() {
    if (!command.trim() || cmdLoading || !user) return
    setCmdLoading(true)
    setCmdMessage('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res  = await fetch('/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: command, user: user.identity, userName: user.name, today }),
      })
      const json = await res.json()
      if (json.message) setCmdMessage(json.message)
      for (const action of (json.actions || [])) {
        if (action.type === 'add_expense') {
          await supabase.from('expenses').insert(action.data)
        } else if (action.type === 'add_income') {
          await supabase.from('income').insert(action.data)
        } else if (action.type === 'set_budget') {
          const { data: existing } = await supabase.from('budgets')
            .select('id').eq('category', action.data.category)
            .eq('owner', 'shared').eq('month', month).eq('year', year).single()
          if (existing) {
            await supabase.from('budgets').update({ monthly_limit: action.data.monthly_limit }).eq('id', existing.id)
          } else {
            await supabase.from('budgets').insert({ ...action.data, owner: 'shared', month, year })
          }
        } else if (action.type === 'add_goal') {
          await supabase.from('goals').insert(action.data)
        }
      }
      if ((json.actions || []).length > 0) fetchData()
      setCommand('')
    } catch {
      setCmdMessage('something went wrong — try again')
    } finally {
      setCmdLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <motion.div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
          animate={{ scale: [1,1.5,1], opacity: [0.3,1,0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
      </div>
    )
  }

  return (
    <div className="px-5 pt-2 pb-4 space-y-2.5">

      {/* ── Month label ─────────────────────────────────── */}
      <p className="text-[10px] uppercase tracking-widest px-1 pt-1" style={{ color: 'rgba(0,0,0,0.3)' }}>
        {monthNames[month - 1]} {year}
      </p>

      {/* ── Income + Spent (two balanced tiles) ─────────── */}
      <motion.div custom={0} variants={fade} initial="hidden" animate="visible" className="grid grid-cols-2 gap-2.5">

        {/* Income tile */}
        <div className="relative rounded-2xl p-4 overflow-hidden" style={GLASS}>
          <ShineBorder shineColor="#1D9E75" duration={20} />
          <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: 'rgba(0,0,0,0.3)' }}>income</p>
          <p className="text-lg font-semibold leading-none" style={{ color: '#1D9E75' }}>
            +{formatCurrency(totalIncome)}
          </p>
          <p className="text-[9px] mt-1.5" style={{ color: 'rgba(0,0,0,0.3)' }}>
            {incomes.length} source{incomes.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Spent tile */}
        <div className="relative rounded-2xl p-4 overflow-hidden" style={GLASS}>
          <ShineBorder shineColor="#EF4444" duration={20} />
          <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: 'rgba(0,0,0,0.3)' }}>spent</p>
          <p className="text-lg font-semibold leading-none" style={{ color: '#EF4444' }}>
            −{formatCurrency(totalExpensesUSD)}
          </p>
          {totalExpensesKHR > 0 && (
            <p className="text-[9px] mt-0.5" style={{ color: 'rgba(239,68,68,0.6)' }}>
              ₭{Math.round(totalExpensesKHR).toLocaleString()}
            </p>
          )}
          <p className="text-[9px] mt-1.5" style={{ color: 'rgba(0,0,0,0.3)' }}>
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </p>
        </div>
      </motion.div>

      {/* ── Saved banner ────────────────────────────────── */}
      <motion.div custom={1} variants={fade} initial="hidden" animate="visible"
        className="relative rounded-2xl px-5 py-4 overflow-hidden" style={GLASS}>
        <ShineBorder shineColor={user?.color || '#534AB7'} duration={16} />
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.3)' }}>
              balance
            </p>
            <p className="text-3xl font-semibold tracking-tight leading-none"
              style={{ color: saved >= 0 ? '#1D9E75' : '#EF4444' }}>
              {saved < 0 ? '−' : '+'}{formatCurrency(Math.abs(saved))}
            </p>
          </div>
          {totalIncome > 0 && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: savingsRate >= 10 ? 'rgba(29,158,117,0.14)' : 'rgba(245,158,11,0.14)',
                color: savingsRate >= 10 ? '#1D9E75' : '#D97706',
              }}>
              {savingsRate.toFixed(0)}% saved
            </span>
          )}
        </div>

        {/* 10% nudge */}
        {totalIncome > 0 && savingsRate < 10 && saved > 0 && (
          <p className="text-[10px] mt-2.5 pt-2.5" style={{ color: 'rgba(0,0,0,0.38)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            10% rule: aim for {formatCurrency(totalIncome * 0.1)}/mo — {formatCurrency(totalIncome * 0.1 - saved)} to go
          </p>
        )}
      </motion.div>

      {/* ── Wealth ──────────────────────────────────────── */}
      {wealth > 0 && (
        <motion.div custom={2} variants={fade} initial="hidden" animate="visible"
          className="relative rounded-2xl px-5 py-4 overflow-hidden" style={GLASS}>
          <ShineBorder shineColor="#534AB7" duration={22} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.3)' }}>what you&apos;ve kept</p>
              <p className="text-2xl font-semibold tracking-tight" style={{ color: '#534AB7' }}>{formatCurrency(wealth)}</p>
            </div>
            <p className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
              {goals.length} goal{goals.length !== 1 ? 's' : ''}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Spending breakdown ───────────────────────────── */}
      {totalExpensesUSD > 0 && (
        <motion.div custom={3} variants={fade} initial="hidden" animate="visible"
          className="relative rounded-2xl px-5 py-4 overflow-hidden" style={GLASS}>
          <ShineBorder shineColor={user?.color || '#534AB7'} duration={24} />
          <p className="text-[9px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,0,0,0.3)' }}>spending breakdown</p>

          <div className="space-y-3">
            {/* Utility */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#1D9E75' }}>
                  <HouseIcon /> for us
                </span>
                <span className="text-[11px] font-medium" style={{ color: '#1A1A1A' }}>{formatCurrency(utilitySpend)}</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                <div className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${(1 - statusPct) * 100}%`, backgroundColor: '#1D9E75' }} />
              </div>
            </div>

            {/* Status */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: statusPct > 0.3 ? '#D97706' : 'rgba(0,0,0,0.45)' }}>
                  <StarIcon /> for others
                </span>
                <span className="text-[11px] font-medium" style={{ color: '#1A1A1A' }}>{formatCurrency(statusSpend)}</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                <div className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${statusPct * 100}%`, backgroundColor: statusPct > 0.3 ? '#F59E0B' : '#CBD5E1' }} />
              </div>
            </div>
          </div>

          {statusPct > 0.3 && (
            <p className="text-[10px] mt-2.5 pt-2.5" style={{ color: 'rgba(0,0,0,0.38)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              {(statusPct * 100).toFixed(0)}% spent for others — is it worth it?
            </p>
          )}
        </motion.div>
      )}

      {/* ── Recent expenses ──────────────────────────────── */}
      {recentExpenses.length > 0 && (
        <motion.div custom={4} variants={fade} initial="hidden" animate="visible"
          className="relative rounded-2xl px-5 py-4 overflow-hidden" style={GLASS}>
          <ShineBorder shineColor={user?.color || '#534AB7'} duration={26} />
          <p className="text-[9px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,0,0,0.3)' }}>recent</p>
          <div className="space-y-3">
            {recentExpenses.map(exp => {
              const catColor = CATEGORY_COLORS[exp.category] || '#94A3B8'
              return (
                <div key={exp.id} className="flex items-center gap-3">
                  {/* Category icon badge */}
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${catColor}18`, color: catColor }}
                  >
                    <CategoryIcon category={exp.category} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-tight truncate" style={{ color: '#1A1A1A' }}>{exp.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[9px]" style={{ color: 'rgba(0,0,0,0.32)' }}>{formatDate(exp.date)}</p>
                      {exp.bucket === 'status' && (
                        <span className="text-[9px] flex items-center gap-0.5" style={{ color: '#D97706' }}>
                          <StarIcon /> for others
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold flex-shrink-0" style={{ color: '#EF4444' }}>
                    −{formatCurrency(Number(exp.amount), exp.currency || 'USD')}
                  </p>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── AI quick-add ────────────────────────────────── */}
      <motion.div custom={5} variants={fade} initial="hidden" animate="visible"
        className="relative rounded-2xl px-4 py-3.5 overflow-hidden" style={GLASS}>
        <ShineBorder shineColor={user?.color || '#534AB7'} duration={18} />
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: user?.color }}><SparkleIcon /></span>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(0,0,0,0.3)' }}>quick add</p>
        </div>
        {cmdMessage && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs mb-2 px-1" style={{ color: '#1D9E75' }}>
            {cmdMessage}
          </motion.p>
        )}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
          <input
            ref={inputRef}
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCommand()}
            placeholder='e.g. "spent $45 on groceries"'
            className="flex-1 text-xs bg-transparent outline-none"
            style={{ color: '#1A1A1A' }}
          />
          <motion.button onClick={handleCommand} disabled={!command.trim() || cmdLoading}
            whileTap={{ scale: 0.9 }} className="flex-shrink-0 disabled:opacity-30" style={{ color: user?.color }}>
            {cmdLoading ? (
              <motion.svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </motion.svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </motion.button>
        </div>
      </motion.div>

    </div>
  )
}
