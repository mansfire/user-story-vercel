import { NextRequest } from 'next/server';
import { OpenAI } from 'openai';
import { StreamingTextResponse } from 'ai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = body.messages;
  const transcript = body.transcript;

  const userMessage = messages[messages.length - 1].content.toLowerCase();
  const isGenerate = userMessage.includes('generate');
  const isSummarize = userMessage.includes('summarize');

  const finalMessages = [
    ...(isGenerate || isSummarize
      ? [
          {
            role: 'system',
            content: isSummarize
              ? 'You are a helpful assistant that summarizes transcripts.'
              : 'You are a product assistant that converts feedback into tagged user stories. Output should be a JSON list of objects with "story" and "tags".',
          },
          {
            role: 'user',
            content: transcript,
          },
        ]
      : []),
    ...messages,
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: finalMessages,
    temperature: 0.4,
    stream: true,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of response) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) {
          controller.enqueue(encoder.encode(token));
        }
      }
      controller.close();
    },
  });

  return new StreamingTextResponse(stream);
}
