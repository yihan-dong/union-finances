import { NextRequest, NextResponse } from 'next/server'

// ── New moon calculator ────────────────────────────────────
// Known new moon: 6 Jan 2000 18:14 UTC. Synodic period ≈ 29.530589 days.
function upcomingNewMoons(fromDateStr: string, count = 14): string[] {
  const KNOWN_NM_MS = new Date('2000-01-06T18:14:00Z').getTime()
  const SYNODIC_MS  = 29.530588853 * 24 * 60 * 60 * 1000
  const fromMs      = new Date(fromDateStr + 'T00:00:00Z').getTime()

  const n0    = Math.ceil((fromMs - KNOWN_NM_MS) / SYNODIC_MS)
  const dates: string[] = []
  let   n     = n0

  while (dates.length < count) {
    const ms   = KNOWN_NM_MS + n * SYNODIC_MS
    const date = new Date(ms).toISOString().slice(0, 10)
    if (ms >= fromMs) dates.push(date)
    n++
  }
  return dates
}

// ── Route ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const {
    text,
    user,
    userName,
    today,
    viewMonth,
    viewYear,
    currentBudgets  = [],
    lastMonthBudgets = [],
  } = await req.json()

  if (!text?.trim()) return NextResponse.json({ actions: [], message: '' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not set' }, { status: 500 })

  const lastM    = viewMonth === 1 ? 12 : viewMonth - 1
  const lastY    = viewMonth === 1 ? viewYear - 1 : viewYear
  const newMoons = upcomingNewMoons(today, 14)

  // Format budget lists for the prompt
  const fmtBudgets = (rows: { category: string; monthly_limit: number; month: number; year: number }[]) =>
    rows.length === 0
      ? '  (none)'
      : rows.map(b => `  ${b.category}: $${Number(b.monthly_limit).toFixed(0)}`).join('\n')

  const system = `You are a smart finance assistant for a couples' app used by Yihan and Sun. They share all finances — everything is household money.

Parse the user's natural language command and return a JSON object with the actions to execute.

Today's date: ${today}
Viewing: ${viewMonth}/${viewYear}
Current user: ${user} (display name: ${userName})

Current month budgets (${viewMonth}/${viewYear}):
${fmtBudgets(currentBudgets)}

Last month budgets (${lastM}/${lastY}):
${fmtBudgets(lastMonthBudgets)}

Upcoming new moon dates (next 14):
${newMoons.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}

Return ONLY valid JSON — no markdown, no explanation:
{
  "actions": [...],
  "message": "brief friendly confirmation"
}

Action types (use only these):

{ "type": "add_expense", "data": { "amount": number, "description": "string", "category": "food & dining"|"rent & utilities"|"transport"|"shopping"|"health"|"entertainment"|"travel"|"subscriptions"|"other", "date": "YYYY-MM-DD", "paid_by": "yihan"|"sun"|"both", "bucket": "utility"|"status", "currency": "USD"|"KHR", "note": "" } }

{ "type": "add_income", "data": { "amount": number, "source": "string", "type": "salary"|"freelance"|"investment"|"gift"|"other", "date": "YYYY-MM-DD", "owner": "yihan"|"sun", "recurring": boolean } }

{ "type": "set_budget", "data": { "category": "food & dining"|"rent & utilities"|"transport"|"shopping"|"health"|"entertainment"|"travel"|"subscriptions"|"other", "monthly_limit": number, "month": number, "year": number } }

{ "type": "add_goal", "data": { "name": "string", "target_amount": number, "deadline": "YYYY-MM-DD"|null } }

{ "type": "add_event", "data": { "title": "string", "date": "YYYY-MM-DD", "start_time": "HH:MM"|"", "end_time": "HH:MM"|"", "owner": "yihan"|"sun"|"sokim"|"sambath"|"both" } }

Rules:

BUDGETS:
- "same as last month" / "copy last month" / "keep the same" → look at the last month budgets above and emit one set_budget per category, using the same monthly_limit values, for month=${viewMonth} year=${viewYear}
- If last month budgets are empty, say so in the message
- set_budget must always include month and year

EXPENSES:
- paid_by: "I paid" / unspecified → current user ("${user}"); "Sun paid" → "sun"; "Yihan paid" → "yihan"; "we paid" / "both" → "both"
- currency: "40,000 riel" / "KHR" → amount=40000, currency="KHR"; default="USD"
- bucket: default "utility"; luxury/impression spending → "status"
- Category: dinner/food/coffee/restaurant/grocery → "food & dining"; uber/taxi/grab/fuel → "transport"; rent/electric/water/wifi → "rent & utilities"; netflix/spotify → "subscriptions"; gym/doctor/medicine → "health"; movie/concert/bar → "entertainment"; flight/hotel/airbnb → "travel"; clothes/shoes/amazon → "shopping"
- Relative dates: "today" → ${today}; "yesterday" → day before; "last night" → yesterday

EVENTS:
- "anniversary", "new moon", "birthday", "reminder", "date night", "appointment" → add_event
- "every new moon for X months" → generate X add_event actions using the new moon dates listed above (pick the first X from the list)
- "next N new moons" → N events on the next N new moon dates
- For anniversaries/recurring events use owner="both"
- start_time and end_time can be "" if not specified

INCOME:
- "salary/paycheck" → type="salary", owner=current user
- "freelance/side job" → type="freelance"

GOALS:
- "save for X" / "goal" → add_goal

MESSAGE:
- Short and friendly (1 sentence, no emojis)
- For bulk actions (e.g. 10 events), summarise: "Added 10 new moon anniversaries from [first date] to [last date]"

If completely unclear: { "actions": [], "message": "didn't catch that — try: 'spent $50 on dinner' or 'copy last month budget'" }`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: text }],
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ actions: [], message: 'something went wrong — try again' }, { status: 500 })
  }

  const data = await response.json()
  const raw: string = data.content?.[0]?.text ?? ''

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ actions: [], message: "couldn't parse that — try again" })
  }
}
