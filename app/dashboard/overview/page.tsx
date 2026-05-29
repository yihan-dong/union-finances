'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import type { Expense, Income } from '@/lib/types'
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

    const [{ data: expData }, { data: incData }] = await Promise.all([
      supabase.from('expenses').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
      supabase.from('income').select('*').gte('date', startDate).lte('date', endDate),
    ])
    setExpenses((expData as Expense[]) || [])
    setIncomes((incData as Income[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // Calculations
  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const netPosition = totalIncome - totalExpenses

  const yihanPaid = expenses.filter(e => e.paid_by === 'yihan').reduce((s, e) => s + Number(e.amount), 0)
  const sunPaid = expenses.filter(e => e.paid_by === 'sun').reduce((s, e) => s + Number(e.amount), 0)

  // Balance calculation
  // For each expense, what does each person owe?
  let yihanOwes = 0 // what yihan should have paid total
  let sunOwes = 0   // what sun should have paid total
  expenses.forEach(e => {
    const amt = Number(e.amount)
    if (e.split === 'even') {
      yihanOwes += amt / 2
      sunOwes += amt / 2
    } else if (e.split === 'yihan') {
      yihanOwes += amt
    } else if (e.split === 'sun') {
      sunOwes += amt
    }
  })
  // What they actually paid
  // Net = what yihan owes - what yihan paid (positive means yihan is in debt to sun)
  const yihanBalance = yihanOwes - yihanPaid // positive = yihan owes sun
  const sunBalance = sunOwes - sunPaid       // positive = sun owes yihan

  // Net settlement
  const settlement = yihanBalance - sunBalance // positive = yihan owes sun net

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

      // Execute actions
      for (const action of (json.actions || [])) {
        if (action.type === 'add_expense') {
          await supabase.from('expenses').insert(action.data)
        } else if (action.type === 'add_income') {
          await supabase.from('income').insert(action.data)
        } else if (action.type === 'set_budget') {
          const { data: existing } = await supabase.from('budgets')
            .select('id')
            .eq('category', action.data.category)
            .eq('owner', action.data.owner)
            .eq('month', month)
            .eq('year', year)
            .single()
          if (existing) {
            await supabase.from('budgets').update({ monthly_limit: action.data.monthly_limit }).eq('id', existing.id)
          } else {
            await supabase.from('budgets').insert({ ...action.data, month, year })
          }
        } else if (action.type === 'add_goal') {
          await supabase.from('goals').insert(action.data)
        }
      }

      if ((json.actions || []).length > 0) {
        fetchData()
      }
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

      {/* Month header */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <h2 className="text-2xl px-1" style={{ fontFamily: 'var(--font-serif)', color: 'rgba(0,0,0,0.22)' }}>
          {monthNames[month - 1]} {year}
        </h2>
      </motion.div>

      {/* Net position card */}
      <motion.div
        custom={1} variants={fadeUp} initial="hidden" animate="visible"
        className="relative rounded-3xl p-5 overflow-hidden"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,0,0,0.3)' }}>net position</p>
        <div className="flex items-end justify-between">
          <div>
            <p
              className="text-4xl font-semibold tracking-tight"
              style={{ color: netPosition >= 0 ? '#1D9E75' : '#EF4444' }}
            >
              {netPosition < 0 ? '-' : ''}{formatCurrency(netPosition)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.35)' }}>
              {netPosition >= 0 ? 'surplus' : 'deficit'} this month
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              <span style={{ color: '#1D9E75' }}>+{formatCurrency(totalIncome)}</span> income
            </p>
            <p className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              <span style={{ color: '#EF4444' }}>−{formatCurrency(totalExpenses)}</span> spent
            </p>
          </div>
        </div>
      </motion.div>

      {/* Who paid what */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3">
        {[
          { name: 'Yihan', color: '#534AB7', paid: yihanPaid },
          { name: 'Sun', color: '#1D9E75', paid: sunPaid },
        ].map(p => (
          <div
            key={p.name}
            className="rounded-3xl p-4"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.color + '22' }}>
                <div className="w-2 h-2 rounded-full mx-auto mt-1.5" style={{ backgroundColor: p.color }} />
              </div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(0,0,0,0.3)' }}>{p.name}</p>
            </div>
            <p className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>{formatCurrency(p.paid)}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(0,0,0,0.3)' }}>paid this month</p>
          </div>
        ))}
      </motion.div>

      {/* Balance */}
      <motion.div
        custom={3} variants={fadeUp} initial="hidden" animate="visible"
        className="rounded-3xl p-5"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,0,0,0.3)' }}>balance</p>
        {Math.abs(settlement) < 0.01 ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1D9E75' }} />
            <p className="text-base" style={{ color: '#1A1A1A' }}>all settled up</p>
          </div>
        ) : settlement > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ backgroundColor: '#534AB7' }}>YD</div>
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.5)' }}>owes</p>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ backgroundColor: '#1D9E75' }}>SR</div>
            <p className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>{formatCurrency(Math.abs(settlement))}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ backgroundColor: '#1D9E75' }}>SR</div>
            <p className="text-sm" style={{ color: 'rgba(0,0,0,0.5)' }}>owes</p>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold" style={{ backgroundColor: '#534AB7' }}>YD</div>
            <p className="text-lg font-semibold" style={{ color: '#1A1A1A' }}>{formatCurrency(Math.abs(settlement))}</p>
          </div>
        )}
      </motion.div>

      {/* Recent transactions */}
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
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#94A3B8' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: '#1A1A1A' }}>{exp.description}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(0,0,0,0.35)' }}>{exp.category} · {formatDate(exp.date)}</p>
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
            placeholder='e.g. "dinner for two, $45, split evenly"'
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
