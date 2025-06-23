import { StreamingTextResponse, OpenAIStream, Message } from 'ai';
import OpenAI from 'openai';

// Initialize OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure to set this in Vercel env vars
});

export const runtime = 'edge'; // Enables streaming on Vercel edge

export async function POST(req: Request) {
  const body = await req.json();
  const messages = body.messages as Message[];

  // Optional: pass in a transcript if used for summarization or generation
  const transcript = body.transcript || '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    stream: true,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful assistant that summarizes transcripts and creates user stories with relevant tags when asked.',
      },
      ...messages,
      ...(transcript
        ? [
            {
              role: 'user',
              content: `Here is the transcript content:\n\n${transcript}`,
            },
          ]
        : []),
    ],
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
