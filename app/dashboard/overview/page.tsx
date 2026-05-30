'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import type { Expense, Income, Goal } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

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

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const } }),
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
    </svg>
  )
}

export default function OverviewPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [command, setCommand] = useState('')
  const [cmdLoading, setCmdLoading] = useState(false)
  const [cmdMessage, setCmdMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december']

  async function fetchData() {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`
    const endDate = `${year}-${String(month).padStart(2,'0')}-31`

    const [{ data: expData }, { data: incData }, { data: goalData }] = await Promise.all([
      supabase.from('expenses').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
      supabase.from('income').select('*').gte('date', startDate).lte('date', endDate),
      supabase.from('goals').select('*'),
    ])
    setExpenses((expData as Expense[]) || [])
    setIncomes((incData as Income[]) || [])
    setGoals((goalData as Goal[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // Calculations
  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const saved = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (saved / totalIncome) * 100 : 0
  const wealth = goals.reduce((s, g) => s + Number(g.current_amount), 0)

  const utilitySpend = expenses.filter(e => e.bucket === 'utility' || !e.bucket).reduce((s, e) => s + Number(e.amount), 0)
  const statusSpend = expenses.filter(e => e.bucket === 'status').reduce((s, e) => s + Number(e.amount), 0)
  const statusPct = totalExpenses > 0 ? statusSpend / totalExpenses : 0

  const recentExpenses = expenses.slice(0, 5)

  async function handleCommand() {
    if (!command.trim() || cmdLoading || !user) return
    setCmdLoading(true)
    setCmdMessage('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch('/api/command', {
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
        <motion.div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
          animate={{ scale: [1,1.5,1], opacity: [0.3,1,0.3] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      </div>
    )
  }

  return (
    <div className="px-5 pt-2 pb-4 space-y-3">

      {/* Household health card */}
      <motion.div
        custom={0} variants={fadeUp} initial="hidden" animate="visible"
        className="rounded-3xl p-5"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: 'rgba(0,0,0,0.3)' }}>{monthNames[month - 1]} {year}</p>

        {/* Big saved number */}
        <div className="mb-4">
          <p
            className="text-4xl font-semibold tracking-tight"
            style={{ color: saved >= 0 ? '#1D9E75' : '#EF4444' }}
          >
            {saved < 0 ? '-' : ''}{formatCurrency(Math.abs(saved))}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {saved >= 0 ? 'saved' : 'overspent'} this month
            </p>
            {totalIncome > 0 && (
              <span
                className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: savingsRate >= 10 ? 'rgba(29,158,117,0.12)' : 'rgba(245,158,11,0.12)',
                  color: savingsRate >= 10 ? '#1D9E75' : '#D97706',
                }}
              >
                {savingsRate.toFixed(0)}% saved
              </span>
            )}
          </div>
        </div>

        {/* Income / Spent row */}
        <div className="flex gap-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.28)' }}>income</p>
            <p className="text-base font-semibold" style={{ color: '#1D9E75' }}>+{formatCurrency(totalIncome)}</p>
          </div>
          <div style={{ width: '1px', backgroundColor: 'rgba(0,0,0,0.06)' }} />
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.28)' }}>spent</p>
            <p className="text-base font-semibold" style={{ color: '#EF4444' }}>−{formatCurrency(totalExpenses)}</p>
          </div>
        </div>

        {/* 10% nudge */}
        {totalIncome > 0 && savingsRate < 10 && saved > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 px-3 py-2 rounded-2xl"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)' }}
          >
            <p className="text-[10px]" style={{ color: '#D97706' }}>
              💡 10% rule: aim to save {formatCurrency(totalIncome * 0.1)}/mo — you&apos;re {formatCurrency(totalIncome * 0.1 - saved)} away
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Wealth card */}
      {wealth > 0 && (
        <motion.div
          custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="rounded-3xl p-5"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.3)' }}>what you&apos;ve kept</p>
          <p className="text-3xl font-semibold tracking-tight" style={{ color: '#534AB7' }}>{formatCurrency(wealth)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.35)' }}>across {goals.length} savings goal{goals.length !== 1 ? 's' : ''}</p>
        </motion.div>
      )}

      {/* Spending buckets */}
      {totalExpenses > 0 && (
        <motion.div
          custom={3} variants={fadeUp} initial="hidden" animate="visible"
          className="rounded-3xl p-5"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,0,0,0.3)' }}>spending breakdown</p>

          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>🏠 for us</p>
                <p className="text-xs font-medium" style={{ color: '#1A1A1A' }}>{formatCurrency(utilitySpend)}</p>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${((1 - statusPct) * 100)}%`, backgroundColor: '#1D9E75' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>✨ status</p>
                <p className="text-xs font-medium" style={{ color: '#1A1A1A' }}>{formatCurrency(statusSpend)}</p>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${statusPct * 100}%`, backgroundColor: statusPct > 0.3 ? '#F59E0B' : '#94A3B8' }} />
              </div>
            </div>
          </div>

          {statusPct > 0.3 && (
            <p className="text-[10px] mt-2.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
              {(statusPct * 100).toFixed(0)}% of spending is status — is it worth it?
            </p>
          )}
        </motion.div>
      )}

      {/* Recent expenses */}
      {recentExpenses.length > 0 && (
        <motion.div
          custom={4} variants={fadeUp} initial="hidden" animate="visible"
          className="rounded-3xl p-5"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,0,0,0.3)' }}>recent expenses</p>
          <div className="space-y-3">
            {recentExpenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#94A3B8' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: '#1A1A1A' }}>{exp.description}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(0,0,0,0.35)' }}>
                    {exp.category} · {formatDate(exp.date)}
                    {exp.bucket === 'status' && <span className="ml-1">✨</span>}
                  </p>
                </div>
                <p className="text-sm font-semibold flex-shrink-0" style={{ color: '#EF4444' }}>
                  −{formatCurrency(Number(exp.amount))}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* AI command box */}
      <motion.div
        custom={5} variants={fadeUp} initial="hidden" animate="visible"
        className="rounded-3xl p-4"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: user?.color }}>
            <SparkleIcon />
          </span>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(0,0,0,0.3)' }}>quick add</p>
        </div>
        {cmdMessage && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs mb-2 px-1"
            style={{ color: '#1D9E75' }}
          >
            {cmdMessage}
          </motion.p>
        )}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
          style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <input
            ref={inputRef}
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCommand()}
            placeholder='e.g. "spent $45 on groceries"'
            className="flex-1 text-xs bg-transparent outline-none"
            style={{ color: '#1A1A1A' }}
          />
          <motion.button
            onClick={handleCommand}
            disabled={!command.trim() || cmdLoading}
            whileTap={{ scale: 0.9 }}
            className="flex-shrink-0 disabled:opacity-30"
            style={{ color: user?.color }}
          >
            {cmdLoading ? (
              <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </motion.svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
