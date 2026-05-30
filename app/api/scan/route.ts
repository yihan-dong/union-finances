import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { image, mimeType } = await req.json()
  if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not set' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: image },
            },
            {
              type: 'text',
              text: `You are reading a receipt or invoice. Extract the key details and return ONLY valid JSON — no markdown, no explanation.

Today's date: ${today}

Return this exact format:
{
  "amount": <number, total amount paid>,
  "description": "<what was bought — focus on the items/service purchased, not just the merchant. E.g. 'coffee & croissant', 'groceries', 'taxi ride', 'dinner for two'. If specific items are visible on the receipt, name them briefly. Keep under 30 chars.>",
  "category": "<one of: food & dining | rent & utilities | transport | shopping | health | entertainment | travel | subscriptions | other>",
  "date": "<YYYY-MM-DD, use today if not visible>",
  "bucket": "<utility or status — utility means practical/essential for your household life, status means spending to impress others or pure luxury>",
  "currency": "<USD or KHR>"
}

Currency rules: If the receipt shows Khmer Riel amounts (large numbers, ៛ symbol, KHR, or "Riel"), set "currency": "KHR" and return the raw KHR amount. Otherwise set "currency": "USD".

Category rules: restaurant/cafe/food delivery → "food & dining"; grocery/supermarket → "food & dining"; electricity/water/wifi/rent → "rent & utilities"; grab/taxi/fuel/parking → "transport"; clothes/shoes/amazon → "shopping"; gym/pharmacy/hospital → "health"; cinema/event/bar → "entertainment"; flight/hotel/airbnb → "travel"; netflix/spotify/app subscription → "subscriptions"; otherwise → "other".

If you cannot read the receipt clearly, return your best guess. Always return valid JSON.`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to scan receipt' }, { status: 500 })
  }

  const data = await response.json()
  const raw: string = data.content?.[0]?.text ?? ''

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Could not parse receipt' }, { status: 422 })
  }
}
