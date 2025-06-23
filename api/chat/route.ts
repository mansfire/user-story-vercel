import { StreamingTextResponse, OpenAIStream } from 'next/ai';
import { OpenAI } from 'openai';

export const runtime = 'edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { messages, transcript } = await req.json();

  const systemPrompt = `You are a helpful assistant that takes feedback transcripts and produces summaries and user stories. Output JSON if generating user stories.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    stream: true,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
    ],
    temperature: 0.4,
    max_tokens: 1000,
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
