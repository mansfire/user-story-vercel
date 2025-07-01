'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [firefliesList, setFirefliesList] = useState<{ id: string; title: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [recentStories, setRecentStories] = useState<any[]>([]);
  const transcriptRef = useRef<string>('');
  const storiesRef = useRef<any[]>([]);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    fetch(`${BACKEND_URL}/fireflies`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const parsed = data.map((item: any) => ({ id: item.id, title: item.title }));
          setFirefliesList(parsed);
        }
      });

    fetch(`${BACKEND_URL}/jira/recent`)
      .then((res) => res.json())
      .then((data) => setRecentStories(data));
  }, [BACKEND_URL]);

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

  const handleRefreshTranscripts = async () => {
    const res = await fetch(`${BACKEND_URL}/fireflies`);
    const data = await res.json();
    if (Array.isArray(data)) {
      const parsed = data.map((item: any) => ({ id: item.id, title: item.title }));
      setFirefliesList(parsed);
      setMessages((prev) => [...prev, '🔄 Refreshed Fireflies transcript list.']);
    } else {
      setMessages((prev) => [...prev, '❌ Failed to load Fireflies transcripts.']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userMessage = input.trim();
    if (!userMessage) return;

    setMessages((prev) => [...prev, `🧑 You: ${userMessage}`]);
    setInput('');
    setLoading(true);

    const body: any = {
      messages: [{ role: 'user', content: userMessage }],
      transcript: transcriptRef.current,
    };

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        body: JSON.stringify(body),
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

      if (userMessage.toLowerCase().includes('generate')) {
        try {
          const start = fullContent.indexOf('[');
          const end = fullContent.lastIndexOf(']') + 1;
          const parsed = JSON.parse(fullContent.slice(start, end));
          storiesRef.current = parsed;
        } catch (e) {
          console.warn('Could not parse stories:', e);
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, '❌ Error: Could not reach backend']);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFireflies = async () => {
    if (!selectedId) return;

    const res = await fetch(`${BACKEND_URL}/fireflies/transcript?id=${selectedId}`);
    const json = await res.json();
    transcriptRef.current = json.transcript;
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

  const handlePushToJira = async () => {
    const res = await fetch(`${BACKEND_URL}/jira/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories: storiesRef.current }),
    });
    const json = await res.json();
    setMessages((prev) => [...prev, `✅ Pushed to Jira: ${json.created.join(', ')}`]);
  };

  return (
    <main className="p-6 max-w-3xl mx-auto font-sans text-gray-800">
      <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-700">🧠 User Story Assistant</h1>

      <section className="mb-8 p-4 bg-white shadow rounded">
        <label className="block font-semibold mb-2">📁 Upload Feedback File:</label>
        <input type="file" onChange={handleUpload} className="mb-2 w-full" />
      </section>

      <section className="mb-8 p-4 bg-white shadow rounded">
        <label className="block font-semibold mb-2">🗂 Load Transcript from Fireflies:</label>
        <div className="flex gap-2">
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
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Load
          </button>
          <button
            onClick={handleRefreshTranscripts}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Refresh
          </button>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          className="flex-1 border border-gray-300 px-3 py-2 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try: 'Summarize the transcript' or 'Generate user stories'"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>

      <div className="space-y-2 mb-6">
        {messages.map((msg, i) => (
          <div key={i} className="bg-gray-100 p-3 rounded border whitespace-pre-wrap">{msg}</div>
        ))}
      </div>

      {storiesRef.current.length > 0 && (
        <section className="mt-8 p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold mb-4 text-green-700">📤 Export Stories</h2>
          <div className="flex gap-4">
            <button
              onClick={handleDownloadCSV}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Download CSV
            </button>
            <button
              onClick={handlePushToJira}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
            >
              Push to Jira
            </button>
          </div>
        </section>
      )}

      {recentStories.length > 0 && (
        <section className="mt-10 p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">🕓 Recent Jira Stories</h2>
          <ul className="space-y-2">
            {recentStories.map((s) => (
              <li key={s.key} className="bg-gray-50 p-3 rounded border">
                <strong>{s.key}</strong>: {s.summary}
                <br />
                <small>{s.created}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
