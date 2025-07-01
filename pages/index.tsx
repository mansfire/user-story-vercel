'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [firefliesList, setFirefliesList] = useState<{ id: string; title: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [recentStories, setRecentStories] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(false);
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
    <main className={`flex flex-col min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-[#f9f9f9] text-black'}`}>
      <header className={`p-4 border-b shadow-sm ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">🧠 User Story Assistant</h1>
          <button onClick={() => setDarkMode(!darkMode)} className="text-sm px-2 py-1 border rounded">
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <input type="file" onChange={handleUpload} className="text-sm" />
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={`border px-2 py-1 rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
          >
            <option value="">Select transcript...</option>
            {firefliesList.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <button onClick={handleLoadFireflies} className="bg-purple-600 text-white px-2 py-1 rounded">Load</button>
          <button onClick={handleRefreshTranscripts} className="bg-gray-500 text-white px-2 py-1 rounded">Refresh</button>
          <button onClick={handleDownloadCSV} className="bg-green-600 text-white px-2 py-1 rounded">CSV</button>
          <button onClick={handlePushToJira} className="bg-yellow-500 text-white px-2 py-1 rounded">Jira</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-xl px-4 py-3 rounded-lg shadow-sm text-sm whitespace-pre-wrap ${msg.startsWith('🧑') ? (darkMode ? 'bg-gray-700 self-end' : 'bg-white self-end') : (darkMode ? 'bg-gray-800 self-start' : 'bg-blue-100 self-start')}`}
          >
            {msg}
          </div>
        ))}
      </div>

      <footer className={`p-4 flex flex-col space-y-2 ${darkMode ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t'}`}>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className={`flex-1 border px-3 py-2 rounded-md text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something or say 'generate user stories'..."
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
      </footer>
    </main>
  );
}
