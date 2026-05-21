import { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYMD(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtLongDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtNum(n) {
  const v = Number(n) || 0;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

function daysAgo(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00');
  return Math.round((today - d) / 86400000);
}

const TODAY = toYMD(new Date());

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, sub, color = '#2d6a1f', warn }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '1rem 1.25rem',
      border: `1.5px solid ${warn ? '#f5c6c6' : '#d4e0d4'}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: '0.72rem', color: '#5a6a5a', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: warn ? '#c0392b' : color, lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#5a6a5a', marginLeft: 4 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: '0.76rem', color: '#5a6a5a', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Day pick log modal ────────────────────────────────────────────────────────

function DayPickModal({ date, growers, existingEntries, onSaved, onClose }) {
  // Build initial state from existing entries keyed by grower_id (null = no grower)
  const initEntries = () => {
    const map = {};
    for (const e of existingEntries) {
      const key = e.grower_id ?? 'none';
      map[key] = { ...e, bins: String(e.bins_picked) };
    }
    return map;
  };

  const [entries, setEntries] = useState(initEntries);
  const [saving, setSaving] = useState(false);

  // Active grower selections shown in the form
  const [selectedGrowers, setSelectedGrowers] = useState(() => {
    const keys = Object.keys(initEntries());
    return keys.length > 0 ? keys : ['none'];
  });

  function setField(key, field, val) {
    setEntries(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  }

  function addGrowerRow() {
    // Find first grower not already in the list
    const used = new Set(selectedGrowers.filter(k => k !== 'none').map(Number));
    const next = growers?.find(g => !used.has(g.id));
    if (!next) return;
    const key = String(next.id);
    setSelectedGrowers(prev => [...prev, key]);
  }

  function removeRow(key) {
    setSelectedGrowers(prev => prev.filter(k => k !== key));
    setEntries(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const key of selectedGrowers) {
        const e = entries[key] || {};
        const bins = Number(e.bins) || 0;
        const existingId = e.id;
        const growerId = key === 'none' ? null : Number(key);

        if (bins === 0 && existingId) {
          // Delete zeroed-out existing entry
          const res = await fetch(`${BACKEND}/api/harvest/picks/${existingId}`, { method: 'DELETE' });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || `Delete failed (${res.status})`);
          }
        } else if (bins > 0) {
          const res = await fetch(`${BACKEND}/api/harvest/picks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pick_date: date,
              grower_id: growerId,
              bins_picked: bins,
              notes: e.notes || null,
            }),
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || `Save failed (${res.status})`);
          }
        }
      }
      onSaved();
      onClose();
    } catch (err) { alert(`Failed to save: ${err.message}`); }
    finally { setSaving(false); }
  }

  const totalBins = selectedGrowers.reduce((s, k) => s + (Number(entries[k]?.bins) || 0), 0);
  const allGrowersUsed = growers && selectedGrowers.filter(k => k !== 'none').length >= growers.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid #eef2ee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#11420A' }}>Log Bins Picked</div>
            <div style={{ fontSize: '0.82rem', color: '#5a6a5a', marginTop: 1 }}>{fmtLongDate(date)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            fontSize: '1.3rem', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.4rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#5a6a5a', marginBottom: '0.75rem' }}>
            Select the orchard and enter bins picked. Add a row for each orchard visited today.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {selectedGrowers.map((key, idx) => {
              const e = entries[key] || {};
              return (
                <div key={key} style={{
                  border: `1.5px solid ${Number(e.bins) > 0 ? '#2d6a1f' : '#eef2ee'}`,
                  borderRadius: 10, padding: '0.7rem 0.85rem',
                  background: Number(e.bins) > 0 ? '#f7fbf7' : '#fff',
                }}>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    {/* Grower selector */}
                    <div style={{ flex: 1 }}>
                      <select
                        value={key}
                        onChange={ev => {
                          const newKey = ev.target.value;
                          const updatedList = [...selectedGrowers];
                          updatedList[idx] = newKey;
                          setSelectedGrowers(updatedList);
                          // Move entry data
                          const prev = entries[key];
                          setEntries(p => {
                            const n = { ...p };
                            if (prev) { n[newKey] = { ...prev }; delete n[key]; }
                            return n;
                          });
                        }}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: 7,
                          border: '1.5px solid #d4e0d4', fontSize: '0.9rem',
                          background: '#fff', color: '#11420A', fontWeight: 500 }}>
                        <option value="none">— No specific orchard —</option>
                        {growers?.map(g => (
                          <option key={g.id} value={String(g.id)}
                            disabled={selectedGrowers.includes(String(g.id)) && String(g.id) !== key}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Bins input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number" min="0" step="0.5"
                        value={e.bins || ''}
                        onChange={ev => setField(key, 'bins', ev.target.value)}
                        placeholder="0"
                        style={{ width: 72, padding: '0.4rem 0.5rem', borderRadius: 7,
                          border: '1.5px solid #d4e0d4', fontSize: '1rem',
                          textAlign: 'center', fontWeight: 700 }}
                      />
                      <span style={{ fontSize: '0.78rem', color: '#5a6a5a' }}>bins</span>
                    </div>

                    {/* Remove row */}
                    {selectedGrowers.length > 1 && (
                      <button onClick={() => removeRow(key)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: '#ddd', fontSize: '1rem', padding: '0 2px',
                          transition: 'color 0.15s', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e74c3c'}
                        onMouseLeave={e => e.currentTarget.style.color = '#ddd'}>✕</button>
                    )}
                  </div>

                  {/* Notes — show when bins entered */}
                  {Number(e.bins) > 0 && (
                    <input type="text" value={e.notes || ''}
                      onChange={ev => setField(key, 'notes', ev.target.value)}
                      placeholder="Notes (optional)"
                      style={{ marginTop: '0.45rem', width: '100%', padding: '0.32rem 0.5rem',
                        borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.82rem',
                        boxSizing: 'border-box' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Add another orchard row */}
          {!allGrowersUsed && (
            <button onClick={addGrowerRow}
              style={{ marginTop: '0.6rem', background: 'none', border: '1.5px dashed #c8e6c8',
                borderRadius: 8, padding: '0.45rem 1rem', color: '#2d6a1f',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, width: '100%' }}>
              + Add another orchard
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid #eef2ee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.88rem', color: '#5a6a5a' }}>
            Total: <strong style={{ color: '#2d6a1f' }}>{fmtNum(totalBins)} bins</strong>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || totalBins === 0}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Order forecast form ───────────────────────────────────────────────────────

function OrderForm({ onSaved, editing, onCancel }) {
  const [date,     setDate]     = useState(editing?.dispatch_date?.slice(0,10) || addDays(TODAY, 14));
  const [bins,     setBins]     = useState(editing ? String(editing.bins_required) : '');
  const [customer, setCustomer] = useState(editing?.customer || '');
  const [notes,    setNotes]    = useState(editing?.notes || '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (!date || !bins) return;
    setSaving(true); setError('');
    try {
      const url = editing
        ? `${BACKEND}/api/harvest/orders/${editing.id}`
        : `${BACKEND}/api/harvest/orders`;
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_date: date, bins_required: Number(bins), customer, notes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Server error (${res.status})`);
        return;
      }
      onSaved();
      if (!editing) { setBins(''); setCustomer(''); setNotes(''); }
    } catch (err) { setError('Connection error — try again.'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave}>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Dispatch date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '0.42rem 0.6rem', borderRadius: 7, border: '1.5px solid #d4e0d4', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Bins required</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min="1" step="1" value={bins} onChange={e => setBins(e.target.value)}
              placeholder="0"
              style={{ width: 80, padding: '0.42rem 0.6rem', borderRadius: 7,
                border: '1.5px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }} />
            <span style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>bins</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 130 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Customer</label>
          <input type="text" value={customer} onChange={e => setCustomer(e.target.value)}
            placeholder="e.g. NZ Avocados"
            style={{ padding: '0.42rem 0.6rem', borderRadius: 7, border: '1.5px solid #d4e0d4', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 110 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="optional"
            style={{ padding: '0.42rem 0.6rem', borderRadius: 7, border: '1.5px solid #d4e0d4', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !bins || !date}
            style={{ whiteSpace: 'nowrap' }}>
            {saving ? 'Saving…' : editing ? 'Update' : '+ Add Order'}
          </button>
          {editing && <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
        </div>
      </div>
      {error && <div style={{ marginTop: '0.4rem', color: '#c0392b', fontSize: '0.82rem' }}>{error}</div>}
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PickingLogPage() {
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [showPickModal, setShowPickModal] = useState(false);
  const [editingOrder, setEditingOrder]  = useState(null);
  const [holdDays, setHoldDays] = useState(10);

  const from90 = addDays(TODAY, -90);
  const to60   = addDays(TODAY, 60);

  const { data: summary, refetch: refetchSummary } =
    useApi(`${BACKEND}/api/harvest/summary?hold_days=${holdDays}`);
  const { data: picks, refetch: refetchPicks } =
    useApi(`${BACKEND}/api/harvest/picks?from=${from90}&to=${TODAY}`);
  const { data: orders, refetch: refetchOrders } =
    useApi(`${BACKEND}/api/harvest/orders?from=${addDays(TODAY, -7)}&to=${to60}`);
  const { data: growers } = useApi(`${BACKEND}/api/growers`);

  function refetchAll() { refetchSummary(); refetchPicks(); refetchOrders(); }

  // Group picks by date → array of entries
  const picksByDate = useMemo(() => {
    const m = {};
    for (const p of (picks || [])) {
      if (!m[p.date]) m[p.date] = [];
      m[p.date].push(p);
    }
    return m;
  }, [picks]);

  // Daily totals for calendar
  const dailyTotals = useMemo(() => {
    const m = {};
    for (const [date, entries] of Object.entries(picksByDate)) {
      m[date] = entries.reduce((s, e) => s + Number(e.bins_picked), 0);
    }
    return m;
  }, [picksByDate]);

  const ordersMap = useMemo(() => {
    const m = {};
    for (const o of (orders || [])) m[o.date] = o;
    return m;
  }, [orders]);

  const selectedEntries = picksByDate[selectedDate] || [];

  async function toggleFulfilled(order) {
    await fetch(`${BACKEND}/api/harvest/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfilled: !order.fulfilled }),
    });
    refetchAll();
  }

  async function deleteOrder(order) {
    if (!confirm('Remove this order?')) return;
    await fetch(`${BACKEND}/api/harvest/orders/${order.id}`, { method: 'DELETE' });
    refetchAll();
  }

  const upcomingOrders = (orders || []).filter(o => !o.fulfilled && o.date >= TODAY);
  const upcomingBinsNeeded = upcomingOrders.reduce((s, o) => s + Number(o.bins_required), 0);
  const binsReady      = Number(summary?.bins_ready   || 0);
  const binsInHold     = Number(summary?.bins_in_hold || 0);
  const binsToday      = Number(summary?.bins_today   || 0);
  const binsThisWeek   = Number(summary?.bins_this_week || 0);
  const stockShortfall = upcomingBinsNeeded - binsReady;
  const nextOrder      = summary?.next_order;
  const pickByDate     = nextOrder ? addDays(nextOrder.date, -holdDays) : null;
  const daysToPickBy   = pickByDate ? daysAgo(pickByDate) * -1 : null;

  // Build 6-week aligned calendar starting from Monday
  const calendarCells = useMemo(() => {
    const startRaw = addDays(TODAY, -20);
    const dow = new Date(startRaw + 'T12:00:00').getDay();
    const monOffset = dow === 0 ? 6 : dow - 1;
    const start = addDays(startRaw, -monOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, []);

  return (
    <div className="page" style={{ paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>🥑 Harvest Log</h1>
          <div style={{ fontSize: '0.85rem', color: '#5a6a5a' }}>
            Track daily bin picks and manage your weekly order forecast
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.8rem', color: '#5a6a5a', fontWeight: 600 }}>Hold period:</label>
          <input type="number" min="1" max="30" value={holdDays}
            onChange={e => setHoldDays(Number(e.target.value))}
            style={{ width: 54, padding: '0.3rem 0.5rem', borderRadius: 6,
              border: '1.5px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }} />
          <span style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>days</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <StatCard label="Today" value={fmtNum(binsToday)} unit="bins" />
        <StatCard label="This Week" value={fmtNum(binsThisWeek)} unit="bins" />
        <StatCard label={`In Hold (≤${holdDays}d)`} value={fmtNum(binsInHold)} unit="bins"
          sub="Not yet ready to dispatch" color="#e67e22" />
        <StatCard label="Ready to Dispatch" value={fmtNum(binsReady)} unit="bins"
          sub={`Held >${holdDays} days`} color="#2980b9" />
        <StatCard label="Upcoming Orders" value={fmtNum(upcomingBinsNeeded)} unit="bins"
          sub={upcomingOrders.length > 0 ? `${upcomingOrders.length} order${upcomingOrders.length !== 1 ? 's' : ''}` : 'No orders entered'}
          warn={stockShortfall > 0} color={stockShortfall > 0 ? '#c0392b' : '#2d6a1f'} />
        {stockShortfall > 0 ? (
          <StatCard label="Shortfall" value={fmtNum(stockShortfall)} unit="bins"
            sub="Need to pick more" warn />
        ) : upcomingBinsNeeded > 0 ? (
          <StatCard label="Surplus" value={fmtNum(Math.abs(stockShortfall))} unit="bins"
            sub="Ahead of orders" color="#27ae60" />
        ) : null}
      </div>

      {/* Next order deadline banner */}
      {nextOrder && pickByDate && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1.5rem',
          background: daysToPickBy !== null && daysToPickBy <= 2 ? '#fdf0f0' : '#f0f7f0',
          border: `1.5px solid ${daysToPickBy !== null && daysToPickBy <= 2 ? '#f5c6c6' : '#c8e6c8'}`,
          fontSize: '0.88rem', color: '#11420A',
        }}>
          <strong>Next order:</strong> {fmtNum(nextOrder.bins_required)} bins due {fmtDate(nextOrder.date)}
          {nextOrder.customer && ` — ${nextOrder.customer}`}
          {' · '}
          <span style={{ color: daysToPickBy !== null && daysToPickBy <= 2 ? '#c0392b' : '#2d6a1f', fontWeight: 600 }}>
            Picking must start by {fmtDate(pickByDate)}
            {daysToPickBy !== null && (
              daysToPickBy > 0 ? ` (${daysToPickBy} day${daysToPickBy !== 1 ? 's' : ''} away)`
              : daysToPickBy === 0 ? ' (today!)'
              : ` (${Math.abs(daysToPickBy)} day${Math.abs(daysToPickBy) !== 1 ? 's' : ''} overdue)`
            )}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Left: calendar + selected day */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#11420A', margin: '0 0 0.6rem' }}>
              Pick Calendar
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.6rem',
              fontSize: '0.73rem', color: '#5a6a5a', flexWrap: 'wrap' }}>
              <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#2d6a1f', marginRight:4 }} />Bins picked</span>
              <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#dbeafe', border:'1px solid #93c5fd', marginRight:4 }} />Order due</span>
              <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#e67e22', marginRight:4 }} />In hold</span>
            </div>

            {/* Day-of-week headers */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:'0.68rem',
                  fontWeight:700, color:'#5a6a5a', padding:'2px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {calendarCells.map(d => {
                const total  = dailyTotals[d] || 0;
                const order  = ordersMap[d];
                const isToday = d === TODAY;
                const isSel   = d === selectedDate;
                const isFuture = d > TODAY;
                const isPast90 = d < from90;
                const ago = daysAgo(d);
                const inHold = total > 0 && ago >= 0 && ago < holdDays;

                return (
                  <button key={d} onClick={() => setSelectedDate(d)}
                    style={{
                      minHeight: 40, borderRadius: 6, padding: '3px 2px',
                      border: isSel ? '2.5px solid #11420A' : isToday ? '2px solid #2d6a1f' : '1px solid #eef2ee',
                      background: isSel ? '#11420A'
                        : order && !order.fulfilled ? '#dbeafe'
                        : total > 0 ? (inHold ? '#fff3e0' : '#e8f5e8')
                        : isFuture || isPast90 ? '#fafafa' : '#fff',
                      color: isSel ? '#fff' : (isFuture || isPast90) ? '#ccc' : '#11420A',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <span style={{ fontSize:'0.78rem', fontWeight: isToday ? 700 : 400, lineHeight:1.2 }}>
                      {new Date(d + 'T12:00:00').getDate()}
                    </span>
                    {total > 0 && (
                      <span style={{ fontSize:'0.62rem', fontWeight:700, lineHeight:1,
                        color: isSel ? '#c8f0c8' : inHold ? '#e67e22' : '#2d6a1f' }}>
                        {fmtNum(total)}
                      </span>
                    )}
                    {order && !order.fulfilled && (
                      <span style={{ fontSize:'0.58rem', lineHeight:1,
                        color: isSel ? '#bde0ff' : '#2980b9', fontWeight:700 }}>
                        📦{fmtNum(order.bins_required)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
              marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'0.95rem', color:'#11420A' }}>
                  {fmtDate(selectedDate)}
                  {selectedDate === TODAY && <span style={{ marginLeft:6, fontSize:'0.75rem',
                    background:'#2d6a1f', color:'#fff', borderRadius:4, padding:'1px 7px' }}>Today</span>}
                </div>
                {selectedEntries.length > 0 && (
                  <div style={{ fontSize:'0.82rem', color:'#5a6a5a', marginTop:2 }}>
                    {fmtNum(dailyTotals[selectedDate] || 0)} bins total
                    {selectedEntries.length > 1 && ` across ${selectedEntries.length} orchards`}
                  </div>
                )}
              </div>
              {selectedDate <= TODAY && (
                <button className="btn btn-primary" onClick={() => setShowPickModal(true)}
                  style={{ fontSize:'0.85rem' }}>
                  {selectedEntries.length > 0 ? '✎ Edit' : '+ Log Bins'}
                </button>
              )}
            </div>

            {/* Day entries */}
            {selectedEntries.length === 0 ? (
              <div style={{ color:'#bbb', fontSize:'0.85rem' }}>
                {selectedDate > TODAY ? 'Future date.' : 'No bins logged yet — click + Log Bins.'}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                {selectedEntries.map(e => (
                  <div key={e.id} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'0.5rem 0.7rem', background:'#f7fbf7',
                    borderRadius:8, border:'1px solid #d4e0d4',
                  }}>
                    <div>
                      <div style={{ fontWeight:600, color:'#11420A', fontSize:'0.9rem' }}>
                        {e.grower_name || 'General'}
                      </div>
                      {e.notes && <div style={{ fontSize:'0.76rem', color:'#888', marginTop:1 }}>{e.notes}</div>}
                    </div>
                    <div style={{ fontWeight:800, color:'#2d6a1f', fontSize:'1rem' }}>
                      {fmtNum(e.bins_picked)}<span style={{ fontSize:'0.75rem', color:'#5a6a5a', marginLeft:3 }}>bins</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {ordersMap[selectedDate] && (
              <div style={{ marginTop:'0.75rem', padding:'0.6rem 0.8rem',
                background:'#f0f6ff', borderRadius:8, border:'1px solid #bde0ff', fontSize:'0.83rem' }}>
                <strong style={{ color:'#2980b9' }}>📦 Order due:</strong>{' '}
                {fmtNum(ordersMap[selectedDate].bins_required)} bins
                {ordersMap[selectedDate].customer && ` — ${ordersMap[selectedDate].customer}`}
              </div>
            )}
          </div>
        </div>

        {/* Right: orders + recent picks */}
        <div style={{ flex: 1, minWidth: 300, display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Order forecast */}
          <div className="card" style={{ padding:'1.25rem' }}>
            <h2 style={{ fontSize:'0.95rem', fontWeight:700, color:'#11420A', margin:'0 0 0.75rem' }}>
              📦 Order Forecast
            </h2>
            {editingOrder ? (
              <OrderForm editing={editingOrder}
                onSaved={() => { setEditingOrder(null); refetchAll(); }}
                onCancel={() => setEditingOrder(null)} />
            ) : (
              <OrderForm onSaved={refetchAll} />
            )}

            {orders?.length > 0 && (
              <div style={{ marginTop:'1rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                {orders.map(o => {
                  const isPast  = o.date < TODAY;
                  const pickBy  = addDays(o.date, -holdDays);
                  return (
                    <div key={o.id} style={{
                      display:'flex', alignItems:'flex-start', gap:'0.6rem',
                      padding:'0.6rem 0.75rem', borderRadius:8,
                      background: o.fulfilled ? '#f9f9f9' : isPast ? '#fff8f0' : '#f7fbf7',
                      border:`1px solid ${o.fulfilled ? '#e8e8e8' : isPast ? '#f5c6c6' : '#d4e0d4'}`,
                      opacity: o.fulfilled ? 0.6 : 1,
                    }}>
                      <input type="checkbox" checked={o.fulfilled}
                        onChange={() => toggleFulfilled(o)}
                        style={{ marginTop:2, accentColor:'#2d6a1f', cursor:'pointer',
                          width:15, height:15, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
                          <span style={{ fontWeight:700, color:'#11420A', fontSize:'0.9rem' }}>
                            {fmtNum(o.bins_required)} bins
                          </span>
                          <span style={{ fontSize:'0.77rem', color:'#5a6a5a' }}>
                            dispatch {fmtDate(o.date)}
                          </span>
                        </div>
                        {o.customer && (
                          <div style={{ fontSize:'0.78rem', color:'#5a6a5a' }}>{o.customer}</div>
                        )}
                        {!o.fulfilled && (
                          <div style={{ fontSize:'0.74rem', marginTop:2,
                            color: daysAgo(pickBy) > 0 ? '#c0392b' : '#5a6a5a' }}>
                            Pick by: {fmtDate(pickBy)}
                            {daysAgo(pickBy) === 0 && <strong style={{ color:'#c0392b' }}> (today!)</strong>}
                          </div>
                        )}
                        {o.notes && <div style={{ fontSize:'0.74rem', color:'#aaa' }}>{o.notes}</div>}
                      </div>
                      <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                        {!o.fulfilled && (
                          <button onClick={() => setEditingOrder(o)}
                            style={{ background:'none', border:'none', cursor:'pointer',
                              color:'#5a6a5a', fontSize:'0.85rem', padding:'0 3px' }}>✎</button>
                        )}
                        <button onClick={() => deleteOrder(o)}
                          style={{ background:'none', border:'none', cursor:'pointer',
                            color:'#ddd', fontSize:'0.9rem', padding:'0 3px', transition:'color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color='#e74c3c'}
                          onMouseLeave={e => e.currentTarget.style.color='#ddd'}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {(!orders || orders.length === 0) && (
              <div style={{ marginTop:'0.75rem', color:'#aaa', fontSize:'0.85rem' }}>
                No orders entered yet. Add your first order above.
              </div>
            )}
          </div>

          {/* Recent picks summary */}
          <div className="card" style={{ padding:'1.25rem' }}>
            <h2 style={{ fontSize:'0.95rem', fontWeight:700, color:'#11420A', margin:'0 0 0.75rem' }}>
              Recent Picks
            </h2>
            {Object.keys(picksByDate).length === 0 ? (
              <div style={{ color:'#aaa', fontSize:'0.85rem' }}>No picks logged yet.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                {Object.entries(picksByDate)
                  .sort(([a],[b]) => b.localeCompare(a))
                  .slice(0, 12)
                  .map(([date, entries]) => {
                    const total = entries.reduce((s, e) => s + Number(e.bins_picked), 0);
                    const ago = daysAgo(date);
                    const ready = ago >= holdDays;
                    return (
                      <div key={date} onClick={() => setSelectedDate(date)}
                        style={{
                          padding:'0.45rem 0.7rem', borderRadius:7, cursor:'pointer',
                          background: selectedDate === date ? '#f0f7f0' : '#fafafa',
                          border:`1px solid ${selectedDate === date ? '#c8e6c8' : '#eee'}`,
                        }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontWeight:600, color:'#11420A', fontSize:'0.88rem' }}>
                            {fmtDate(date)}
                          </span>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:'0.7rem', padding:'1px 7px', borderRadius:10,
                              fontWeight:600, background: ready ? '#e0f0ff' : '#fff3e0',
                              color: ready ? '#2980b9' : '#e67e22' }}>
                              {ready ? '✓ Ready' : `${holdDays - ago}d to go`}
                            </span>
                            <span style={{ fontWeight:800, color:'#2d6a1f', fontSize:'0.95rem' }}>
                              {fmtNum(total)}
                            </span>
                          </div>
                        </div>
                        {entries.length > 1 && (
                          <div style={{ fontSize:'0.74rem', color:'#888', marginTop:2 }}>
                            {entries.map(e => `${e.grower_name || 'General'}: ${fmtNum(e.bins_picked)}`).join(' · ')}
                          </div>
                        )}
                        {entries.length === 1 && entries[0].grower_name && (
                          <div style={{ fontSize:'0.74rem', color:'#888', marginTop:1 }}>
                            {entries[0].grower_name}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day pick modal */}
      {showPickModal && (
        <DayPickModal
          date={selectedDate}
          growers={growers}
          existingEntries={selectedEntries}
          onSaved={refetchAll}
          onClose={() => setShowPickModal(false)}
        />
      )}
    </div>
  );
}
