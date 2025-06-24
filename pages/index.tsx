'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [firefliesList, setFirefliesList] = useState<{ id: string; title: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const transcriptRef = useRef<string>('');
  const storiesRef = useRef<any[]>([]);

  useEffect(() => {
    // Fetch Fireflies transcripts on mount
    fetch('/api/fireflies')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const parsed = data.map((item: any) => ({ id: item.id, title: item.title }));
          setFirefliesList(parsed);
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userMessage = input.trim().toLowerCase();
    if (!userMessage) return;

    setMessages((prev) => [...prev, `🧑 You: ${userMessage}`]);
    setInput('');
    setLoading(true);

    let body: any = { messages: [{ role: 'user', content: userMessage }] };
    if (userMessage.includes('generate') || userMessage.includes('summarize')) {
      body.transcript = transcriptRef.current;
    }
    
    const res = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
      headers: { 'Content-Type': 'application/json' },
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '🤖 Assistant: ';
    setMessages((prev) => [...prev, assistantMessage]);

    let fullContent = '';
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullContent += chunk;
        setMessages((prev) => [...prev.slice(0, -1), assistantMessage + fullContent]);
      }
    }

    if (userMessage.includes('generate')) {
      try {
        const start = fullContent.indexOf('[');
        const end = fullContent.lastIndexOf(']') + 1;
        const parsed = JSON.parse(fullContent.slice(start, end));
        storiesRef.current = parsed;
      } catch (e) {
        console.warn('Could not parse stories:', e);
      }
    }

    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const text = await res.text();
    transcriptRef.current = text;
    setMessages((prev) => [...prev, '📄 Transcript loaded from upload.']);
  };

  const handleLoadFireflies = async () => {
    if (!selectedId) return;

    const res = await fetch(`/api/fireflies?id=${selectedId}`);
    const text = await res.text();
    transcriptRef.current = text;
    setMessages((prev) => [...prev, `📎 Transcript "${selectedId}" loaded from Fireflies.`]);
  };

  const handleDownloadCSV = () => {
    const rows = storiesRef.current;
    const csv = [
      'story,tags',
      ...rows.map((r) => `"${r.story}","${r.tags.join(', ')}"`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_stories.csv';
    a.click();
  };

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">💬 User Story Assistant</h1>

      <div className="mb-6">
        <label className="block font-medium mb-1">📄 Upload Feedback File:</label>
        <input type="file" onChange={handleUpload} className="mb-2" />
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-1">🔗 Load Transcript from Fireflies:</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select a transcript...</option>
          {firefliesList.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <button
          onClick={handleLoadFireflies}
          className="mt-2 bg-purple-600 text-white px-4 py-2 rounded"
        >
          Load Transcript
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          className="flex-1 border border-gray-300 px-3 py-2 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try: 'Summarize the transcript' or 'Generate user stories'"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>

      <div className="space-y-2 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className="bg-gray-100 p-2 rounded whitespace-pre-wrap">{msg}</div>
        ))}
      </div>

      {storiesRef.current.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">📤 Export Stories</h2>
          <button
            onClick={handleDownloadCSV}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Download CSV
          </button>
        </div>
      )}
    </main>
  );
}
