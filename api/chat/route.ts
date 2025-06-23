import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';

// Optional: use environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '', // 👈 or hardcode your key here (not recommended)
});

export const runtime = 'edge'; // use Vercel's Edge Runtime for speed

export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    stream: true,
    messages,
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
