import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text, user, userName, today } = await req.json()
  if (!text?.trim()) return NextResponse.json({ actions: [], message: '' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not set' }, { status: 500 })

  const system = `You are a finance assistant for a couples' app used by Yihan and Sun.
Parse the user's natural language command and return a JSON object with finance actions to execute.

Today's date: ${today}
Current user identity: ${user} (display name: ${userName})

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{
  "actions": [...],
  "message": "brief friendly confirmation"
}

Action types (use only these):
{ "type": "add_expense", "data": { "amount": number, "description": "string", "category": "food & dining"|"rent & utilities"|"transport"|"shopping"|"health"|"entertainment"|"travel"|"subscriptions"|"other", "date": "YYYY-MM-DD", "paid_by": "yihan"|"sun", "split": "even"|"yihan"|"sun", "note": "string or empty" } }
{ "type": "add_income", "data": { "amount": number, "source": "string", "type": "salary"|"freelance"|"investment"|"gift"|"other", "date": "YYYY-MM-DD", "owner": "yihan"|"sun", "recurring": boolean } }
{ "type": "set_budget", "data": { "category": "food & dining"|"rent & utilities"|"transport"|"shopping"|"health"|"entertainment"|"travel"|"subscriptions"|"other", "monthly_limit": number, "owner": "yihan"|"sun"|"shared" } }
{ "type": "add_goal", "data": { "name": "string", "target_amount": number, "deadline": "YYYY-MM-DD"|null, "owner": "yihan"|"sun"|"both" } }

Rules:
- "we/us/together/split" → split="even", paid_by = current user ("${user}")
- "I paid" → paid_by = current user ("${user}")
- "Sun paid" / "Yihan paid" → paid_by accordingly
- Category inference: "dinner/lunch/coffee/food/restaurant/grocery" → "food & dining"; "uber/taxi/bus/train/transport/grab" → "transport"; "rent/electric/water/wifi/utilities" → "rent & utilities"; "netflix/spotify/subscription" → "subscriptions"; "gym/doctor/medicine/health" → "health"; "movie/concert/entertainment" → "entertainment"; "flight/hotel/travel" → "travel"; "clothes/shoes/amazon/shopping" → "shopping"; otherwise "other"
- Relative dates: "today" → ${today}; "yesterday" → one day before ${today}; "last night" → yesterday; resolve "this [weekday]" and "last [weekday]" relative to ${today}
- For income: "my salary/paycheck" → type="salary", owner=current user; "freelance/side job" → type="freelance"; "interest/dividend/stocks" → type="investment"; "gift/birthday money" → type="gift"
- note field: use empty string "" if nothing extra to note
- message: short, friendly, 1 sentence — e.g. "Added $45 dinner split with Sun!"
- If unclear or unrelated, return { "actions": [], "message": "didn't quite catch that — try: 'we spent $50 on dinner' or 'I got paid $3000 salary'" }`

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
