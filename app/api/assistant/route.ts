import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, context, history, image, mimeType } = await req.json()
  if (!message && !image) return NextResponse.json({ reply: 'No message provided.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ reply: 'API not configured.' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `You are the financial mind inside Union Finances — a sharp, honest money advisor for Yihan and Sun in Phnom Penh, Cambodia.

You know their actual numbers: income sources, spending by category, savings rate, goals, and patterns. You use their data to give specific, real advice — not generic financial tips.

Today: ${today}
Exchange rate: 1 USD ≈ 4,100 KHR

Their financial picture right now:
${context || 'No data loaded yet — answer generally.'}

How to respond:
- Direct and clear. Give specific numbers when you can.
- Notice patterns (overspending, missed savings, goal progress) and call them out.
- 2–4 sentences unless they want a breakdown.
- You remember what was said earlier in this conversation.
- Both Yihan and Sun use this app. Tailor to whoever is asking when relevant.`

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

  const priorTurns = Array.isArray(history) ? history : []
  const messages = [
    ...priorTurns.map((m: { role: string; text: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: [{ type: 'text', text: m.text }],
    })),
    { role: 'user' as const, content: userContent },
  ]

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
        messages,
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
