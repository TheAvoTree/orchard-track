import { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi.js';
import { useSettings } from '../hooks/useSettings.js';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function calcPickDate(dmResult, dmDate, dmRate, dmTarget) {
  if (!dmResult || !dmDate || !dmRate || !dmTarget) return null;
  const current = parseFloat(dmResult);
  const target  = parseFloat(dmTarget);
  const rate    = parseFloat(dmRate);
  if (current >= target) return { date: new Date(dmDate), daysFromNow: 0 }; // already ready
  const daysNeeded = Math.ceil((target - current) / rate);
  const pick = new Date(dmDate);
  pick.setDate(pick.getDate() + daysNeeded);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysFromNow = Math.ceil((pick - today) / 86400000);
  return { date: pick, daysFromNow };
}

function fmtDate(d) {
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}
const VARIETIES = ['Hass', 'Gem', 'Reed'];

const VARIETY_STYLE = {
  Hass: { bg: '#e8f5e8', fg: '#1a5c1a', border: '#a8d8a8' },
  Gem:  { bg: '#fff8e1', fg: '#7a5500', border: '#ffc947' },
  Reed: { bg: '#e8ecf8', fg: '#1a3a8c', border: '#8899dd' },
};

const STATUS_LABELS = { pending: 'Not Started', first_pick: 'First Pick ✓', complete: 'Complete ✓✓' };
const STATUS_NEXT   = { pending: 'first_pick', first_pick: 'complete', complete: 'pending' };
const STATUS_COLORS = {
  pending:    { bg: '#f5f5f5', fg: '#666',    border: '#ddd' },
  first_pick: { bg: '#fff3cd', fg: '#856404', border: '#ffc107' },
  complete:   { bg: '#d4edda', fg: '#155724', border: '#28a745' },
};

const TH = { padding: '0.55rem 0.65rem', fontWeight: 700, color: '#2d6a2d', fontSize: '0.8rem', textAlign: 'center' };
const TD = { padding: '0.5rem 0.65rem', verticalAlign: 'middle' };

const SEASON = '2026/27';

export default function PickingPlanPage() {
  const { settings } = useSettings();
  const dmRate   = settings?.dm_rate_per_day ?? '0.071';
  const dmTarget = settings?.dm_minimum      ?? '24';

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVariety, setFilterVariety] = useState('all');
  const [importing, setImporting]   = useState(false);
  const [importMsg, setImportMsg]   = useState(null);
  const [showAdd, setShowAdd]       = useState(false);

  const { data: entries, refetch } = useApi(`/api/picking-plan?season=${encodeURIComponent(SEASON)}`);

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries
      .filter(e => {
        if (filterStatus !== 'all' && e.status !== filterStatus) return false;
        if (filterVariety !== 'all' && e.variety !== filterVariety) return false;
        return true;
      })
      .sort((a, b) => {
        const ma = a.expected_month ?? 99;
        const mb = b.expected_month ?? 99;
        if (ma !== mb) return ma - mb;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
  }, [entries, filterStatus, filterVariety]);

  const stats = useMemo(() => {
    if (!entries?.length) return null;
    const totalBins      = entries.reduce((s, e) => s + (Number(e.estimated_bins)    || 0), 0);
    const prevTotalBins  = entries.reduce((s, e) => s + (Number(e.prev_season_bins)  || 0), 0);
    const byVariety = {};
    for (const v of VARIETIES) {
      byVariety[v] = entries.filter(e => e.variety === v).length;
    }
    return {
      total:        entries.length,
      totalBins,
      prevTotalBins,
      firstPick:    entries.filter(e => e.status === 'first_pick').length,
      complete:     entries.filter(e => e.status === 'complete').length,
      secondNeeded: entries.filter(e => e.second_pick_needed && e.status !== 'complete').length,
      byVariety,
    };
  }, [entries]);

  const statusCounts = useMemo(() => ({
    all:        filtered.length,
    pending:    filtered.filter(e => e.status === 'pending').length,
    first_pick: filtered.filter(e => e.status === 'first_pick').length,
    complete:   filtered.filter(e => e.status === 'complete').length,
  }), [filtered]);

  async function handleImport() {
    setImporting(true); setImportMsg(null);
    try {
      const res = await fetch('/api/picking-plan/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON }),
      });
      const data = await res.json();
      if (!res.ok) setImportMsg({ error: data.error || 'Import failed' });
      else {
        setImportMsg({ ok: `${data.imported} entries loaded${data.unmatched > 0 ? ` · ${data.unmatched} unmatched` : ''}` });
        refetch();
      }
    } catch (e) { setImportMsg({ error: e.message }); }
    setImporting(false);
  }

  async function patch(id, body) {
    await fetch(`/api/picking-plan/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    refetch();
  }

  async function deleteEntry(id) {
    await fetch(`/api/picking-plan/${id}`, { method: 'DELETE' });
    refetch();
  }

  const showPrevBins = entries?.some(e => Number(e.prev_season_bins) > 0);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Picking Plan</h1>
          <span style={{ fontSize: '0.85rem', color: '#5a6a5a', padding: '0.3rem 0.75rem',
            background: '#f5f9f5', borderRadius: 8, border: '1px solid #d4e0d4' }}>2026/27</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {entries?.length > 0 && (
            <button className="btn" onClick={() => setShowAdd(v => !v)} style={{ fontSize: '0.85rem' }}>
              {showAdd ? 'Cancel' : '+ Add Grower'}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? 'Syncing…' : entries?.length ? 'Re-sync 2026/27' : 'Import 2026/27 Data'}
          </button>
          {importMsg?.ok    && <span style={{ fontSize: '0.82rem', color: '#155724' }}>✓ {importMsg.ok}</span>}
          {importMsg?.error && <span style={{ fontSize: '0.82rem', color: '#c0392b' }}>{importMsg.error}</span>}
        </div>
      </div>

      {/* Add grower */}
      {showAdd && (
        <AddGrowerForm onAdded={() => { setShowAdd(false); refetch(); }} />
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="card" style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2d6a2d' }}>{stats.total}</div>
            <div style={{ fontSize: '0.72rem', color: '#5a6a5a' }}>Total Orchards</div>
          </div>
          {/* Variety breakdown */}
          {VARIETIES.filter(v => stats.byVariety[v] > 0).map(v => {
            const vs = VARIETY_STYLE[v];
            return (
              <div key={v} className="card" style={{ padding: '0.6rem 1rem', textAlign: 'center',
                background: vs.bg, border: `1px solid ${vs.border}` }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: vs.fg }}>{stats.byVariety[v]}</div>
                <div style={{ fontSize: '0.72rem', color: vs.fg }}>{v}</div>
              </div>
            );
          })}
          {stats.totalBins > 0 && (
            <div className="card" style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2d6a2d' }}>
                {Math.round(stats.totalBins).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#5a6a5a' }}>Total Bins</div>
            </div>
          )}
          {(stats.firstPick > 0 || stats.complete > 0) && <>
            <div className="card" style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#856404' }}>{stats.firstPick}</div>
              <div style={{ fontSize: '0.72rem', color: '#5a6a5a' }}>First Pick Done</div>
            </div>
            <div className="card" style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#155724' }}>{stats.complete}</div>
              <div style={{ fontSize: '0.72rem', color: '#5a6a5a' }}>Complete</div>
            </div>
          </>}
        </div>
      )}

      {/* Variety filter */}
      {entries?.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#5a6a5a', marginRight: 2 }}>Variety:</span>
          {['all', ...VARIETIES].map(v => {
            const vs = v !== 'all' ? VARIETY_STYLE[v] : null;
            const active = filterVariety === v;
            return (
              <button key={v} onClick={() => setFilterVariety(v)} style={{
                padding: '0.2rem 0.7rem', borderRadius: 12, border: '1px solid', cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: active ? 700 : 400,
                borderColor: active ? (vs?.border || '#2d6a2d') : '#d4e0d4',
                background:  active ? (vs?.bg    || '#2d6a2d') : '#fff',
                color:       active ? (vs?.fg    || '#fff')    : '#5a6a5a',
              }}>
                {v === 'all' ? 'All Varieties' : v}
                {v !== 'all' && stats && ` (${stats.byVariety[v] || 0})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Status filter */}
      {entries?.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#5a6a5a', marginRight: 2 }}>Status:</span>
          {[
            { key: 'all',        label: 'All' },
            { key: 'pending',    label: 'Not Started' },
            { key: 'first_pick', label: 'First Pick' },
            { key: 'complete',   label: 'Complete' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)} style={{
              padding: '0.2rem 0.7rem', borderRadius: 12, border: '1px solid', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: filterStatus === f.key ? 700 : 400,
              borderColor: filterStatus === f.key ? '#2d6a2d' : '#d4e0d4',
              background:  filterStatus === f.key ? '#2d6a2d' : '#fff',
              color:       filterStatus === f.key ? '#fff'    : '#5a6a5a',
            }}>
              {f.label} ({statusCounts[f.key]})
            </button>
          ))}
        </div>
      )}

      {!entries && <div className="state-loading">Loading…</div>}

      {entries?.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#5a6a5a' }}>
          <p style={{ marginTop: 0 }}>No 26/27 plan yet. Click 'Import 2026/27 Data' to build from last season's data.</p>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? 'Loading…' : 'Import 2026/27 Data'}
          </button>
          {importMsg?.error && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: 0 }}>{importMsg.error}</p>}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#f5f9f5', borderBottom: '2px solid #d4e0d4' }}>
                <th style={TH}>#</th>
                <th style={{ ...TH, textAlign: 'left' }}>Grower</th>
                <th style={TH}>Variety</th>
                {showPrevBins && <th style={TH}>25/26<br/>Bins</th>}
                <th style={TH}>Bins</th>
                <th style={TH}>Picking Month</th>
                <th style={TH}>Status</th>
                <th style={TH} title="Second pick needed">2nd</th>
                <th style={TH} title="Dry matter % and collection date">DM %</th>
                <th style={TH} title="Estimated safe-to-pick date based on dry matter">Safe to Pick</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => {
                const sc = STATUS_COLORS[entry.status];
                const vs = entry.variety ? VARIETY_STYLE[entry.variety] : null;
                return (
                  <tr key={entry.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafcfa', borderBottom: '1px solid #eef2ee' }}>
                    <td style={{ ...TD, color: '#bbb', width: 30, textAlign: 'center', fontSize: '0.75rem' }}>
                      {entry.sort_order}
                    </td>
                    <td style={{ ...TD, fontWeight: 500 }}>
                      {entry.grower_name || entry.grower_name_raw}
                      {!entry.grower_id && (
                        <span style={{ fontSize: '0.68rem', color: '#f0a500', marginLeft: 4 }}>unmatched</span>
                      )}
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      {vs ? (
                        <span style={{ background: vs.bg, color: vs.fg, border: `1px solid ${vs.border}`,
                          borderRadius: 10, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {entry.variety}
                        </span>
                      ) : <span style={{ color: '#bbb', fontSize: '0.75rem' }}>—</span>}
                    </td>
                    {showPrevBins && (
                      <td style={{ ...TD, textAlign: 'center', color: '#888', fontSize: '0.8rem' }}>
                        {Number(entry.prev_season_bins) > 0 ? Number(entry.prev_season_bins).toFixed(1) : '—'}
                      </td>
                    )}
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <InlineNumber value={entry.estimated_bins}
                        onSave={v => patch(entry.id, { estimated_bins: v })} />
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <select value={entry.expected_month || ''}
                        onChange={e => patch(entry.id, { expected_month: parseInt(e.target.value) || null })}
                        style={{ border: '1px solid #d4e0d4', borderRadius: 4, padding: '0.2rem 0.25rem', fontSize: '0.8rem', background: '#fff' }}>
                        <option value="">—</option>
                        {MONTHS.slice(1).map((m, idx) => (
                          <option key={idx + 1} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <button onClick={() => patch(entry.id, { status: STATUS_NEXT[entry.status] })}
                        title="Click to advance status"
                        style={{ padding: '0.2rem 0.5rem', borderRadius: 10, cursor: 'pointer',
                          border: `1px solid ${sc.border}`, background: sc.bg, color: sc.fg,
                          fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {STATUS_LABELS[entry.status]}
                      </button>
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <input type="checkbox" checked={entry.second_pick_needed}
                        onChange={() => patch(entry.id, { second_pick_needed: !entry.second_pick_needed })}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#c0392b' }} />
                    </td>
                    {/* DM % + collection date */}
                    <td style={{ ...TD, textAlign: 'center', minWidth: 90 }}>
                      <DmCell
                        dmResult={entry.dm_result}
                        dmDate={entry.dm_date}
                        onSave={(result, date) => patch(entry.id, { dm_result: result, dm_date: date })}
                      />
                    </td>
                    {/* Safe to pick date */}
                    <td style={{ ...TD, textAlign: 'center', minWidth: 100 }}>
                      <SafeToPickCell
                        dmResult={entry.dm_result}
                        dmDate={entry.dm_date}
                        dmRate={dmRate}
                        dmTarget={dmTarget}
                      />
                    </td>
                    <td style={{ ...TD, textAlign: 'center', width: 28 }}>
                      <DeleteButton onDelete={() => deleteEntry(entry.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InlineNumber({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState('');
  if (!editing) {
    return (
      <span onClick={() => { setVal(value ?? ''); setEditing(true); }} title="Click to edit"
        style={{ cursor: 'pointer', padding: '0.15rem 0.35rem', borderRadius: 4,
          minWidth: 32, display: 'inline-block', textAlign: 'center',
          background: value ? 'transparent' : '#f5f5f5', color: value ? '#222' : '#ccc' }}>
        {value ?? '—'}
      </span>
    );
  }
  return (
    <input autoFocus type="number" value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { setEditing(false); onSave(parseInt(val) || null); }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
      style={{ width: 60, padding: '0.15rem 0.25rem', border: '1px solid #2d6a2d',
        borderRadius: 4, fontSize: '0.82rem', textAlign: 'center' }} />
  );
}

function DeleteButton({ onDelete }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <span style={{ display: 'inline-flex', gap: 3 }}>
        <button onClick={onDelete}
          style={{ padding: '1px 6px', borderRadius: 4, border: '1px solid #c0392b',
            background: '#c0392b', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
          Yes
        </button>
        <button onClick={() => setConfirm(false)}
          style={{ padding: '1px 6px', borderRadius: 4, border: '1px solid #ccc',
            background: '#fff', color: '#666', cursor: 'pointer', fontSize: '0.72rem' }}>
          No
        </button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirm(true)} title="Remove from plan"
      style={{ padding: '1px 6px', borderRadius: 4, border: '1px solid transparent',
        background: 'none', color: '#ccc', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1 }}
      onMouseEnter={e => { e.target.style.color = '#c0392b'; e.target.style.borderColor = '#c0392b'; }}
      onMouseLeave={e => { e.target.style.color = '#ccc'; e.target.style.borderColor = 'transparent'; }}>
      ×
    </button>
  );
}

// Inline DM cell: shows "X.X% · dd Mon" when set, click to edit
function DmCell({ dmResult, dmDate, onSave }) {
  const [editing, setEditing] = useState(false);
  const [result, setResult]   = useState('');
  const [date, setDate]       = useState('');

  function startEdit() {
    setResult(dmResult != null ? String(dmResult) : '');
    setDate(dmDate ? dmDate.slice(0, 10) : '');
    setEditing(true);
  }

  function save() {
    setEditing(false);
    const r = parseFloat(result);
    onSave(isNaN(r) ? null : r, date || null);
  }

  if (!editing) {
    const hasData = dmResult != null;
    return (
      <span onClick={startEdit} title="Click to enter dry matter result"
        style={{ cursor: 'pointer', fontSize: '0.78rem', display: 'block',
          color: hasData ? '#1a5c1a' : '#bbb', lineHeight: 1.4 }}>
        {hasData ? (
          <>
            <span style={{ fontWeight: 700 }}>{parseFloat(dmResult).toFixed(1)}%</span>
            {dmDate && <span style={{ display: 'block', fontSize: '0.7rem', color: '#5a6a5a' }}>
              {fmtDate(new Date(dmDate))}
            </span>}
          </>
        ) : '—'}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
      <input autoFocus type="number" step="0.1" min="10" max="30" value={result}
        onChange={e => setResult(e.target.value)}
        placeholder="DM %"
        style={{ width: 60, padding: '0.15rem 0.25rem', border: '1px solid #2d6a2d',
          borderRadius: 4, fontSize: '0.78rem', textAlign: 'center' }} />
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        style={{ width: 112, padding: '0.15rem 0.25rem', border: '1px solid #2d6a2d',
          borderRadius: 4, fontSize: '0.75rem' }} />
      <div style={{ display: 'flex', gap: 3 }}>
        <button onClick={save}
          style={{ padding: '1px 7px', borderRadius: 4, border: 'none',
            background: '#2d6a2d', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
          ✓
        </button>
        <button onClick={() => setEditing(false)}
          style={{ padding: '1px 7px', borderRadius: 4, border: '1px solid #ccc',
            background: '#fff', color: '#666', cursor: 'pointer', fontSize: '0.72rem' }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// Read-only calculated safe-to-pick date
function SafeToPickCell({ dmResult, dmDate, dmRate, dmTarget }) {
  if (!dmResult || !dmDate) {
    return <span style={{ color: '#bbb', fontSize: '0.78rem' }}>—</span>;
  }

  const pick = calcPickDate(dmResult, dmDate, dmRate, dmTarget);
  if (!pick) return <span style={{ color: '#bbb', fontSize: '0.78rem' }}>—</span>;

  const { date, daysFromNow } = pick;

  // Already at or past target DM — ready now
  if (parseFloat(dmResult) >= parseFloat(dmTarget)) {
    return (
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#155724' }}>
        Ready ✓
      </span>
    );
  }

  let color, bg, label;
  if (daysFromNow <= 0) {
    color = '#721c24'; bg = '#f8d7da'; label = 'Overdue';
  } else if (daysFromNow <= 7) {
    color = '#856404'; bg = '#fff3cd'; label = `${daysFromNow}d`;
  } else {
    color = '#155724'; bg = '#d4edda'; label = `${daysFromNow}d`;
  }

  return (
    <span title={`${daysFromNow <= 0 ? 'Was ready' : 'Ready'} ${fmtDate(date)}`}
      style={{ fontSize: '0.78rem', lineHeight: 1.4, display: 'block' }}>
      <span style={{ fontWeight: 600, color }}>{fmtDate(date)}</span>
      <span style={{ display: 'inline-block', marginLeft: 3, padding: '0px 5px',
        borderRadius: 8, background: bg, color, fontSize: '0.7rem', fontWeight: 700 }}>
        {label}
      </span>
    </span>
  );
}

function AddGrowerForm({ onAdded }) {
  const [name, setName]         = useState('');
  const [variety, setVariety]   = useState('Hass');
  const [bins, setBins]         = useState('');
  const [prevBins, setPrevBins] = useState('');
  const [month, setMonth]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const { data: growers } = useApi('/api/growers');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');

    const norm  = s => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const target = norm(name.trim());
    const match  = growers?.find(g => {
      const gn = norm(g.name);
      return gn === target || gn.includes(target) || target.includes(gn);
    });

    try {
      const res = await fetch('/api/picking-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: SEASON, grower_id: match?.id ?? null,
          grower_name_raw:  name.trim(),
          variety:          variety || null,
          estimated_bins:   parseInt(bins) || null,
          prev_season_bins: parseFloat(prevBins) || null,
          expected_month:   parseInt(month) || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onAdded();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: '#f5f9f5' }}>
      <div style={{ fontWeight: 700, color: '#2d6a2d', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
        Add Grower to 2026/27 Plan
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 180px' }}>
            <label style={{ fontSize: '0.75rem', color: '#5a6a5a', display: 'block', marginBottom: 2 }}>Grower Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Andrew Clow" required
              style={{ width: '100%', padding: '0.38rem 0.55rem', borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.88rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '1 1 90px' }}>
            <label style={{ fontSize: '0.75rem', color: '#5a6a5a', display: 'block', marginBottom: 2 }}>Variety</label>
            <select value={variety} onChange={e => setVariety(e.target.value)}
              style={{ width: '100%', padding: '0.38rem 0.45rem', borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.88rem', boxSizing: 'border-box' }}>
              <option value="">—</option>
              {VARIETIES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 80px' }}>
            <label style={{ fontSize: '0.75rem', color: '#5a6a5a', display: 'block', marginBottom: 2 }}>25/26 Bins</label>
            <input type="number" value={prevBins} onChange={e => setPrevBins(e.target.value)} placeholder="—"
              style={{ width: '100%', padding: '0.38rem 0.45rem', borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.88rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '1 1 80px' }}>
            <label style={{ fontSize: '0.75rem', color: '#5a6a5a', display: 'block', marginBottom: 2 }}>Est. Bins</label>
            <input type="number" value={bins} onChange={e => setBins(e.target.value)} placeholder="—"
              style={{ width: '100%', padding: '0.38rem 0.45rem', borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.88rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '1 1 80px' }}>
            <label style={{ fontSize: '0.75rem', color: '#5a6a5a', display: 'block', marginBottom: 2 }}>Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)}
              style={{ width: '100%', padding: '0.38rem 0.45rem', borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.88rem', boxSizing: 'border-box' }}>
              <option value="">—</option>
              {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving || !name.trim()}
            style={{ padding: '0.38rem 0.9rem', alignSelf: 'flex-end' }}>
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
        {error && <div style={{ color: '#c0392b', fontSize: '0.82rem', marginTop: '0.4rem' }}>{error}</div>}
      </form>
    </div>
  );
}
