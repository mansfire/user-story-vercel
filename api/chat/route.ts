import OpenAI from 'openai';

export const runtime = 'edge'; // Vercel Edge Function

export async function POST(req: Request): Promise<Response> {
  const { messages, transcript } = await req.json();

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!, // Only safe inside the handler in Edge Runtime
  });

  const chatMessages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that summarizes transcripts and creates user stories.',
    },
    ...messages,
  ];

  if (transcript) {
    chatMessages.push({
      role: 'user',
      content: `Here is the transcript:\n${transcript}`,
    });
  }

  const stream = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    stream: true,
    messages: chatMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) {
          controller.enqueue(encoder.encode(token));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
