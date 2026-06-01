import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { pdf } = await req.json()
  if (!pdf) return NextResponse.json({ error: 'No PDF provided', transactions: [] }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not set', transactions: [] }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
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
                text: `You are reading a bank statement. This is likely an ABA Bank statement from Cambodia, which may contain both USD and KHR (Khmer Riel) transactions, dates in DD/MM/YYYY or MM/DD/YYYY format, and Khmer script alongside English.

Today's date: ${today}

Extract EVERY transaction listed in the statement. Return ONLY valid JSON — no markdown, no code blocks, no explanation.

Return this exact format:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "clean merchant or purpose",
      "amount": <positive number, never negative>,
      "currency": "USD" or "KHR",
      "type": "debit" or "credit",
      "category": "<category>",
      "bucket": "utility" or "status"
    }
  ]
}

Rules for type:
- "debit" = money going OUT of the account (withdrawal, payment, purchase, transfer out)
- "credit" = money coming IN to the account (deposit, salary, transfer in, refund)
- Amount is always a POSITIVE number regardless of type

Rules for currency:
- If the column or value shows USD, $, or decimal amounts like 45.00 → "USD"
- If the column or value shows KHR, ៛, Riel, or large whole numbers like 40,000 or 180,000 → "KHR"
- Return the raw amount as shown (do NOT convert between currencies)

Rules for date:
- Convert DD/MM/YYYY → YYYY-MM-DD
- Convert MM/DD/YYYY → YYYY-MM-DD
- Use today's date (${today}) if the date is completely unreadable

Rules for description:
- Remove transaction reference codes (e.g. TXN123, REF456, AUTH789)
- Remove trailing asterisks or slashes
- Keep the merchant name, person name, or purpose
- If only Khmer text is present, transliterate or translate it briefly

Rules for category (pick one):
- food & dining → restaurant, cafe, food delivery, bakery, supermarket, grocery, market
- transport → Grab, taxi, fuel, parking, tuk-tuk, bus
- rent & utilities → rent, electricity, water, wifi, internet, phone bill, ABA fee
- shopping → clothes, shoes, Amazon, Shopee, mall, electronics
- health → pharmacy, clinic, hospital, gym, dentist
- entertainment → cinema, bar, club, concert, game
- travel → flight, hotel, Airbnb, Booking.com
- subscriptions → Netflix, Spotify, Apple, Google, app store
- other → bank transfers, ATM withdrawal, unknown

Rules for bucket:
- "utility" = practical/essential (food, transport, bills, rent, health, groceries)
- "status" = luxury/non-essential/for impressing others (luxury brands, bars, expensive restaurants, gifts)

Important:
- Include ALL transaction rows — do not skip any
- Skip header rows, opening balance, closing balance, and fee summary lines (those are not real transactions)
- If a statement has 50 transactions, return all 50
- Always return valid JSON even if you can only parse some transactions`,
              },
            ],
          },
        ],
      }),
    })
  } catch (fetchErr) {
    console.error('[import] fetch error:', fetchErr)
    return NextResponse.json({ error: 'Network error calling AI', transactions: [] }, { status: 500 })
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown')
    console.error('[import] Anthropic API error:', response.status, errText)
    return NextResponse.json({ error: `AI API error ${response.status}`, transactions: [] }, { status: 500 })
  }

  let data: { content?: { type: string; text: string }[] }
  try {
    data = await response.json()
  } catch (parseErr) {
    console.error('[import] failed to parse Anthropic response:', parseErr)
    return NextResponse.json({ error: 'Failed to parse AI response', transactions: [] }, { status: 500 })
  }

  const raw: string = data.content?.[0]?.text ?? ''

  if (!raw) {
    console.error('[import] empty response from AI, full data:', JSON.stringify(data))
    return NextResponse.json({ error: 'Empty AI response', transactions: [] }, { status: 422 })
  }

  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[import] no JSON object found in response:', raw.slice(0, 500))
      return NextResponse.json({ error: 'No JSON in response', transactions: [], raw: raw.slice(0, 200) }, { status: 422 })
    }
    const parsed = JSON.parse(jsonMatch[0])
    const transactions = parsed.transactions ?? []
    console.log(`[import] extracted ${transactions.length} transactions`)
    return NextResponse.json({ transactions })
  } catch (jsonErr) {
    console.error('[import] JSON parse error:', jsonErr, 'raw:', raw.slice(0, 500))
    return NextResponse.json({ error: 'Could not parse transactions', transactions: [], raw: raw.slice(0, 200) }, { status: 422 })
  }
}
