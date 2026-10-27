import React, { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://viralclip-api-4n9d.onrender.com';

export default function App() {
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState('');
  const [clips, setClips] = useState([]);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setStatus('Starting...');
    const form = new FormData();
    if (url) form.append('url', url);
    if (file) form.append('file', file);
    form.append('max_clips', '5');
    form.append('caption_style', 'bold');
    try {
      const res = await fetch(`${API}/api/v1/jobs`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) { setError(data.error); setStatus(''); return; }
      setJob(data);
      setStatus('Processing...');
    } catch (e) {
      setError('Failed to start job');
      setStatus('');
    }
  };

  useEffect(() => {
    if (!job?.id || job.status === 'completed' || job.status === 'failed') return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/v1/jobs/${job.id}`);
        const data = await res.json();
        setJob(data);
        if (data.status === 'completed') {
          setClips(data.clips || []);
          setStatus('Done');
          clearInterval(t);
        } else if (data.status === 'failed') {
          setError(data.error || 'Job failed');
          setStatus('');
          clearInterval(t);
        } else {
          setStatus(data.message || `Processing ${data.progress || 0}%`);
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1>ViralClip AI</h1>
      <p>Turn long videos into viral shorts.</p>
      <input
        placeholder="Paste a video URL"
        value={url}
        onChange={e => setUrl(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 8 }}
      />
      <input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button onClick={submit} style={{ display: 'block', marginTop: 12, padding: '8px 16px' }}>
        Generate clips
      </button>
      {status && <p>{status}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {clips.length > 0 && (
        <div>
          <h2>Clips</h2>
          {clips.map(c => (
            <div key={c.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8 }}>
              <strong>{c.title || c.id}</strong> — score {c.score}
              {c.download_url && <div><a href={c.download_url}>Download</a></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
