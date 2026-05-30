import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { pdf } = await req.json()
  if (!pdf) return NextResponse.json({ transactions: [] }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ transactions: [] }, { status: 500 })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdf,
                },
              },
              {
                type: 'text',
                text: `You are reading an ABA bank statement from Cambodia. Extract ALL transactions and return ONLY valid JSON — no markdown, no explanation.

Return this exact format:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "clean merchant/description name",
      "amount": <positive number>,
      "currency": "USD" or "KHR",
      "type": "debit" or "credit",
      "category": <one of: food & dining|rent & utilities|transport|shopping|health|entertainment|travel|subscriptions|other>,
      "bucket": "utility" or "status"
    }
  ]
}

Rules:
- debit = money out (expense). credit = money in (income/transfer).
- USD amounts: decimal numbers like 45.00 or 1,234.56
- KHR amounts: large whole numbers like 40,000 or 180,000
- Clean descriptions: remove reference codes (REF123, TXN456), keep merchant/purpose
- Category inference: restaurant/food/market/grocery → food & dining; grab/taxi/fuel → transport; rent/electric/water/wifi → rent & utilities; netflix/subscription → subscriptions; gym/pharmacy/hospital → health; movie/bar/entertainment → entertainment; flight/hotel → travel; clothes/amazon → shopping; otherwise → other
- bucket: utility for practical/essential spending, status for luxury/non-essential
- Skip opening balance, closing balance, and fee summary rows — only real transactions
- If date format is DD/MM/YYYY convert to YYYY-MM-DD`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ transactions: [] }, { status: 500 })
    }

    const data = await response.json()
    const raw: string = data.content?.[0]?.text ?? ''

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ transactions: [] }, { status: 500 })
  }
}
