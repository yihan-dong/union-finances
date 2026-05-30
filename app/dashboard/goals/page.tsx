'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ShineBorder } from '@/components/ui/shine-border'
import type { Goal } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

const GOAL_COLORS = ['#534AB7','#1D9E75','#F59E0B','#EC4899','#3B82F6','#8B5CF6','#14B8A6','#F97316']

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.25 } }),
}

function launchConfetti() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  const colors = ['#534AB7','#1D9E75','#F59E0B','#EC4899','#3B82F6','#8B5CF6']
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width, y: -10 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 5 + Math.random() * 6, rot: Math.random() * 360, drot: (Math.random() - 0.5) * 8,
  }))
  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.rot += p.drot; p.vy += 0.06
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180)
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    frame++
    if (frame < 120) requestAnimationFrame(animate)
    else document.body.removeChild(canvas)
  }
  animate()
}

interface AddGoalForm { name: string; target_amount: string; deadline: string; color: string }
interface AddFundsForm { goalId: string; amount: string }

export default function GoalsPage() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [addFunds, setAddFunds] = useState<AddFundsForm | null>(null)
  const [form, setForm] = useState<AddGoalForm>({ name: '', target_amount: '', deadline: '', color: '#534AB7' })
  const [saving, setSaving] = useState(false)

  async function fetchGoals() {
    const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
    setGoals((data as Goal[]) || [])
    setLoading(false)
  }

  useEffect(() => { fetchGoals() }, [])

  async function handleAddGoal() {
    if (!form.name || !form.target_amount || saving) return
    setSaving(true)
    await supabase.from('goals').insert({
      name: form.name.trim(),
      target_amount: parseFloat(form.target_amount),
      current_amount: 0,
      deadline: form.deadline || null,
      owner: 'both',
      color: form.color,
    })
    await fetchGoals()
    setForm({ name: '', target_amount: '', deadline: '', color: '#534AB7' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleAddFunds() {
    if (!addFunds || !addFunds.amount || saving) return
    setSaving(true)
    const goal = goals.find(g => g.id === addFunds.goalId)
    if (!goal) return
    const newAmount = Number(goal.current_amount) + parseFloat(addFunds.amount)
    await supabase.from('goals').update({ current_amount: newAmount }).eq('id', addFunds.goalId)
    await fetchGoals()
    if (newAmount >= Number(goal.target_amount)) launchConfetti()
    setAddFunds(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0)

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
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowForm(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-lg font-light"
          style={{ backgroundColor: user?.color || '#534AB7' }}
        >
          +
        </motion.button>
      </div>

      {/* Total wealth banner */}
      {totalSaved > 0 && (
        <motion.div
          custom={0} variants={fadeUp} initial="hidden" animate="visible"
          className="rounded-3xl p-5 mb-4"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.3)' }}>what you&apos;ve kept</p>
          <p className="text-3xl font-semibold tracking-tight" style={{ color: '#534AB7' }}>{formatCurrency(totalSaved)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.35)' }}>
            every dollar here is a piece of your future you own
          </p>
        </motion.div>
      )}

      {/* Hint for empty state */}
      {goals.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 mb-4"
          style={{ backgroundColor: 'rgba(83,74,183,0.06)', border: '1px solid rgba(83,74,183,0.12)' }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: '#534AB7' }}>treat savings like rent</p>
          <p className="text-xs" style={{ color: 'rgba(0,0,0,0.45)' }}>
            Create a goal and add to it every month before you spend. Even $5 counts — the habit matters more than the amount.
          </p>
        </motion.div>
      )}

      {/* Goals grid */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {goals.map((goal, i) => {
            const current = Number(goal.current_amount)
            const target = Number(goal.target_amount)
            const pct = target > 0 ? Math.min(current / target, 1) : 0
            const goalColor = goal.color || '#534AB7'
            const isComplete = pct >= 1

            return (
              <motion.div
                key={goal.id}
                custom={i} variants={fadeUp} initial="hidden" animate="visible"
                className="relative rounded-3xl p-4 overflow-hidden"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <ShineBorder shineColor={goalColor} duration={16} />

                <button onClick={() => handleDelete(goal.id)} className="absolute top-3 right-3" style={{ color: 'rgba(0,0,0,0.2)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>

                <p className="text-sm font-medium mb-2 pr-4" style={{ color: '#1A1A1A', lineHeight: 1.3 }}>{goal.name}</p>

                <div className="w-full h-1.5 rounded-full mb-2" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                  <motion.div
                    className="h-1.5 rounded-full"
                    style={{ backgroundColor: isComplete ? '#1D9E75' : goalColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>

                <p className="text-xs font-semibold" style={{ color: isComplete ? '#1D9E75' : '#1A1A1A' }}>
                  {formatCurrency(current)}
                </p>
                <p className="text-[10px]" style={{ color: 'rgba(0,0,0,0.35)' }}>of {formatCurrency(target)}</p>

                {goal.deadline && (
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(0,0,0,0.3)' }}>
                    by {new Date(goal.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                )}

                {isComplete ? (
                  <p className="text-[10px] mt-2 font-medium" style={{ color: '#1D9E75' }}>complete! 🎉</p>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setAddFunds({ goalId: goal.id, amount: '' })}
                    className="mt-2 text-[10px] px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: goalColor + '18', color: goalColor }}
                  >
                    + add
                  </motion.button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add Goal Sheet */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="fixed inset-0 z-[200] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)}>
            <motion.div className="bg-white rounded-t-3xl p-6 w-full max-w-md max-h-[82vh] overflow-y-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }} onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl" style={{ fontFamily: 'var(--font-serif)' }}>new savings goal</h3>
                <button onClick={() => setShowForm(false)} style={{ color: 'rgba(0,0,0,0.32)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>what are you saving for?</label>
              <input type="text" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Japan trip, emergency fund"
                className="w-full px-4 py-3 rounded-2xl mb-4 outline-none text-sm"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }}
                autoFocus />

              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>target amount</label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
                <span style={{ color: 'rgba(0,0,0,0.35)' }}>$</span>
                <input type="number" inputMode="decimal" value={form.target_amount}
                  onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                  placeholder="0.00"
                  className="flex-1 text-2xl font-semibold bg-transparent outline-none" style={{ color: '#1A1A1A' }} />
              </div>

              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>deadline (optional)</label>
              <input type="date" value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl mb-4 outline-none text-sm"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: '#1A1A1A' }} />

              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>color</label>
              <div className="flex flex-wrap gap-2 mb-6">
                {GOAL_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-8 h-8 rounded-full transition-transform"
                    style={{ backgroundColor: c, border: form.color === c ? '2.5px solid #FFFFFF' : '2.5px solid transparent', boxShadow: form.color === c ? `0 0 0 2px ${c}` : '0 1px 3px rgba(0,0,0,0.08)' }} />
                ))}
              </div>

              <button onClick={handleAddGoal} disabled={!form.name || !form.target_amount || saving}
                className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: form.color }}>
                {saving ? 'saving…' : 'create goal'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Funds Sheet */}
      <AnimatePresence>
        {addFunds && (
          <motion.div className="fixed inset-0 z-[200] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddFunds(null)}>
            <motion.div className="bg-white rounded-t-3xl p-6 w-full max-w-md max-h-[82vh] overflow-y-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }} onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl" style={{ fontFamily: 'var(--font-serif)' }}>add to savings</h3>
                <button onClick={() => setAddFunds(null)} style={{ color: 'rgba(0,0,0,0.32)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {(() => {
                const goal = goals.find(g => g.id === addFunds.goalId)
                return goal ? (
                  <p className="text-sm mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{goal.name}</span>
                    {' '}· {formatCurrency(Number(goal.current_amount))} / {formatCurrency(Number(goal.target_amount))}
                  </p>
                ) : null
              })()}

              <label className="text-[10px] uppercase tracking-widest mb-2 block" style={{ color: 'rgba(0,0,0,0.3)' }}>amount</label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-6" style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
                <span style={{ color: 'rgba(0,0,0,0.35)' }}>$</span>
                <input type="number" inputMode="decimal" value={addFunds.amount}
                  onChange={e => setAddFunds(f => f ? { ...f, amount: e.target.value } : f)}
                  placeholder="0.00"
                  className="flex-1 text-2xl font-semibold bg-transparent outline-none" style={{ color: '#1A1A1A' }} autoFocus />
              </div>

              <button onClick={handleAddFunds} disabled={!addFunds.amount || saving}
                className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: user?.color || '#534AB7' }}>
                {saving ? 'saving…' : 'add to savings'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
