import React, { useState } from 'react';

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <h1>通達検索</h1>
      <p>国税庁の法令解釈通達をベクトル検索します</p>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例: 経済的利益の範囲"
          style={{ width: '70%', padding: 10, fontSize: 16 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, fontSize: 16, marginLeft: 8 }}
        >
          {loading ? '検索中...' : '検索'}
        </button>
      </form>
      <div style={{ marginTop: 20 }}>
        {results.map((r, i) => (
          <div key={i} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
            <strong>{r.id}</strong>
            <span style={{ marginLeft: 8, color: '#666' }}>
              スコア: {r.score?.toFixed(4)}
            </span>
            <p style={{ margin: '4px 0 0' }}>{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
