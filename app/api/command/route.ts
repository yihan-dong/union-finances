import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text, user, userName, today } = await req.json()
  if (!text?.trim()) return NextResponse.json({ actions: [], message: '' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not set' }, { status: 500 })

  const system = `You are a finance assistant for a couples' app used by Yihan and Sun. They share all finances — there is no splitting or owing each other. Everything is household money.

Parse the user's natural language command and return a JSON object with finance actions to execute.

Today's date: ${today}
Current user: ${user} (display name: ${userName})

Return ONLY valid JSON — no markdown, no explanation:
{
  "actions": [...],
  "message": "brief friendly confirmation"
}

Action types (use only these):
{ "type": "add_expense", "data": { "amount": number, "description": "string", "category": "food & dining"|"rent & utilities"|"transport"|"shopping"|"health"|"entertainment"|"travel"|"subscriptions"|"other", "date": "YYYY-MM-DD", "paid_by": "yihan"|"sun"|"both", "bucket": "utility"|"status", "currency": "USD"|"KHR", "note": "" } }
{ "type": "add_income", "data": { "amount": number, "source": "string", "type": "salary"|"freelance"|"investment"|"gift"|"other", "date": "YYYY-MM-DD", "owner": "yihan"|"sun", "recurring": boolean } }
{ "type": "set_budget", "data": { "category": "food & dining"|"rent & utilities"|"transport"|"shopping"|"health"|"entertainment"|"travel"|"subscriptions"|"other", "monthly_limit": number } }
{ "type": "add_goal", "data": { "name": "string", "target_amount": number, "deadline": "YYYY-MM-DD"|null } }

Rules:
- paid_by: "I paid" or unspecified → current user ("${user}"); "Sun paid" → "sun"; "Yihan paid" → "yihan"; "we paid" / "we both" / "household" / "both of us" → "both"
- currency: "40,000 riel" / "40k riel" / "₭40,000" / "KHR 40000" → amount=40000, currency="KHR"; default currency="USD" if not specified
- bucket: default to "utility" unless the expense is for impressing others or not for household benefit → "status"
  - "utility" (for us) examples: groceries, rent, electricity, medicine, transport, gym, work tools, meals at home
  - "status" (for others) examples: luxury brand gifts, fancy restaurant to impress clients/others, expensive gadget for show, designer clothes to impress
- Category inference: "dinner/lunch/coffee/food/restaurant/grocery/supermarket" → "food & dining"; "uber/taxi/bus/train/grab/fuel" → "transport"; "rent/electric/water/wifi/utilities" → "rent & utilities"; "netflix/spotify/subscription" → "subscriptions"; "gym/doctor/medicine/pharmacy" → "health"; "movie/concert/bar/entertainment" → "entertainment"; "flight/hotel/airbnb/travel" → "travel"; "clothes/shoes/amazon/shopping" → "shopping"; otherwise "other"
- Relative dates: "today" → ${today}; "yesterday" → one day before; "last night" → yesterday
- For income: "my salary/paycheck" → type="salary", owner=current user; "freelance/side job" → type="freelance"; "investment/dividend" → type="investment"; "gift" → type="gift"
- note: always empty string ""
- message: short, friendly, 1 sentence — e.g. "Logged $45 groceries 🏠"
- If unclear: return { "actions": [], "message": "didn't catch that — try: 'we spent $50 on dinner' or 'Sun got paid $2000'" }`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
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
