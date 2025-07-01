<main className="font-sans bg-gray-50 min-h-screen py-8 px-4 flex justify-center">
  <div className="w-full max-w-screen-md space-y-8">

    <h1 className="text-3xl font-bold text-center text-purple-700">💬 User Story Assistant</h1>

    {/* Upload Section */}
    <div className="bg-white p-6 rounded-lg shadow border">
      <h2 className="text-xl font-semibold mb-4">📄 Upload Feedback File</h2>
      <input type="file" onChange={handleUpload} className="mb-2 block w-full" />
    </div>

    {/* Fireflies Section */}
    <div className="bg-white p-6 rounded-lg shadow border">
      <h2 className="text-xl font-semibold mb-4">🔗 Load Transcript from Fireflies</h2>
      <select
        className="w-full border border-gray-300 rounded px-3 py-2 mb-2"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        <option value="">Select a transcript...</option>
        {firefliesList.map((t) => (
          <option key={t.id} value={t.id}>{t.title}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleLoadFireflies}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
        >
          Load
        </button>
        <button
          onClick={handleRefreshTranscripts}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          Refresh
        </button>
      </div>
    </div>

    {/* Chat Section */}
    <div className="bg-white p-6 rounded-lg shadow border">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          className="flex-1 border border-gray-300 px-3 py-2 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try: 'Summarize the transcript' or 'Generate user stories'"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className="bg-gray-100 p-2 rounded whitespace-pre-wrap">{msg}</div>
        ))}
      </div>
    </div>

    {/* Export Section */}
    {storiesRef.current.length > 0 && (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-xl font-semibold mb-4">📤 Export Stories</h2>
        <button
          onClick={handleDownloadCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mr-2"
        >
          Download CSV
        </button>
        <button
          onClick={handlePushToJira}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
        >
          Push All to Jira
        </button>
      </div>
    )}

    {/* Recent Stories Section */}
    {recentStories.length > 0 && (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="text-xl font-semibold mb-4">🕓 Recent Jira Stories</h2>
        <ul className="space-y-2">
          {recentStories.map((s) => (
            <li key={s.key} className="bg-gray-50 p-3 rounded border">
              <strong>{s.key}</strong>: {s.summary}<br />
              <small>{s.created}</small>
            </li>
          ))}
        </ul>
      </div>
    )}

  </div>
</main>
