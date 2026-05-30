import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { image, mimeType } = await req.json()
  if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not set' }, { status: 500 })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
        },
      ],
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
              text: `Look at this product image carefully. Identify what the product is (brand, model, type, size/specs if visible).

Then use web_search to find the current retail price of this exact product (or the closest match) available in Cambodia — search for prices in Phnom Penh markets, Aeon Mall, online shops like Shopee Cambodia, or local stores.

Search queries to try: "[product name] price Cambodia", "[product name] price Phnom Penh", "[product name] site:shopee.com.kh"

After searching, return ONLY valid JSON — no markdown, no explanation:
{
  "product": "<identified product name, brand, model>",
  "priceRange": "<price range found, e.g. '$15–$25' or '₭60,000–₭100,000' or 'KHR 80,000'>",
  "verdict": "good deal" | "fair price" | "overpriced" | "unknown",
  "advice": "<1–2 sentence practical buying advice for Cambodia — mention if better to buy locally vs import, where to find it>",
  "sources": ["<brief source name, e.g. 'Shopee Cambodia', 'Aeon Mall'>"]
}

If you cannot identify the product, set product to your best guess and verdict to "unknown".`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('price-check API error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  const data = await response.json()

  // Find the last text block (after potential tool use rounds)
  let raw = ''
  for (const block of (data.content || []).reverse()) {
    if (block.type === 'text') {
      raw = block.text
      break
    }
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Could not parse result', raw }, { status: 422 })
  }
}
