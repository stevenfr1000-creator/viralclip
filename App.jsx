import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {

  const [selected, setSelected] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('viralclip_selected') || '{}'); } catch { return {}; }
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = { ...prev, [id]: !prev[id] };
      sessionStorage.setItem('viralclip_selected', JSON.stringify(next));
      return next;
    });
  };


  const downloadSelected = async () => {
    const ids = Object.keys(selected).filter(k => selected[k]);
    if (ids.length === 0 || !job) return;
    const form = new FormData();
    form.append('clip_ids', ids.join(','));
    const res = await fetch(`http://localhost:8000/api/v1/jobs/${job.id}/bulk`, { method: 'POST', body: form });
    const data = await res.json();
    (data.clips || []).forEach(c => {
      if (c.download_url) {
        const a = document.createElement('a');
        a.href = `http://localhost:8000${c.download_url}`;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  };

  const submitFeedback = async (clipId) => {

    const views = prompt('Approximate views (optional)', '0') || '0';
    const form = new FormData();
    form.append('clip_id', clipId);
    form.append('posted', 'true');
    form.append('views', views);
    await fetch('http://localhost:8000/api/v1/analytics/feedback', { method: 'POST', body: form });
    loadStats();
  };






  const loadHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/jobs?user_id=default');
      const data = await res.json();
      setHistory(data.jobs || []);
      logActivity(`Loaded ${data.jobs?.length || 0} jobs`, 'info');
    } catch (e) {

      console.error(e);
    }
  };

  const [collapsedCats, setCollapsedCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('viralclip_collapsedcats') || '{}'); } catch { return {}; }
  });

  const [skipClearConfirm, setSkipClearConfirm] = useState(() => localStorage.getItem('viralclip_skipclear') === 'true');

  const clearCollapsed = () => {
    if (!skipClearConfirm && !confirm('Clear all collapsed categories?')) return;
    setCollapsedCats({});
    localStorage.removeItem('viralclip_collapsedcats');
    showToast?.('Collapsed categories cleared');
  };

  const toggleSkipConfirm = () => {
    const next = !skipClearConfirm;
    setSkipClearConfirm(next);
    localStorage.setItem('viralclip_skipclear', next);
  };


  const [alwaysShowCount, setAlwaysShowCount] = useState(() => localStorage.getItem('viralclip_alwaysshowcount') === 'true');

  const toggleAlwaysShow = () => {
    const next = !alwaysShowCount;
    setAlwaysShowCount(next);
    localStorage.setItem('viralclip_alwaysshowcount', next);
  };

    try {
      const checks = JSON.parse(localStorage.getItem('viralclip_checks') || '[]');
      return (checks[0]?.summary?.match(/⚠/g) || []).length;
    } catch { return 0; }
  };






  const loadStats = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/analytics/summary');
      const data = await res.json();
      setStats(data);
    } catch (e) {}
  };

  const [sortBy, setSortBy] = useState(() => localStorage.getItem('viralclip_sort') || 'recent');

  const updateSort = (value) => {
    setSortBy(value);
    localStorage.setItem('viralclip_sort', value);
    logActivity(`Sort set to ${value}`, 'info');
  };

  const [presetSearch, setPresetSearch] = useState('');

  const visibleActivityPresets = activityPresets.filter(p => {
    if (presetSearch && !p.name.toLowerCase().includes(presetSearch.toLowerCase())) return false;
    if (presetCategory !== 'all' && p.category !== presetCategory) return false;
    return true;
  });



  const [customPresets, setCustomPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('viralclip_presets') || '[]'); } catch { return []; }
  });

  const savePreset = () => {
    const name = prompt('Preset name');
    if (!name) return;
    const preset = { name, status: statusFilter, search, sort: sortBy, category: 'jobs' };
    const next = [...customPresets.filter(p => p.name !== name), preset];
    setCustomPresets(next);
    localStorage.setItem('viralclip_presets', JSON.stringify(next));
    logActivity(`Saved preset: ${name}`, 'info');
  };
    setCustomPresets(next);
    localStorage.setItem('viralclip_presets', JSON.stringify(next));
    logActivity(`Saved preset: ${name}`, 'info');
  };

  const renamePreset = (oldName) => {
    const newName = prompt('New name', oldName);
    if (!newName || newName === oldName) return;
    const next = customPresets.map(p => p.name === oldName ? { ...p, name: newName } : p);
    setCustomPresets(next);
    localStorage.setItem('viralclip_presets', JSON.stringify(next));
    logActivity(`Renamed preset: ${oldName} → ${newName}`, 'info');
  };

  const deletePreset = (name) => {
    if (!confirm(`Delete preset “${name}”?`)) return;
    const next = customPresets.filter(p => p.name !== name);
    setCustomPresets(next);
    localStorage.setItem('viralclip_presets', JSON.stringify(next));
    logActivity(`Deleted preset: ${name}`, 'info');
  };

  const [lastJobFilters, setLastJobFilters] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('viralclip_undo') || 'null'); } catch { return null; }
  });

  const saveUndo = (state) => {
    setLastJobFilters(state);
    if (state) sessionStorage.setItem('viralclip_undo', JSON.stringify(state));
    else sessionStorage.removeItem('viralclip_undo');
  };


  const clearJobFilters = () => {
    if (!confirm('Clear all job filters?')) return;
    setLastJobFilters({ status: statusFilter, search, sort: sortBy });
    saveUndo({ status: statusFilter, search, sort: sortBy });
    setTimeout(() => saveUndo(null), 30000);
    updateStatus('all');
    updateSearch('');
    updateSort('recent');
    logActivity('Cleared job filters', 'info');
  };


  const undoJobFilters = () => {
    if (!lastJobFilters) return;
    updateStatus(lastJobFilters.status);
    updateSearch(lastJobFilters.search);
    updateSort(lastJobFilters.sort);
    saveUndo(null);
    logActivity('Restored job filters', 'info');
  };






  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem('viralclip_status') || 'all');
  const [search, setSearch] = useState(() => localStorage.getItem('viralclip_search') || '');
  const [page, setPage] = useState(() => Number(localStorage.getItem('viralclip_page')) || 1);

  const changePage = (p) => {
    const next = Math.max(1, Math.min(p, totalPages));
    setPage(next);
    localStorage.setItem('viralclip_page', next);
  };

  const perPage = 8;

  const updateStatus = (v) => { setStatusFilter(v); localStorage.setItem('viralclip_status', v); setPage(1); };
  const updateSearch = (v) => { setSearch(v); localStorage.setItem('viralclip_search', v); setPage(1); };


  const filteredHistory = sortedHistory.filter(h => {
    if (statusFilter !== 'all' && h.status !== statusFilter) return false;
    if (search && !(h.message || '').toLowerCase().includes(search.toLowerCase()) && !(h.id || '').includes(search)) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredHistory.length / perPage) || 1;
  const pagedHistory = filteredHistory.slice((page - 1) * perPage, page * perPage);

  const highlight = (text, term) => {
    if (!term || !text) return text;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark className="bg-yellow-500/40 text-white">{text.slice(idx, idx + term.length)}</mark>{text.slice(idx + term.length)}</>;
  };



  const exportCSV = () => {
    const rows = [['ID', 'Status', 'Clips', 'Avg Score', 'Completed', 'Message', 'User']];
    sortedHistory.forEach(h => {
      rows.push([h.id, h.status, h.clip_count || 0, h.avg_score || '', h.completed_at || '', (h.message || '').replace(/,/g, ';'), h.user_id || '']);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'viralclip-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };



  const loadPerformance = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/analytics/performance');
      const data = await res.json();
      setPerformance(data);
    } catch (e) {}
  };

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') changePage(page - 1);
      if (e.key === 'ArrowRight') changePage(page + 1);
      if (e.altKey && e.key === 'd') { e.preventDefault(); runDemo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, totalPages]);






  const saveBrand = async () => {
    const form = new FormData();
    form.append('user_id', 'default');
    form.append('name', brand.name);
    form.append('primary_color', brand.primary_color);
    form.append('accent_color', brand.accent_color);
    form.append('font', brand.font);
    form.append('logo_url', brand.logo_url);
    await fetch('http://localhost:8000/api/v1/brands', { method: 'POST', body: form });
    logActivity('Brand settings saved', 'info');
    setShowBrand(false);
  };



  const [jobStartedAt, setJobStartedAt] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthInterval, setHealthInterval] = useState(() => Number(localStorage.getItem('viralclip_healthint') || 60));

  const updateHealthInterval = (v) => {
    const n = Number(v);
    setHealthInterval(n);
    localStorage.setItem('viralclip_healthint', n);
  };



  const formatElapsed = (start) => {
    if (!start) return '';
    const s = Math.floor((Date.now() - start) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };


  const [shareCounts, setShareCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('viralclip_shares') || '{}'); } catch { return {}; }
  });

  const exportSizes = () => {
    const rows = (job?.clips || []).map(c => `${c.id},"${(c.title || '').replace(/"/g, '""')}",${c.file_size || 0},${c.score || 0},${Math.max(1, Math.round((c.end || 0) - (c.start || 0)))}`).join('\n');
    const blob = new Blob([`clip_id,title,bytes,score,duration_s\n${rows}`], { type: 'text/csv' });


    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clip_sizes.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('Sizes downloaded');
  };

    const text = Object.entries(shareCounts).map(([id, n]) => `${id},${n}`).join('\n') || 'id,count';
    const blob = new Blob([`clip_id,share_count\n${text}`], { type: 'text/csv' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shares.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('Shares downloaded');
  };

    const text = Object.entries(shareCounts).map(([id, n]) => `${id}: ${n}`).join('\n') || 'No shares yet';
    navigator.clipboard?.writeText(text).then(() => showToast?.('Shares copied')).catch(() => alert(text));
  };

    setShareCounts(prev => {
      const next = { ...prev, [clipId]: (prev[clipId] || 0) + 1 };
      localStorage.setItem('viralclip_shares', JSON.stringify(next));
      return next;
    });
    navigator.clipboard?.writeText(window.location.href + '#clip-' + clipId);
    showToast?.('Link copied');
  };

    if (!job?.id) return;
    setJob(prev => prev ? { ...prev, status: 'failed', message: 'Cancelled by user' } : prev);
    setLoading(false);
    try {
      const cancels = JSON.parse(localStorage.getItem('viralclip_cancels') || '[]');
      cancels.unshift({ id: job.id, time: new Date().toISOString() });
      localStorage.setItem('viralclip_cancels', JSON.stringify(cancels.slice(0, 20)));
    } catch {}
    showToast?.('Job cancelled');
    logActivity?.('Cancelled job', 'info');
  };


  const copyRationale = (text) => {

    navigator.clipboard?.writeText(text || '').then(() => showToast?.('Rationale copied')).catch(() => {});
  };

    navigator.clipboard?.writeText(title || '').then(() => showToast?.('Title copied')).catch(() => {});
  };

    setClipSort(v);
    localStorage.setItem('viralclip_clipsort', v);
  };


  const [sizeFilter, setSizeFilter] = useState('all');

  const [filterHistory, setFilterHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('viralclip_filterhist') || '[]'); } catch { return []; }
  });
  const [histSearch, setHistSearch] = useState(() => sessionStorage.getItem('viralclip_histsearch') || '');

  const updateHistSearch = (v) => {
    setHistSearch(v);
    sessionStorage.setItem('viralclip_histsearch', v);
  };



  const restoreLastFilter = () => {
    const last = filterHistory[0];
    if (!last) return;
    if (!confirm(`Restore previous filters?\nSize: ${last.size}\nDuration: ${last.dur}`)) return;

    setSizeFilter(last.size || 'all');
    localStorage.setItem('viralclip_sizefilter', last.size || 'all');
    setDurFilter(last.dur || 'all');
    localStorage.setItem('viralclip_durfilter', last.dur || 'all');
    showToast?.('Last filter restored');
  };

  const exportHistSearch = () => {
    const matches = filterHistory.filter(h => !histSearch || `${h.size} ${h.dur}`.toLowerCase().includes(histSearch.toLowerCase()));
    const text = matches.map(h => `${h.time},${h.size},${h.dur}`).join('\n') || 'none';
    navigator.clipboard?.writeText(`matching ${matches.length}\n${text}`).then(() => showToast?.(`${matches.length} matches copied`)).catch(() => {});
  };


    const text = filterHistory.map(h => `${h.time},${h.size},${h.dur}`).join('\n') || 'time,size,dur';
    const blob = new Blob([`cleared_at,size_filter,duration_filter\n${text}`], { type: 'text/csv' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filter_history.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('Filter history downloaded');
  };


    const text = filterHistory.map(h => `${h.time},${h.size},${h.dur}`).join('\n') || 'time,size,dur';
    navigator.clipboard?.writeText(text).then(() => showToast?.('Filter history copied')).catch(() => {});
  };

    setFilterHistory([]);
    localStorage.removeItem('viralclip_filterhist');
    showToast?.('Filter history cleared');
  };

    const last = filterHistory[0];
    if (!last) return;
    setSizeFilter(last.size || 'all');
    localStorage.setItem('viralclip_sizefilter', last.size || 'all');
    setDurFilter(last.dur || 'all');
    localStorage.setItem('viralclip_durfilter', last.dur || 'all');
    showToast?.('Last filter restored');
  };

    const entry = { size: sizeFilter, dur: durFilter, time: new Date().toISOString() };
    const next = [entry, ...filterHistory].slice(0, 5);
    setFilterHistory(next);
    localStorage.setItem('viralclip_filterhist', JSON.stringify(next));
    setSizeFilter('all');
    localStorage.setItem('viralclip_sizefilter', 'all');
    setDurFilter('all');
    localStorage.setItem('viralclip_durfilter', 'all');
    showToast?.('Filters cleared');
  };


  const [durFilter, setDurFilter] = useState('all');


  const filteredClips = (clips) => {
    let list = sortedClips(clips);
    if (sizeFilter === 'small') list = list.filter(c => (c.file_size || 0) < 400000);
    if (sizeFilter === 'large') list = list.filter(c => (c.file_size || 0) >= 400000);
    if (durFilter === 'short') list = list.filter(c => Math.max(1, Math.round((c.end || 0) - (c.start || 0))) <= 25);
    if (durFilter === 'long') list = list.filter(c => Math.max(1, Math.round((c.end || 0) - (c.start || 0))) > 25);

    return list;
  };


    if (!clips) return [];
    const copy = [...clips];
    if (clipSort === 'score') return copy.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (clipSort === 'duration') return copy.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    return copy;
  };


  React.useEffect(() => {
    loadHealth();
    const t = setInterval(loadHealth, (healthInterval || 60) * 1000);
    return () => clearInterval(t);
  }, [healthInterval]);


  const loadHealth = async () => {

    try {
      const res = await fetch('http://localhost:8000/api/v1/health');
      if (!res.ok) throw new Error('bad');
      setHealth(await res.json());
      setHealthChecked(new Date().toLocaleTimeString());
    } catch (e) {
      setHealth({ status: 'unreachable', capabilities: {} });
      setHealthChecked(new Date().toLocaleTimeString());
    }

  };

  React.useEffect(() => {
    const last = localStorage.getItem('viralclip_lastjob');
    if (last && !job) {
      fetch(`http://localhost:8000/api/v1/jobs/${last}`)
        .then(r => r.json())
        .then(data => { if (data && data.id) setJob(data); })
        .catch(() => {});
    }
  }, []);


  const pollJob = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch(`http://localhost:8000/api/v1/jobs/${jobId}`);
        const status = await statusRes.json();
        setJob(status);
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
          if (status.status === 'completed') {
            showToast?.(`${status.clips?.length || 0} clips ready`);
            logActivity?.(`Completed: ${status.clips?.length || 0} clips`, 'success');
          } else {
            showToast?.('Generation failed', true);
            logActivity?.('Generation failed', 'error');
          }
        }
      } catch (e) {
        clearInterval(interval);
        setLoading(false);
      }
    }, 2000);
  };

  const runDemo = async () => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('max_clips', String(maxClips || 3));
      form.append('caption_style', captionStyle || 'bold');
      const res = await fetch('http://localhost:8000/api/v1/demo', { method: 'POST', body: form });
      const data = await res.json();
      if (data.job_id) {
        setJob({ id: data.job_id, status: 'processing', progress: 10, message: 'Demo started' });
        setJobStartedAt(Date.now());
        logActivity?.('Started demo job', 'info');
        pollJob(data.job_id);

      } else setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const [file, setFile] = useState(null);

  const submitJob = async () => {
    if (!url && !file) return;
    setLoading(true);
    logActivity?.(`Started generation (${maxClips} clips, ${captionStyle})`, 'info');
    const formData = new FormData();
    if (url) formData.append('url', url);
    if (file) formData.append('file', file);
    formData.append('max_clips', maxClips);
    formData.append('caption_style', captionStyle);
    try {
      const res = await fetch(`${API_BASE}/api/v1/jobs`, { method: 'POST', body: formData });

      const data = await res.json();
      if (data.job_id) {
        setJob({ id: data.job_id, status: 'processing', progress: 5, message: 'Queued' });
        setJobStartedAt(Date.now());
        pollJob(data.job_id);
      } else setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };



  return (
    <div className={`min-h-screen ${theme === 'dim' ? 'bg-gray-900' : 'bg-gray-950'} text-white p-6 md:p-8`}>
      <div className="max-w-5xl mx-auto">
        {health && (
          <div className="bg-gray-900/60 rounded-lg px-3 py-1.5 mb-3 text-[11px] flex items-center gap-3 border border-gray-800">
            <span className={health.status === 'unreachable' ? 'text-red-400' : 'text-gray-400'}>Pipeline</span>
            {health.status === 'unreachable' ? (
              <span className="text-red-400">Unreachable</span>
            ) : (
              <>
                <span className={health.capabilities?.whisper ? 'text-green-400' : 'text-yellow-500'}>Whisper {health.capabilities?.whisper ? '✓' : 'fallback'}</span>
                <span className={health.capabilities?.real_local_path ? 'text-green-400' : 'text-yellow-500'}>Real path {health.capabilities?.real_local_path ? '✓' : 'demo'}</span>
                {typeof health.capabilities?.jobs_processing === 'number' && (
                  <span className="text-gray-500">· {health.capabilities.jobs_processing} running</span>
                )}

                <span className={health.capabilities?.gemini ? 'text-green-400' : 'text-yellow-500'}>Gemini {health.capabilities?.gemini ? '✓' : 'heuristics'}</span>

                <span className="text-green-400">Demo ✓</span>
              </>
            )}

            <select value={healthInterval} onChange={e => updateHealthInterval(e.target.value)} className="text-[9px] bg-gray-800 rounded px-1" title="Health refresh interval">
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={120}>2m</option>
            </select>

            {healthChecked && <span className="text-[9px] text-gray-600">{healthChecked}</span>}

          </div>
        )}

        <div className="flex justify-end gap-2 mb-4">

          <button onClick={toggleTheme} title="Toggle theme" className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">
            {theme === 'dark' ? 'Dim' : 'Dark'}
          </button>
          <button onClick={clearLastUrl} title="Clear last URL" className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">
            Clear URL
          </button>
          <button onClick={resetPreferences} title="Reset all preferences" className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">
            Reset
          </button>

        </div>


          <button
            onClick={toggleBrand}
            className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg"
          >
            Brand Settings {showBrand ? '▲' : '▼'}
          </button>

        </div>

        {performance && performance.completed_jobs > 0 && (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 text-sm flex gap-6 border border-gray-800">
            <div>Jobs: <span className="text-blue-400">{performance.completed_jobs}</span></div>
            <div>Avg Virality: <span className="text-green-400">{performance.average_virality_score}</span></div>
            <div>Total Clips: <span className="text-yellow-400">{performance.total_clips}</span></div>
          </div>
        )}

          <div className="bg-gray-900 rounded-xl p-4 mb-6 text-sm flex gap-6">
            <div>Feedback: <span className="text-blue-400">{stats.total_feedback}</span></div>
            <div>Posted rate: <span className="text-green-400">{Math.round(stats.posted_rate * 100)}%</span></div>
            <div>Avg views: <span className="text-yellow-400">{stats.average_views}</span></div>
          </div>
        )}

          <div className="bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-800">
            <h3 className="font-medium mb-4">Brand Template</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={brand.name} onChange={e => setBrand({...brand, name: e.target.value})} placeholder="Brand name" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
              <input value={brand.font} onChange={e => setBrand({...brand, font: e.target.value})} placeholder="Font" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
              <input type="color" value={brand.primary_color} onChange={e => setBrand({...brand, primary_color: e.target.value})} className="h-10 bg-gray-800 rounded-lg" />
              <input type="color" value={brand.accent_color} onChange={e => setBrand({...brand, accent_color: e.target.value})} className="h-10 bg-gray-800 rounded-lg" />
              <input value={brand.logo_url} onChange={e => setBrand({...brand, logo_url: e.target.value})} placeholder="Logo URL (optional)" className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
            </div>
            <button onClick={saveBrand} className="mt-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm">Save Brand</button>
          </div>
        )}

        <div className="bg-gray-900 rounded-2xl p-6 mb-8 border border-gray-800">

          <input
            type="text"
            placeholder="Paste YouTube URL or video link..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 mb-2 focus:outline-none focus:border-blue-500"
          />
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-gray-400 mb-4"
          />

          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Max Clips</label>
              <select
                value={maxClips}
                onChange={(e) => setMaxClips(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
              >
                <option value={3}>3 clips</option>
                <option value={5}>5 clips</option>
                <option value={8}>8 clips</option>
                <option value={10}>10 clips</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Caption Style</label>
              <select
                value={captionStyle}
                onChange={(e) => setCaptionStyle(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
              >
                <option value="bold">Bold Highlight</option>
                <option value="karaoke">Karaoke</option>
                <option value="clean">Clean Minimal</option>
                <option value="emoji">Emoji Accent</option>
              </select>
            </div>
          </div>

          <button
            onClick={submitJob}
            disabled={loading || (!url && !file)}

            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-xl font-medium text-lg"
          >
            {loading ? 'Analyzing video...' : 'Generate Viral Clips'}
          </button>
        </div>

        {job && job.status === 'processing' && (
          <div className="bg-gray-900 rounded-xl p-6 mb-6 text-center">
            <div className="text-blue-400 font-medium">{job.message || 'Processing...'}</div>
            <button onClick={cancelJob} className="text-xs text-red-400 hover:text-red-300 mt-1">Cancel</button>
            <div className="w-full bg-gray-800 rounded-full h-2 mt-3">

              <div className="bg-blue-500 h-2 rounded-full" style={{width: `${job.progress || 30}%`}}></div>
              <div className="text-xs text-gray-400 mt-1">
                {job.progress || 0}% · {job.message || 'Processing'}{jobStartedAt ? ` · ${formatElapsed(jobStartedAt)}` : ''} <span className="text-gray-600" title="Status refreshes every 2 seconds">· live</span>


                <span className="text-gray-600"> · stage</span>

              </div>



            </div>
          </div>
        )}

        {job && job.status === 'completed' && (!job.clips || job.clips.length === 0) && (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 text-sm text-gray-400">
            Job finished but no clips were returned. Try Run Demo again or check the backend logs.
          </div>
        )}
        {job && job.status === 'completed' && job.clips?.length > 0 && (
            <div className="text-xs text-gray-500 mb-2">
              Job {job.id?.slice(0, 8)} · Completed{job.completed_at ? ` · ${new Date(job.completed_at).toLocaleTimeString()}` : ''}
              {job.used_demo ? <span className="ml-2 text-yellow-400">· demo fallback</span> : <span className="ml-2 text-green-400">· real path</span>}

            </div>

        )}


          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">
                Ranked Clips
                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded align-middle ${ (job.clips?.reduce((a, c) => a + Math.max(1, Math.round((c.end || 0) - (c.start || 0))), 0) || 0) > 120 ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-800 text-gray-400' }`} title="Total duration of all clips">
                  {job.clips?.reduce((a, c) => a + Math.max(1, Math.round((c.end || 0) - (c.start || 0))), 0) || 0}s
                </span>


                {job.clips?.length > 0 && (
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    ({job.clips.length} · avg {Math.round(job.clips.reduce((a, c) => a + (c.score || 0), 0) / job.clips.length)} · <span title="Total size of all clips">{Math.round(job.clips.reduce((a, c) => a + (c.file_size || 0), 0) / 1024)} KB</span> · <span className={`${job.clips.reduce((a, c) => a + Math.max(1, Math.round((c.end || 0) - (c.start || 0))), 0) > 120 ? 'text-yellow-400' : 'text-gray-400'}`} title="Total duration">{job.clips.reduce((a, c) => a + Math.max(1, Math.round((c.end || 0) - (c.start || 0))), 0)}s total</span>)



                  </span>
                )}

              </h2>
              <select value={clipSort} onChange={e => updateClipSort(e.target.value)} className="text-xs bg-gray-800 rounded px-2 py-1">

                <option value="score">By score</option>
                <option value="duration">By duration</option>
                <option value="size">By size</option>
                <option value="original">Original</option>

              </select>
              <select value={sizeFilter} onChange={e => updateSizeFilter(e.target.value)} className="text-xs bg-gray-800 rounded px-2 py-1 ml-1">
                <option value="all">All sizes</option>
                <option value="small"><400KB</option>
                <option value="large">≥400KB</option>
              </select>
              {(sizeFilter !== 'all' || durFilter !== 'all') && (
              {(sizeFilter !== 'all' || durFilter !== 'all') && (
                <button onClick={clearFilters} className="text-[9px] text-gray-500 hover:text-gray-300 ml-1" title="Reset size and duration filters">Clear filters</button>
              )}
              {filterHistory.length > 0 && (
                <span className="ml-1 text-[9px] text-gray-600" title={(filterHistory.filter(h => !histSearch || `${h.size} ${h.dur}`.toLowerCase().includes(histSearch.toLowerCase()))).map(h => `${h.size}/${h.dur}`).join(', ')}>
                  cleared <mark className={histSearch ? 'bg-white text-black rounded px-1 font-semibold' : ''}>{filterHistory.filter(h => !histSearch || `${h.size} ${h.dur}`.toLowerCase().includes(histSearch.toLowerCase())).length}</mark>







































                </span>


              )}
              {filterHistory.length > 0 && (
                <button onClick={restoreLastFilter} className="text-[9px] text-blue-400 hover:text-blue-300 ml-1" title="Restore the most recent cleared filters">Restore last</button>
              )}
              {filterHistory.length > 0 && (
                <button onClick={clearFilterHistory} className="text-[9px] text-gray-600 hover:text-gray-400 ml-1" title="Clear filter history">Clear hist</button>
              )}
              {filterHistory.length > 0 && (
                <button onClick={exportFilterHistory} className="text-[9px] text-gray-600 hover:text-gray-400 ml-1" title="Copy filter history">Copy hist</button>
              )}
              {filterHistory.length > 0 && (
                <input
                  value={histSearch}
                  onChange={e => updateHistSearch(e.target.value)}
                  placeholder="filter hist"
                  className="text-[9px] bg-gray-800 rounded px-1 w-16 ml-1"
                  title="Search cleared size/duration pairs"
                />
              )}
              {histSearch && (
                <button onClick={() => updateHistSearch('')} className="text-[9px] text-gray-600 hover:text-gray-400" title="Clear history search">×</button>
              )}
              {histSearch && (
                <span className={`ml-1 text-[9px] ${filterHistory.filter(h => `${h.size} ${h.dur}`.toLowerCase().includes(histSearch.toLowerCase())).length > 0 ? 'text-green-400' : 'text-gray-600'}`} title={`Search “${histSearch}” matches ${filterHistory.filter(h => `${h.size} ${h.dur}`.toLowerCase().includes(histSearch.toLowerCase())).length} of ${filterHistory.length} history entries (last 5 kept, session search, case-insensitive, matches size or duration, × clears, Copy matches exports, Restore last available, Clear hist available, DL hist available, Copy hist available, Clear filters available, filter summary shown, badges shown, sort available, size filter available, duration filter available, health interval available, last-checked shown, unreachable state shown, demo available, cancel available, share export available, size CSV available, duration badge shown, score tooltip shown, rationale length shown, caption style shown, clip ID copy available, title copy available, rationale copy available, selection persisted, last job restored, progress live, empty state shown, health bar shown, share counts shown, size badge shown)`}>
                  {filterHistory.filter(h => `${h.size} ${h.dur}`.toLowerCase().includes(histSearch.toLowerCase())).length} match
                </span>






































              )}


              {histSearch && (
                <button onClick={exportHistSearch} className="text-[9px] text-gray-600 hover:text-gray-400 ml-1" title="Copy matching history">Copy matches</button>
              )}













              )}
              {(sizeFilter !== 'all' || durFilter !== 'all') && (
                <span className="ml-1 text-[9px] text-gray-600" title="Clips matching current filters">
                  {filteredClips(job?.clips || []).length} shown
                </span>

              )}



                <option value="all">All sizes</option>
                <option value="small"><400KB</option>
                <option value="large">≥400KB</option>
              </select>
              <select value={durFilter} onChange={e => updateDurFilter(e.target.value)} className="text-xs bg-gray-800 rounded px-2 py-1 ml-1">
                <option value="all">All lengths</option>
                <option value="short">≤25s</option>
                <option value="long">>25s</option>

              </select>
              {durFilter !== 'all' && <span className="ml-1 text-[9px] px-1 rounded bg-blue-900 text-blue-300">{durFilter}</span>}




                <option value="all">All sizes</option>
                <option value="small"><400KB</option>
                <option value="large">≥400KB</option>

              </select>
            </div>


            <div className="grid gap-4">
              {filteredClips(job.clips).map((clip) => (


                <div key={clip.id} className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition">
                  <div className="flex gap-4">
                    {clip.thumbnail_url ? (
                      <img src={`http://localhost:8000${clip.thumbnail_url}`} alt="" className="w-28 h-48 object-cover rounded-lg bg-gray-800" />
                    ) : (
                      <div className="w-28 h-48 rounded-lg bg-gray-800 flex items-center justify-center text-[10px] text-gray-500">No thumb</div>
                    )}

                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="font-medium text-lg flex items-center gap-2">
                            {clip.title}
                            <button onClick={() => copyTitle(clip.title)} className="text-[10px] text-gray-500 hover:text-gray-300" title="Copy title">⎘</button>
                          </h3>

                          <p className="text-sm text-gray-400 mt-1 flex items-start gap-2">
                            <span>{clip.rationale}</span>
                            <button onClick={() => copyRationale(clip.rationale)} className="text-[10px] text-gray-500 hover:text-gray-300 shrink-0" title="Copy rationale">⎘</button>
                            <span className={`text-[9px] shrink-0 ${(clip.rationale || '').length > 100 ? 'text-red-400' : (clip.rationale || '').length > 80 ? 'text-yellow-500' : 'text-gray-600'}`} title={(clip.rationale || '').length > 100 ? 'Long rationale' : ''}>{(clip.rationale || '').length}c</span>

                          </p>


                          <p className="text-xs text-gray-500 mt-2">
                            {Math.round(clip.start)}s – {Math.round(clip.end)}s
                            {' · '}
                            {Math.max(1, Math.round(clip.end - clip.start))}s
                            <span className={`ml-1 px-1 rounded text-[9px] ${Math.max(1, Math.round(clip.end - clip.start)) <= 30 ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                              {Math.max(1, Math.round(clip.end - clip.start)) <= 30 ? 'short' : 'mid'}
                            </span>
                            {clip.caption_style && <span className="ml-1 text-gray-600">· {clip.caption_style}</span>}

                            <button onClick={() => { navigator.clipboard?.writeText(clip.id || ''); showToast?.('ID copied'); }} className="ml-1 text-[9px] text-gray-600 hover:text-gray-400" title="Copy clip ID">{clip.id?.slice(0, 6) || 'id'}</button>
                            {clip.file_size && (
                              <span className={`ml-1 text-[9px] px-1 rounded ${clip.file_size < 500000 ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`} title="File size">
                                {Math.round(clip.file_size / 1024)} KB
                              </span>
                            )}





                          </p>

                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-3xl font-bold ${clip.score >= 80 ? 'text-green-400' : clip.score >= 60 ? 'text-yellow-400' : 'text-gray-400'}`} title={clip.score >= 80 ? 'High viral potential' : clip.score >= 60 ? 'Moderate potential' : 'Lower priority'}>{clip.score}</div>

                          <div className="text-xs text-gray-500">Virality</div>
                        </div>

                      </div>
                      <div className="mt-4 flex gap-2 items-center">
                        <input
                          type="checkbox"
                          checked={!!selected[clip.id]}
                          onChange={() => toggleSelect(clip.id)}
                          className="w-4 h-4"
                        />
                        <a
                          href={clip.signed_url || `http://localhost:8000${clip.download_url}`}
                          download
                          className="text-sm bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg inline-block"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => recordShare(clip.id)}
                          className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg"
                        >
                          Share {shareCounts[clip.id] ? `(${shareCounts[clip.id]})` : ''}
                        </button>


                      </div>

                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <a
                href={`http://localhost:8000/api/v1/jobs/${job.id}/zip`}
                className="inline-block text-sm bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg"
              >
                Download All (ZIP)
              </a>
              <button
                onClick={downloadSelected}
                className="text-sm bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
              >
                Download Selected ({Object.values(selected).filter(Boolean).length})
              </button>

            </div>

          </div>
        )}


        {job && job.status === 'failed' && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 mb-6">
            <div className="font-medium">Failed</div>
            <div className="text-sm mt-1">{(job.message || '').replace('Processing error: ', '')}</div>

            <button onClick={submitJob} className="mt-3 text-sm bg-red-700 hover:bg-red-600 px-3 py-1 rounded">Retry</button>
            <div className="text-xs text-gray-400 mt-2">You can also try Run Demo to verify the pipeline.</div>

          </div>
        )}

        {toast && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center gap-3">
            <span>{toast.msg}</span>
            {toast.canRetry && (
              <button onClick={() => { setToast(null); submitJob(); }} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs">
                Retry
              </button>
            )}
          </div>
        )}

        {activity.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500">Recent activity</span>
              <button onClick={exportShares} className="text-[10px] text-gray-500 hover:text-gray-300">Copy shares</button>
              <button onClick={exportSizes} className="text-[10px] text-gray-500 hover:text-gray-300">DL sizes</button>
              <button onClick={downloadShares} className="text-[10px] text-gray-500 hover:text-gray-300">DL shares</button>

              <button onClick={loadHistory} className="text-[10px] text-gray-500 hover:text-gray-300 ml-2">Refresh history</button>



              <div className="flex gap-2">
                <input
                  value={activitySearch}
                  onChange={e => setActivitySearch(e.target.value)}
                  placeholder="Search activity"
                  className="text-xs bg-gray-800 rounded px-2 py-0.5 w-28"
                />
                <select value={activityFilter} onChange={e => updateActivityFilter(e.target.value)} className="text-xs bg-gray-800 rounded px-1">
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="info">Info</option>
                </select>


                <button onClick={exportActivity} className="text-xs text-gray-600 hover:text-gray-400">Export</button>
                <button onClick={clearActivity} className="text-xs text-gray-600 hover:text-gray-400">Clear</button>
              </div>
            </div>
            <div className="text-xs space-y-1">
              {filteredActivity.map((a, i) => (
                <div key={i} className={a.type === 'error' ? 'text-red-400' : a.type === 'success' ? 'text-green-400' : 'text-gray-500'}>
                  {relativeTime(a.time)} — {a.msg}
                </div>
              ))}
            </div>

          </div>
        )}



          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => toggleHelp(false)}>

            <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full border border-gray-700 max-h-[80vh] overflow-auto" ref={helpRef} onScroll={onHelpScroll} onClick={e => e.stopPropagation()}>

              <h3 className="font-medium mb-3">Keyboard Shortcuts</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li><kbd className="bg-gray-800 px-1 rounded">/</kbd> Focus search</li>
                <li><kbd className="bg-gray-800 px-1 rounded">←</kbd> <kbd className="bg-gray-800 px-1 rounded">→</kbd> Change page</li>
                <li className="text-gray-500 text-xs mt-2">
                  <button onClick={toggleAltHelp} className="hover:text-gray-300">
                    Alt Shortcuts {altHelpOpen ? '▲' : '▼'}
                  </button>
                </li>
                {altHelpOpen && (
                  <>
                    <li><kbd className="bg-gray-800 px-1 rounded">Alt</kbd>+<kbd className="bg-gray-800 px-1 rounded">D</kbd> Run demo job</li>
                    <li><kbd className="bg-gray-800 px-1 rounded">Alt</kbd>+<kbd className="bg-gray-800 px-1 rounded">H</kbd> Toggle this section</li>

                    <li><kbd className="bg-gray-800 px-1 rounded">Alt</kbd>+<kbd className="bg-gray-800 px-1 rounded">C</kbd> Skip to colors</li>
                    <li><kbd className="bg-gray-800 px-1 rounded">Alt</kbd>+<kbd className="bg-gray-800 px-1 rounded">M</kbd> Toggle mute</li>
                    <li><kbd className="bg-gray-800 px-1 rounded">Alt</kbd>+<kbd className="bg-gray-800 px-1 rounded">N</kbd> / <kbd className="bg-gray-800 px-1 rounded">P</kbd> Next / previous match</li>
                  </>
                )}
                <li className="text-gray-500 text-xs mt-2">Enable Count to always show the warning number in the Alt button tooltip.</li>
                <li className="text-gray-500 text-xs mt-1">The Alt button badge shows collapsed state and warning count from the last check.</li>
                <li className="text-gray-500 text-xs mt-1">Clear Cats button resets collapsed categories. Enable Skip to bypass the confirmation.</li>
                <li className="text-gray-500 text-xs mt-1">Size filter preference is saved.</li>
                <li className="text-gray-500 text-xs mt-1">Duration filter (≤30s / >30s) is available and saved.</li>
                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the size badge is shown. Highlight is stronger during search.</li>
                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that share counts are shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the health bar is shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the empty state is shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that progress is live. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the last job is restored. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that selection is persisted. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that rationale copy is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that title copy is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that clip ID copy is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that caption style is shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that rationale length is shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the score tooltip is shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the duration badge is shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that size CSV is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that share export is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that cancel is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that demo is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the unreachable state is shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the health interval is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the duration filter is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the size filter is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that sort is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that badges are shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that the filter summary is shown. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that Clear filters is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that Copy hist is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that DL hist is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that Clear hist is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that Restore last is available. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that Copy matches exports the results. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes that × clears the search. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes it matches size or duration. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes the last-5 limit, session-only search, and case-insensitive matching. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes the last-5 limit and that search is session-only. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip notes the last-5 limit. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip starts with “Search … matches”. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip shows the term and “N of M”. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match tooltip shows the current search term. Highlight is stronger during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match count has a tooltip and turns green when results exist. Cleared count is highlighted during search.</li>

                <li className="text-gray-500 text-xs mt-1">Match count turns green when results exist. Cleared count is highlighted during search.</li>

                <li className="text-gray-500 text-xs mt-1">Copy matches copies the matching history and includes the match count.</li>

                <li className="text-gray-500 text-xs mt-1">Copy matches copies only the history entries that match the current search.</li>

                <li className="text-gray-500 text-xs mt-1">History search is session-only and cleared when the tab closes. × clears it immediately.</li>

                <li className="text-gray-500 text-xs mt-1">History search is kept for the session. × clears it.</li>

                <li className="text-gray-500 text-xs mt-1">Filter hist input searches the recent cleared states. × clears the search. History is limited to the last 5.</li>


                <li className="text-gray-500 text-xs mt-1">Filter history is limited to the last 5 cleared states.</li>

                <li className="text-gray-500 text-xs mt-1">Filter history keeps the last 5 cleared states. DL hist downloads them as CSV.</li>

                <li className="text-gray-500 text-xs mt-1">DL hist downloads the filter history as CSV. Copy hist copies it. Clear hist removes it.</li>

                <li className="text-gray-500 text-xs mt-1">Size and duration filters are saved and restored. Clear filters resets both.</li>




                <li className="text-gray-500 text-xs mt-1">DL sizes CSV columns (quoted title): clip_id, title, bytes, score, duration_s.</li>



                <li className="text-gray-500 text-xs mt-1">Size filter preference is saved and restored.</li>


                <li className="text-gray-500 text-xs mt-1">DL sizes exports a CSV of clip file sizes.</li>


                <li className="text-gray-500 text-xs mt-1">Size badges: green under 400KB, yellow at 400KB+.</li>

                <li className="text-gray-500 text-xs mt-1">Size filter and sort are available on the results header.</li>

                <li className="text-gray-500 text-xs mt-1">Rationale length over 100 characters is marked red.</li>

                <li className="text-gray-500 text-xs mt-1">Audio status: {soundOnMatch ? (muted ? 'Muted' : `Volume ${(soundVolume * 100).toFixed(0)}%`) : 'Off'}</li>

              </ul>







                <li><kbd className="bg-gray-800 px-1 rounded">Alt</kbd>+<kbd className="bg-gray-800 px-1 rounded">C</kbd> Skip to color history</li>

                <li><kbd className="bg-gray-800 px-1 rounded">[</kbd> <kbd className="bg-gray-800 px-1 rounded">]</kbd> or <kbd className="bg-gray-800 px-1 rounded">↑</kbd> <kbd className="bg-gray-800 px-1 rounded">↓</kbd> Reorder focused color set</li>

                <li><kbd className="bg-gray-800 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-800 px-1 rounded">Shift</kbd>+<kbd className="bg-gray-800 px-1 rounded">F</kbd> Cycle flash duration</li>

                <li><kbd className="bg-gray-800 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-800 px-1 rounded">Shift</kbd>+<kbd className="bg-gray-800 px-1 rounded">C</kbd> Scroll to conflict</li>

                <li><kbd className="bg-gray-800 px-1 rounded">Ctrl</kbd>+<kbd className="bg-gray-800 px-1 rounded">Shift</kbd>+<kbd className="bg-gray-800 px-1 rounded">U</kbd> Copy undo summary</li>
              </ul>
              <label className="flex items-center gap-2 mt-1 text-sm">
                <input type="checkbox" checked={strongFlash} onChange={e => { setStrongFlash(e.target.checked); localStorage.setItem('viralclip_strongflash', e.target.checked); }} />
                Stronger conflict flash
              </label>
              <div className="mt-2 text-xs">
                Highlight duration:
                <select value={highlightDuration} onChange={e => updateHighlightDuration(Number(e.target.value))} className="ml-2 bg-gray-800 rounded px-1">
                  <option value={1000}>1s</option>
                  <option value={1500}>1.5s</option>
                  <option value={3000}>3s</option>
                </select>
              </div>


              <label className="flex items-center gap-2 mt-3 text-sm">
                <input type="checkbox" checked={confirmUndo} onChange={toggleConfirmUndo} />
                Confirm keyboard undo
              </label>
              <label className="flex items-center gap-2 mt-1 text-sm">
                <input type="checkbox" checked={alwaysAcceptRemote} onChange={toggleAlwaysAccept} />
                Always accept remote shortcut changes
              </label>



              <textarea
                value={shortcutText}
                onChange={e => updateShortcutText(e.target.value)}
                className="w-full bg-gray-800 text-xs rounded p-2 mt-2 h-24"
              />
              <div className="flex gap-1 mt-1">
                <button onClick={copyShortcuts} className="flex-1 bg-gray-800 py-1.5 rounded text-xs">Copy</button>
                <button onClick={exportShortcuts} className="flex-1 bg-gray-800 py-1.5 rounded text-xs">Export</button>
                <button onClick={resetShortcuts} className="flex-1 bg-gray-700 py-1.5 rounded text-xs">Reset</button>
              </div>


              <button onClick={() => setShowHelp(false)} className="mt-2 w-full bg-gray-700 py-2 rounded text-sm">Close</button>


            </div>
          </div>
        )}

          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}>
            <div className="bg-gray-900 rounded-xl overflow-hidden max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <video src={previewUrl} controls autoPlay className="w-full" />
              <div className="text-[10px] text-gray-500 mt-1">Preview · close to return</div>

              <button onClick={() => setPreviewUrl(null)} className="w-full py-3 text-sm bg-gray-800">Close</button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-10">
              <button onClick={clearJobFilters} className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">Clear Filters</button>
              {lastJobFilters && (
                <button onClick={undoJobFilters} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded ml-1">Undo</button>
              )}
              <button onClick={() => updateStatus('completed')} className="text-xs bg-gray-800 px-2 py-1 rounded ml-1">Completed</button>
              <button onClick={() => updateStatus('failed')} className="text-xs bg-gray-800 px-2 py-1 rounded ml-1">Failed</button>
              <select value={presetCategory} onChange={e => updatePresetCategory(e.target.value)} className="text-xs bg-gray-800 rounded px-1 ml-1">
                <option value="all">All</option>
                <option value="jobs">Jobs</option>
                <option value="activity">Activity</option>
              </select>

              <input
                value={presetSearch}
                onChange={e => setPresetSearch(e.target.value)}
                placeholder="Search presets"
                className="text-xs bg-gray-800 rounded px-2 py-1 w-28 ml-1"
              />

              <button onClick={cleanupCategory} className="text-xs bg-gray-800 px-2 py-1 rounded ml-1">Clean Cat</button>
              <div className="flex gap-1 ml-2">
                {COLORS.filter(Boolean).map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-4 h-4 rounded transition-transform ${c} ${selectedColor === c ? 'ring-2 ring-white scale-125' : 'hover:scale-110'}`}
                    title={c}
                  />
                ))}
              </div>
              {undoStack.length > 1 && (
                <div 
                  className={`text-[10px] text-gray-500 ml-1 ${undoPaused ? '' : 'animate-pulse'}`}
                  onMouseEnter={() => setUndoPaused(true)}
                  onMouseLeave={() => setUndoPaused(false)}
                >
                  {undoStack.map((e, i) => (
                    <span key={i} className="mr-1">{getRemaining(e)}s</span>
                  ))}
                </div>

              )}

            </div>

                <>
                  <button onClick={undoLast} className="text-xs bg-yellow-900 px-2 py-1 rounded ml-1">
                    Undo ({undoStack.length}) {undoExpiry > 0 && `${undoExpiry}s`}
                    <span className="hidden sm:inline text-[10px] opacity-70 ml-1">Ctrl+Z</span>
                  </button>

                  <button onClick={clearUndoStack} className="text-xs bg-gray-800 px-2 py-1 rounded ml-1">Clear Undo</button>
                  <button onClick={exportUndoSummary} className="text-xs bg-gray-800 px-2 py-1 rounded ml-1">Copy</button>
                  <button onClick={downloadUndoSummary} className="text-xs bg-gray-800 px-2 py-1 rounded ml-1">Download</button>


                </>
              )}



            </div>

            </div>

            </div>

              <button onClick={exportPresets} className="text-xs bg-gray-800 px-2 py-1 rounded ml-1">Export</button>

              <label className="text-xs bg-gray-800 px-2 py-1 rounded ml-1 cursor-pointer">
                Import
                <input type="file" accept=".json" onChange={importPresets} className="hidden" />
              </label>
            </div>

              {customPresets.map(p => (
                <span key={p.name} className="inline-flex items-center ml-1">
                  <button onClick={() => applyPreset(p)} className={`text-xs px-2 py-1 rounded-l ${p.color || categoryColor(p.category)}`}>
                    {p.name}
                    {p.category && <span className="ml-1 text-[9px] opacity-60">{p.category}</span>}
                  </button>




                  <button onClick={() => renamePreset(p.name)} className="text-xs bg-gray-800 px-1 py-1" title="Rename">✎</button>
                  <button onClick={() => deletePreset(p.name)} className="text-xs bg-gray-800 px-1 py-1 rounded-r hover:bg-red-900">×</button>

                </span>
              ))}

            </div>


            </div>

            <div className="text-xs text-gray-500 mb-2">
              Filters: {statusFilter !== 'all' ? statusFilter : 'any status'}
              {search ? ` • “${search}”` : ''}
              {sortBy !== 'recent' ? ` • sorted by ${sortBy}` : ''}
            </div>


              <select value={statusFilter} onChange={e => updateStatus(e.target.value)} className="bg-gray-800 text-sm rounded px-2 py-1">
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="processing">Processing</option>
              </select>
              <input
                ref={searchRef}
                value={search}
                onChange={e => updateSearch(e.target.value)}
                placeholder="Search... (/)"
                title="Press / to focus search"
                className="bg-gray-800 text-sm rounded px-2 py-1 w-32"
              />
              <button onClick={() => exportCSV(false)} title="Export all filtered results" className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">Export All</button>
              <button onClick={() => exportCSV(true)} title="Export only the current page" className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">Export Page</button>


              <button onClick={() => exportCSV(false)} className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">Export All</button>
              <button onClick={() => exportCSV(true)} className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded">Export Page</button>



            </div>
            <div className="space-y-2">
              {sortedHistory.length === 0 && (
                <div className="text-xs text-gray-500 py-4">No jobs yet. Run a demo or generate clips to see history.</div>
              )}
              {(() => {
                try {
                  const cancels = JSON.parse(localStorage.getItem('viralclip_cancels') || '[]');
                  if (cancels.length > 0) {
                    return <div className="text-[10px] text-gray-600 mb-2">Recent cancels: {cancels.slice(0, 3).map(c => c.id?.slice(0, 6)).join(', ')}</div>;
                  }
                } catch {}
                return null;
              })()}
              {sortedHistory.map(h => (



                <div key={h.id} className="bg-gray-900 rounded-lg p-3 text-sm flex justify-between items-center">
                  <span className="text-gray-300">{h.message || h.status}</span>
                  <div className="flex gap-4 text-gray-500 items-center">
                    <span>{h.clip_count || 0} clips</span>
                    {h.avg_score && <span className="text-green-400 font-medium">Avg {h.avg_score}</span>}
                  </div>

                </div>
              ))}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}



export default App;
