import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, context, image, mimeType } = await req.json()
  if (!message && !image) return NextResponse.json({ reply: 'No message provided.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ reply: 'API not configured.' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `You are a friendly, sharp financial assistant for a couple using the Union Finances app in Phnom Penh, Cambodia. You help them understand their spending, save money, and make smart financial decisions.

Today: ${today}
Currency context: They use both USD and KHR (Khmer Riel). 1 USD ≈ 4,100 KHR.

Their financial context this month:
${context || 'No financial data available yet.'}

Guidelines:
- Be concise and direct — 2-4 sentences max unless they ask for detail
- Use specific numbers from their data when relevant
- Give actionable advice, not generic platitudes
- If they share a photo of a product, identify it and give a Cambodia price estimate
- Speak naturally, not formally
- You can be slightly playful but stay focused on finances
- If you don't have enough data to answer, say so honestly`

  const userContent: { type: string; [key: string]: unknown }[] = []

  if (image && mimeType) {
    if (mimeType === 'application/pdf') {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: image } })
    } else {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: image } })
    }
  }

  if (message) {
    userContent.push({ type: 'text', text: message })
  } else if (image) {
    userContent.push({ type: 'text', text: 'What is this product and what would it cost in Phnom Penh, Cambodia? Is it a good deal?' })
  }

  try {
    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }

    // Add web search for price queries
    const isLikelyPriceQuery = !!image || message?.toLowerCase().includes('price') || message?.toLowerCase().includes('cost') || message?.toLowerCase().includes('buy') || message?.toLowerCase().includes('cheap')
    if (isLikelyPriceQuery) {
      headers['anthropic-beta'] = 'web-search-2025-03-05'
    }

    const tools = isLikelyPriceQuery ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }] : undefined

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[assistant] API error:', err)
      return NextResponse.json({ reply: "I couldn't process that right now. Try again?" }, { status: 500 })
    }

    const data = await response.json()
    // Extract text from response (handle tool use blocks)
    const textBlocks = data.content?.filter((b: { type: string }) => b.type === 'text') ?? []
    const reply = textBlocks.map((b: { text: string }) => b.text).join('\n').trim() || "I couldn't generate a response."
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[assistant] error:', err)
    return NextResponse.json({ reply: "Something went wrong. Try again." }, { status: 500 })
  }
}
