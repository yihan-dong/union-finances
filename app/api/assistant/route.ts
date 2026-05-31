import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, context, image, mimeType } = await req.json()
  if (!message && !image) return NextResponse.json({ reply: 'No message provided.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ reply: 'API not configured.' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `You are a sharp, friendly financial assistant for a couple using the Union Finances app in Phnom Penh, Cambodia. Help them understand spending, save money, and make smart financial decisions.

Today: ${today}
Currency: USD and KHR (Khmer Riel). 1 USD ≈ 4,100 KHR.

Their financial data this month:
${context || 'No data loaded yet — answer generally.'}

Guidelines:
- Be concise and conversational — 2–4 sentences unless they want detail
- Use their actual numbers when relevant
- Give specific, actionable advice
- If they share a photo, identify the product and estimate Cambodia market price
- No generic platitudes — be direct and honest
- If data is missing just say so`

  const userContent: { type: string; [key: string]: unknown }[] = []

  if (image && mimeType) {
    if (mimeType === 'application/pdf') {
      userContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: image },
      })
    } else {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: image },
      })
    }
  }

  userContent.push({
    type: 'text',
    text: message || 'What is this and what would it cost in Phnom Penh, Cambodia?',
  })

  try {
    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }

    // Only add PDF beta if we're sending a PDF
    if (mimeType === 'application/pdf') {
      headers['anthropic-beta'] = 'pdfs-2024-09-25'
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[assistant] API error', response.status, err)
      return NextResponse.json(
        { reply: `API error ${response.status} — check Vercel logs.` },
        { status: 500 },
      )
    }

    const data = await response.json()
    const textBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === 'text')
    const reply = textBlocks.map((b: { text: string }) => b.text).join('\n').trim()
      || "I couldn't generate a response."
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[assistant] exception:', err)
    return NextResponse.json({ reply: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
