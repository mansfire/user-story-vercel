
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const runtime = 'edge';

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body;

  // Choose system prompt based on user message content
  const firstUserMessage = messages.find(m => m.role === 'user')?.content?.toLowerCase() || '';
  let systemPrompt = '';

  if (firstUserMessage.includes('summarize')) {
    systemPrompt = 'You are a product assistant that summarizes transcripts clearly and concisely.';
  } else {
    systemPrompt = 'You are a product assistant that converts user feedback into a list of user stories in JSON format with 1–3 tags.';
  }

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
    temperature: 0.3,
    max_tokens: 1000,
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
