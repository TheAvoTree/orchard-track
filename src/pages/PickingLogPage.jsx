import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '../hooks/useApi.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYMD(date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

// ── Worker Login ──────────────────────────────────────────────────────────────

function WorkerLogin({ workers, onLogin }) {
  const [name, setName] = useState('');
  const [pin,  setPin]  = useState('');
  const [err,  setErr]  = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!name || !pin) { setErr('Select your name and enter your PIN.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${BACKEND}/api/picking-logs/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Login failed'); return; }
      localStorage.setItem('picking_worker', JSON.stringify(data));
      onLogin(data);
    } catch {
      setErr('Server error — try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', minHeight: 400, padding: '2rem' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '2rem 2.5rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxWidth: 360, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🥑</div>
          <h2 style={{ margin: '0.5rem 0 0.25rem', color: '#11420A', fontSize: '1.3rem' }}>
            Picking Log
          </h2>
          <div style={{ color: '#5a6a5a', fontSize: '0.88rem' }}>Sign in to record your bins</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.88rem', fontWeight: 600, color: '#3a4a3a' }}>
            Your name
            <select value={name} onChange={e => setName(e.target.value)}
              style={{ padding: '0.55rem 0.75rem', borderRadius: 8, border: '1.5px solid #d4e0d4',
                fontSize: '0.95rem', background: '#fff', color: name ? '#1a2a1a' : '#aaa' }}>
              <option value="">— Select your name —</option>
              {workers?.filter(w => w.active).map(w => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.88rem', fontWeight: 600, color: '#3a4a3a' }}>
            PIN
            <input type="password" inputMode="numeric" maxLength={8} value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter your PIN"
              style={{ padding: '0.55rem 0.75rem', borderRadius: 8, border: '1.5px solid #d4e0d4',
                fontSize: '1.1rem', letterSpacing: '0.2em', textAlign: 'center' }} />
          </label>

          {err && (
            <div style={{ background: '#fdf0f0', border: '1px solid #f5c6c6', borderRadius: 6,
              padding: '0.5rem 0.75rem', color: '#c0392b', fontSize: '0.85rem' }}>
              {err}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn btn-primary"
            style={{ padding: '0.65rem', fontSize: '1rem', fontWeight: 700 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Log Entry Form ────────────────────────────────────────────────────────────

function LogEntryForm({ worker, growers, date, existingLogs, onSaved, onClose }) {
  const [entries, setEntries] = useState(() => {
    // Pre-populate from existing logs for this date
    const map = {};
    for (const l of existingLogs) map[l.grower_id] = l;
    return map;
  });
  const [saving, setSaving] = useState(false);

  const activeLogs = Object.values(entries).filter(e => e.bins_picked > 0 || e.id);

  function setEntry(growerId, field, value) {
    setEntries(prev => ({
      ...prev,
      [growerId]: { ...prev[growerId], grower_id: growerId, [field]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    const toSave = Object.values(entries).filter(e => e.bins_picked > 0 || e.id);
    try {
      for (const e of toSave) {
        if (!e.bins_picked && e.id) {
          // Delete entry if bins zeroed out
          await fetch(`${BACKEND}/api/picking-logs/${e.id}`, { method: 'DELETE' });
        } else if (e.bins_picked > 0) {
          await fetch(`${BACKEND}/api/picking-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              worker_id: worker.id,
              grower_id: e.grower_id,
              log_date: date,
              bins_picked: Number(e.bins_picked),
              notes: e.notes || null,
            }),
          });
        }
      }
      onSaved();
    } catch {
      alert('Failed to save — try again.');
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #eef2ee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#11420A' }}>Log Bins</div>
            <div style={{ fontSize: '0.85rem', color: '#5a6a5a', marginTop: 2 }}>{dateLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            fontSize: '1.4rem', cursor: 'pointer', color: '#999', padding: '0 4px' }}>✕</button>
        </div>

        {/* Body — orchard entries */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#5a6a5a', marginBottom: '0.75rem' }}>
            Enter the number of bins picked at each orchard. Leave blank if not visited.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {growers?.filter(g => g.active !== false).map(g => {
              const e = entries[g.id] || {};
              return (
                <div key={g.id} style={{
                  border: '1.5px solid',
                  borderColor: e.bins_picked > 0 ? '#2d6a1f' : '#eef2ee',
                  borderRadius: 10, padding: '0.7rem 0.9rem',
                  background: e.bins_picked > 0 ? '#f7fbf7' : '#fff',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#11420A' }}>{g.name}</div>
                      <div style={{ fontSize: '0.77rem', color: '#5a6a5a' }}>{g.address}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number" min="0" step="0.5"
                        value={e.bins_picked || ''}
                        onChange={ev => setEntry(g.id, 'bins_picked', ev.target.value)}
                        placeholder="0"
                        style={{
                          width: 72, padding: '0.4rem 0.5rem', borderRadius: 7,
                          border: '1.5px solid #d4e0d4', fontSize: '1rem',
                          textAlign: 'center', fontWeight: 600,
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>bins</span>
                    </div>
                  </div>
                  {e.bins_picked > 0 && (
                    <input
                      type="text"
                      value={e.notes || ''}
                      onChange={ev => setEntry(g.id, 'notes', ev.target.value)}
                      placeholder="Notes (optional)"
                      style={{
                        marginTop: '0.5rem', width: '100%', padding: '0.35rem 0.5rem',
                        borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.83rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eef2ee',
          display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: '0.85rem', color: '#5a6a5a' }}>
            {Object.values(entries).filter(e => e.bins_picked > 0).length} orchards ·{' '}
            {Object.values(entries).reduce((s, e) => s + (Number(e.bins_picked) || 0), 0)} bins total
          </div>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function Calendar({ year, month, dailyTotals, onSelectDay, selectedDate }) {
  const days = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month); // 0=Sun
  const todayStr = toYMD(new Date());

  const totalMap = useMemo(() => {
    const m = {};
    for (const d of (dailyTotals || [])) m[d.date] = d;
    return m;
  }, [dailyTotals]);

  // Max bins in month for heatmap scaling
  const maxBins = Math.max(1, ...Object.values(totalMap).map(d => Number(d.total_bins)));

  const cells = [];
  // Empty cells before the 1st
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700,
            color: '#5a6a5a', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const info = totalMap[dateStr];
          const bins = info ? Number(info.total_bins) : 0;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isFuture = dateStr > todayStr;
          const heat = bins > 0 ? Math.max(0.15, bins / maxBins) : 0;

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelectDay(dateStr)}
              disabled={isFuture}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: isSelected ? '2.5px solid #11420A' : isToday ? '2px solid #2d6a1f' : '1.5px solid #eef2ee',
                background: isSelected
                  ? '#2d6a1f'
                  : bins > 0
                  ? `rgba(45,106,31,${heat * 0.7 + 0.1})`
                  : isFuture ? '#f9f9f9' : '#fff',
                color: isSelected ? '#fff' : isFuture ? '#ccc' : '#11420A',
                cursor: isFuture ? 'not-allowed' : 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '2px',
                transition: 'all 0.1s',
                minHeight: 44,
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: isToday ? 700 : 500 }}>{day}</span>
              {bins > 0 && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700,
                  color: isSelected ? '#c8f0c8' : '#11420A', lineHeight: 1 }}>
                  {bins % 1 === 0 ? bins : bins.toFixed(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PickingLogPage() {
  const [worker, setWorker] = useState(() => {
    try { return JSON.parse(localStorage.getItem('picking_worker') || 'null'); }
    catch { return null; }
  });

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [showLogForm, setShowLogForm] = useState(false);

  // Admin can switch between "My logs" and "All logs"
  const [adminView, setAdminView] = useState(false);
  const isAdmin = worker?.role === 'admin';

  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const { data: workers, refetch: refetchWorkers } = useApi(`${BACKEND}/api/picking-logs/workers`);
  const { data: growers } = useApi(`${BACKEND}/api/growers`);

  // Logs for the viewed month (filtered by worker unless admin view)
  const logsUrl = worker
    ? `${BACKEND}/api/picking-logs?month=${monthStr}${!adminView ? `&worker_id=${worker.id}` : ''}`
    : null;
  const { data: monthLogs, refetch: refetchLogs } = useApi(logsUrl);

  // Summary for the month
  const summaryUrl = worker
    ? `${BACKEND}/api/picking-logs/summary?month=${monthStr}${!adminView ? `&worker_id=${worker.id}` : ''}`
    : null;
  const { data: summary, refetch: refetchSummary } = useApi(summaryUrl);

  // Logs for the selected day
  const dayLogs = useMemo(() => {
    if (!monthLogs) return [];
    return monthLogs.filter(l => l.log_date?.slice(0, 10) === selectedDate);
  }, [monthLogs, selectedDate]);

  // Existing logs for selected day by grower_id (for pre-filling the form)
  const dayLogsByGrower = useMemo(() => {
    const m = {};
    for (const l of dayLogs) m[l.grower_id] = l;
    return m;
  }, [dayLogs]);

  function handleSaved() {
    setShowLogForm(false);
    refetchLogs();
    refetchSummary();
  }

  function logout() {
    localStorage.removeItem('picking_worker');
    setWorker(null);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }


  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!worker) {
    return <WorkerLogin workers={workers} onLogin={setWorker} />;
  }

  const selectedDateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const dayTotal = dayLogs.reduce((s, l) => s + Number(l.bins_picked), 0);
  const monthTotal = summary?.byWorker?.find(w => w.worker_id === worker.id)?.total_bins;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Page header */}
      <div style={{ padding: '0.9rem 1.5rem', borderBottom: '1px solid #eef2ee',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        background: '#fff' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#11420A', fontWeight: 700 }}>
            🥑 Picking Log
          </h2>
          <div style={{ fontSize: '0.82rem', color: '#5a6a5a', marginTop: 2 }}>
            Signed in as <strong>{worker.name}</strong>
            {isAdmin && <span style={{ marginLeft: 6, background: '#2d6a1f', color: '#fff',
              borderRadius: 4, padding: '1px 7px', fontSize: '0.74rem' }}>Admin</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button className={`btn ${adminView ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAdminView(v => !v)}
              style={{ fontSize: '0.82rem' }}>
              {adminView ? '👥 All Workers' : '👤 My Logs'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={logout} style={{ fontSize: '0.82rem' }}>
            Sign Out
          </button>
        </div>
      </div>


      {/* Main content: calendar + sidebar */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: calendar panel */}
        <div style={{ width: 380, minWidth: 320, borderRight: '1px solid #eef2ee',
          padding: '1.2rem', overflowY: 'auto', background: '#fff' }}>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '0.75rem' }}>
            <button onClick={prevMonth} className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '1rem' }}>‹</button>
            <div style={{ fontWeight: 700, color: '#11420A', fontSize: '1rem' }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button onClick={nextMonth} className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '1rem' }}
              disabled={viewYear === today.getFullYear() && viewMonth >= today.getMonth()}>›</button>
          </div>

          <Calendar
            year={viewYear}
            month={viewMonth}
            dailyTotals={summary?.daily || []}
            selectedDate={selectedDate}
            onSelectDay={setSelectedDate}
          />

          {/* Month total */}
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f7fbf7',
            borderRadius: 10, border: '1px solid #d4e0d4' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#11420A' }}>
              {MONTH_NAMES[viewMonth]} Total
            </div>
            {adminView ? (
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2d6a1f', lineHeight: 1.2 }}>
                {summary?.byWorker?.reduce((s, w) => s + Number(w.total_bins), 0) || 0}
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#5a6a5a', marginLeft: 6 }}>bins</span>
              </div>
            ) : (
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2d6a1f', lineHeight: 1.2 }}>
                {monthTotal || 0}
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#5a6a5a', marginLeft: 6 }}>bins</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: day detail + summary */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Day panel */}
          <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid #eef2ee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#11420A' }}>{selectedDateLabel}</div>
                {dayTotal > 0 && (
                  <div style={{ fontSize: '0.85rem', color: '#2d6a1f', marginTop: 2 }}>
                    {dayTotal} bin{dayTotal !== 1 ? 's' : ''} total
                    {adminView && dayLogs.length > 0 && ` across ${new Set(dayLogs.map(l => l.worker_id)).size} worker${new Set(dayLogs.map(l => l.worker_id)).size !== 1 ? 's' : ''}`}
                  </div>
                )}
              </div>
              {selectedDate <= toYMD(today) && (
                <button className="btn btn-primary"
                  onClick={() => setShowLogForm(true)}
                  style={{ fontSize: '0.88rem' }}>
                  {dayLogs.some(l => l.worker_id === worker.id) ? '✎ Edit Log' : '+ Log Bins'}
                </button>
              )}
            </div>

            {dayLogs.length === 0 ? (
              <div style={{ color: '#aaa', fontSize: '0.88rem', padding: '1rem 0' }}>
                No bins logged {selectedDate > toYMD(today) ? '(future date)' : 'for this day'}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dayLogs.map(l => (
                  <div key={l.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.85rem', background: '#f7fbf7',
                    borderRadius: 9, border: '1px solid #d4e0d4',
                  }}>
                    {adminView && (
                      <div style={{ width: 32, height: 32, borderRadius: '50%',
                        background: '#2d6a1f', color: '#fff', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                        {l.worker_name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#11420A', fontSize: '0.9rem' }}>
                        {l.grower_name}
                      </div>
                      {adminView && (
                        <div style={{ fontSize: '0.78rem', color: '#5a6a5a' }}>{l.worker_name}</div>
                      )}
                      {l.notes && (
                        <div style={{ fontSize: '0.78rem', color: '#5a6a5a', marginTop: 1 }}>{l.notes}</div>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#2d6a1f', flexShrink: 0 }}>
                      {Number(l.bins_picked) % 1 === 0 ? Number(l.bins_picked) : Number(l.bins_picked).toFixed(1)}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#5a6a5a', marginLeft: 3 }}>bins</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly summary tables */}
          <div style={{ padding: '1.2rem 1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>

            {/* By grower */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#11420A', marginBottom: '0.6rem' }}>
                {MONTH_NAMES[viewMonth]} by Orchard
              </div>
              {!summary?.byGrower?.length ? (
                <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No data yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {summary.byGrower.map(g => (
                    <div key={g.grower_id} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '0.45rem 0.7rem', background: '#f7fbf7',
                      borderRadius: 7, border: '1px solid #eef2ee', fontSize: '0.85rem',
                    }}>
                      <div style={{ flex: 1, fontWeight: 500, color: '#11420A' }}>{g.grower_name}</div>
                      <div style={{ fontWeight: 700, color: '#2d6a1f' }}>
                        {Number(g.total_bins) % 1 === 0 ? Number(g.total_bins) : Number(g.total_bins).toFixed(1)} bins
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By worker (admin only) */}
            {isAdmin && adminView && (
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#11420A', marginBottom: '0.6rem' }}>
                  {MONTH_NAMES[viewMonth]} by Worker
                </div>
                {!summary?.byWorker?.length ? (
                  <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No data yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {summary.byWorker.map(w => (
                      <div key={w.worker_id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.45rem 0.7rem', background: '#f7fbf7',
                        borderRadius: 7, border: '1px solid #eef2ee', fontSize: '0.85rem',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#11420A' }}>{w.worker_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#5a6a5a' }}>
                            {w.days_worked} day{w.days_worked !== '1' ? 's' : ''} · {w.grower_count} orchard{w.grower_count !== '1' ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#2d6a1f' }}>
                          {Number(w.total_bins) % 1 === 0 ? Number(w.total_bins) : Number(w.total_bins).toFixed(1)} bins
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log entry modal */}
      {showLogForm && (
        <LogEntryForm
          worker={worker}
          growers={growers}
          date={selectedDate}
          existingLogs={dayLogsByGrower}
          onSaved={handleSaved}
          onClose={() => setShowLogForm(false)}
        />
      )}
    </div>
  );
}
