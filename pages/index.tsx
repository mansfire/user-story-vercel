'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [firefliesList, setFirefliesList] = useState<{ id: string; title: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [recentStories, setRecentStories] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(true);
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
      let assistantMessage = '🤖 Maria: ';
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
    } catch {
      setMessages((prev) => [...prev, '❌ Error: Could not reach backend']);
    } finally {
      setLoading(false);
    }
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
    <main
      className={`min-h-screen ${darkMode ? 'bg-gradient-to-b from-gray-900 to-gray-800 text-white' : 'bg-gradient-to-b from-gray-100 to-white text-black'} p-6`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">🤖 Maria – User Story Assistant</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="bg-gray-600 text-white px-3 py-1 rounded"
          >
            {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 shadow rounded p-4 mb-6">
          <label className="block font-medium mb-1">📄 Upload Feedback File:</label>
          <input type="file" onChange={handleUpload} className="mb-2" />
        </div>

        <div className="bg-white dark:bg-gray-900 shadow rounded p-4 mb-6">
          <label className="block font-medium mb-1">🔗 Load Transcript from Fireflies:</label>
          <select
            className="w-full border border-gray-300 text-black rounded px-3 py-2"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select a transcript...</option>
            {firefliesList.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <div className="mt-2">
            <button
              onClick={handleLoadFireflies}
              className="bg-purple-600 text-white px-4 py-2 rounded mr-2"
            >
              Load Transcript
            </button>
            <button
              onClick={handleRefreshTranscripts}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Refresh List
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 shadow rounded p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">💬 Chat</h2>
          <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
            <input
              className="flex-1 border border-gray-300 px-3 py-2 rounded text-black"
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

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className="bg-gray-100 dark:bg-gray-800 p-2 rounded whitespace-pre-wrap">
                {msg}
              </div>
            ))}
          </div>
        </div>

        {storiesRef.current.length > 0 && (
          <div className="bg-white dark:bg-gray-900 shadow rounded p-4 mb-6">
            <h2 className="text-lg font-semibold mb-2">📤 Export & Push</h2>
            <button
              onClick={handleDownloadCSV}
              className="bg-green-600 text-white px-4 py-2 rounded mr-2"
            >
              📥 Download CSV
            </button>
            <button
              onClick={handlePushToJira}
              className="bg-yellow-500 text-white px-4 py-2 rounded"
            >
              🪄 Push All to Jira
            </button>
          </div>
        )}

        {recentStories.length > 0 && (
          <div className="bg-white dark:bg-gray-900 shadow rounded p-4 mt-6">
            <h2 className="text-lg font-semibold mb-2">🕓 Recent Jira Stories</h2>
            <ul className="space-y-2">
              {recentStories.map((s) => (
                <li key={s.key} className="border-b border-gray-700 pb-2">
                  <strong>{s.key}</strong>: {s.summary}
                  <br />
                  <small>{s.created}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
