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

function fmtNum(n) {
  const v = Number(n) || 0;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

// Days from a date until today (positive = past, negative = future)
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
      <div style={{ fontSize: '0.75rem', color: '#5a6a5a', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: warn ? '#c0392b' : color, lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#5a6a5a', marginLeft: 4 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#5a6a5a', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Quick pick entry ──────────────────────────────────────────────────────────

function QuickPickEntry({ date, existingBins, existingNotes, onSaved }) {
  const [bins,  setBins]  = useState(existingBins != null ? String(existingBins) : '');
  const [notes, setNotes] = useState(existingNotes || '');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!bins || Number(bins) < 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/api/harvest/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pick_date: date, bins_picked: Number(bins), notes }),
      });
      if (!res.ok) throw new Error();
      onSaved();
      if (date === TODAY) { setBins(''); setNotes(''); }
    } catch { alert('Failed to save — try again.'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm('Remove this pick entry?')) return;
    await fetch(`${BACKEND}/api/harvest/picks/${date}`, { method: 'DELETE' });
    onSaved();
    setBins(''); setNotes('');
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <form onSubmit={handleSave}>
      <div style={{ fontSize: '0.82rem', color: '#5a6a5a', marginBottom: '0.6rem' }}>{dateLabel}</div>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Bins picked</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number" min="0" step="0.5" value={bins}
              onChange={e => setBins(e.target.value)}
              placeholder="0"
              autoFocus
              style={{ width: 90, padding: '0.5rem 0.6rem', borderRadius: 8,
                border: '1.5px solid #d4e0d4', fontSize: '1.2rem',
                fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontSize: '0.85rem', color: '#5a6a5a' }}>bins</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. finished Pahoia block"
            style={{ padding: '0.5rem 0.65rem', borderRadius: 8,
              border: '1.5px solid #d4e0d4', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !bins}>
            {saving ? 'Saving…' : existingBins != null ? 'Update' : 'Save'}
          </button>
          {existingBins != null && (
            <button type="button" className="btn btn-secondary"
              onClick={handleDelete}
              style={{ color: '#c0392b', borderColor: '#f5c6c6' }}>
              Remove
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

// ── Order forecast form ───────────────────────────────────────────────────────

function OrderForm({ onSaved, editing, onCancel }) {
  const [date,     setDate]     = useState(editing?.dispatch_date?.slice(0,10) || addDays(TODAY, 14));
  const [bins,     setBins]     = useState(editing ? String(editing.bins_required) : '');
  const [customer, setCustomer] = useState(editing?.customer || '');
  const [notes,    setNotes]    = useState(editing?.notes || '');
  const [saving,   setSaving]   = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (!date || !bins) return;
    setSaving(true);
    try {
      let res;
      if (editing) {
        res = await fetch(`${BACKEND}/api/harvest/orders/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispatch_date: date, bins_required: Number(bins), customer, notes }),
        });
      } else {
        res = await fetch(`${BACKEND}/api/harvest/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispatch_date: date, bins_required: Number(bins), customer, notes }),
        });
      }
      if (!res.ok) throw new Error();
      onSaved();
      if (!editing) { setBins(''); setCustomer(''); setNotes(''); }
    } catch { alert('Failed to save — try again.'); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave}>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Dispatch date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '0.42rem 0.6rem', borderRadius: 7, border: '1.5px solid #d4e0d4',
              fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Bins required</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min="1" step="1" value={bins} onChange={e => setBins(e.target.value)}
              placeholder="0"
              style={{ width: 80, padding: '0.42rem 0.6rem', borderRadius: 7,
                border: '1.5px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }} />
            <span style={{ fontSize: '0.82rem', color: '#5a6a5a' }}>bins</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 130 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Customer</label>
          <input type="text" value={customer} onChange={e => setCustomer(e.target.value)}
            placeholder="e.g. NZ Avocados"
            style={{ padding: '0.42rem 0.6rem', borderRadius: 7,
              border: '1.5px solid #d4e0d4', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 120 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="optional"
            style={{ padding: '0.42rem 0.6rem', borderRadius: 7,
              border: '1.5px solid #d4e0d4', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || !bins || !date}>
            {saving ? 'Saving…' : editing ? 'Update' : '+ Add Order'}
          </button>
          {editing && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          )}
        </div>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PickingLogPage() {
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [editingOrder, setEditingOrder] = useState(null);
  const [holdDays, setHoldDays] = useState(10);

  // Fetch 90-day window for picks and orders
  const from90 = addDays(TODAY, -90);
  const to60   = addDays(TODAY, 60);

  const { data: summary, refetch: refetchSummary } =
    useApi(`${BACKEND}/api/harvest/summary?hold_days=${holdDays}`);

  const { data: picks, refetch: refetchPicks } =
    useApi(`${BACKEND}/api/harvest/picks?from=${from90}&to=${TODAY}`);

  const { data: orders, refetch: refetchOrders } =
    useApi(`${BACKEND}/api/harvest/orders?from=${addDays(TODAY, -7)}&to=${to60}`);

  function refetchAll() { refetchSummary(); refetchPicks(); refetchOrders(); }

  // Build a map of date → pick record
  const picksMap = useMemo(() => {
    const m = {};
    for (const p of (picks || [])) m[p.date] = p;
    return m;
  }, [picks]);

  const selectedPick = picksMap[selectedDate];

  // Build 6-week calendar (past 2 weeks + next 4 weeks — centred around today)
  const calStart = addDays(TODAY, -14);
  const calDays  = 42; // 6 weeks

  const calCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < calDays; i++) {
      const d = addDays(calStart, i);
      cells.push(d);
    }
    return cells;
  }, [calStart]);

  // Order map: date → order
  const ordersMap = useMemo(() => {
    const m = {};
    for (const o of (orders || [])) m[o.date] = o;
    return m;
  }, [orders]);

  // For each day in the calendar, what's the "ready" status?
  // A bin picked today will be ready in `holdDays` days
  function readyDate(pickDateStr) {
    return addDays(pickDateStr, holdDays);
  }

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

  // Upcoming bins needed (unfulfilled orders in the next 60 days)
  const upcomingOrders = (orders || []).filter(o => !o.fulfilled && o.date >= TODAY);
  const upcomingBinsNeeded = upcomingOrders.reduce((s, o) => s + Number(o.bins_required), 0);
  const binsReady   = Number(summary?.bins_ready   || 0);
  const binsInHold  = Number(summary?.bins_in_hold || 0);
  const binsToday   = Number(summary?.bins_today   || 0);
  const binsThisWeek = Number(summary?.bins_this_week || 0);
  const stockShortfall = upcomingBinsNeeded - binsReady;

  // For the next order, how many days until pick needs to start
  const nextOrder = summary?.next_order;
  const pickByDate = nextOrder ? addDays(nextOrder.date, -holdDays) : null;
  const daysToPickBy = pickByDate ? daysAgo(pickByDate) * -1 : null; // positive = days in future

  return (
    <div className="page" style={{ paddingBottom: '3rem' }}>
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

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <StatCard label="Today" value={fmtNum(binsToday)} unit="bins" />
        <StatCard label="This Week" value={fmtNum(binsThisWeek)} unit="bins" />
        <StatCard
          label={`In Hold (≤${holdDays}d)`}
          value={fmtNum(binsInHold)} unit="bins"
          sub={`Being held, not yet ready`}
          color="#e67e22"
        />
        <StatCard
          label="Ready to Dispatch"
          value={fmtNum(binsReady)} unit="bins"
          sub={`Held >${holdDays} days`}
          color="#2980b9"
        />
        <StatCard
          label="Upcoming Orders"
          value={fmtNum(upcomingBinsNeeded)} unit="bins"
          sub={upcomingOrders.length > 0 ? `${upcomingOrders.length} order${upcomingOrders.length !== 1 ? 's' : ''}` : 'No orders entered'}
          warn={stockShortfall > 0}
          color={stockShortfall > 0 ? '#c0392b' : '#2d6a1f'}
        />
        {stockShortfall > 0 && (
          <StatCard
            label="Stock Shortfall"
            value={fmtNum(stockShortfall)} unit="bins"
            sub="Need to pick more"
            warn={true}
          />
        )}
        {stockShortfall <= 0 && upcomingBinsNeeded > 0 && (
          <StatCard
            label="Stock Surplus"
            value={fmtNum(Math.abs(stockShortfall))} unit="bins"
            sub="Ahead of orders"
            color="#27ae60"
          />
        )}
      </div>

      {/* Next order pick deadline */}
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
            {daysToPickBy !== null && (daysToPickBy > 0
              ? ` (${daysToPickBy} day${daysToPickBy !== 1 ? 's' : ''} away)`
              : daysToPickBy === 0 ? ' (today!)' : ` (${Math.abs(daysToPickBy)} day${Math.abs(daysToPickBy) !== 1 ? 's' : ''} ago)`
            )}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* ── Left: calendar + daily log ──────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 320 }}>

          {/* 6-week calendar grid */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#11420A',
              margin: '0 0 0.75rem' }}>Pick Calendar</h2>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.6rem',
              fontSize: '0.75rem', color: '#5a6a5a', flexWrap: 'wrap' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10,
                borderRadius: 2, background: '#2d6a1f', marginRight: 4 }} />Bins picked</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10,
                borderRadius: 2, background: '#2980b9', marginRight: 4 }} />Order due</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10,
                borderRadius: '50%', background: '#e67e22', marginRight: 4 }} />In hold</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem',
                  fontWeight: 700, color: '#5a6a5a', padding: '2px 0' }}>{d}</div>
              ))}
            </div>

            {/* Offset: find the Monday of the first week */}
            {(() => {
              // calCells already starts from calStart; make sure we start on Monday
              const startDow = new Date(calStart + 'T12:00:00').getDay(); // 0=Sun
              const monOffset = startDow === 0 ? 1 : startDow === 1 ? 0 : startDow - 1;
              // skip days before Monday
              const alignedStart = addDays(calStart, -monOffset);
              const alignedCells = [];
              for (let i = 0; i < 42; i++) alignedCells.push(addDays(alignedStart, i));

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                  {alignedCells.map(d => {
                    const pick   = picksMap[d];
                    const order  = ordersMap[d];
                    const isToday = d === TODAY;
                    const isSel   = d === selectedDate;
                    const isFuture = d > TODAY;
                    const isPast90 = d < from90;
                    const inHold = pick && !isFuture && daysAgo(d) < holdDays;
                    const isReady = pick && daysAgo(d) >= holdDays;

                    return (
                      <button key={d} onClick={() => setSelectedDate(d)}
                        style={{
                          minHeight: 40, borderRadius: 6, padding: '3px 2px',
                          border: isSel ? '2.5px solid #11420A' : isToday ? '2px solid #2d6a1f' : '1px solid #eef2ee',
                          background: isSel ? '#11420A'
                            : order && !order.fulfilled ? '#dbeafe'
                            : pick ? (inHold ? '#fff3e0' : '#e8f5e8')
                            : isFuture || isPast90 ? '#fafafa' : '#fff',
                          color: isSel ? '#fff' : (isFuture || isPast90) ? '#ccc' : '#11420A',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: isToday ? 700 : 400,
                          lineHeight: 1.2 }}>
                          {new Date(d + 'T12:00:00').getDate()}
                        </span>
                        {pick && (
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, lineHeight: 1,
                            color: isSel ? '#c8f0c8' : inHold ? '#e67e22' : '#2d6a1f' }}>
                            {fmtNum(pick.bins_picked)}
                          </span>
                        )}
                        {order && !order.fulfilled && (
                          <span style={{ fontSize: '0.58rem', lineHeight: 1,
                            color: isSel ? '#bde0ff' : '#2980b9', fontWeight: 700 }}>
                            📦{fmtNum(order.bins_required)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Selected day panel */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#11420A',
              margin: '0 0 0.75rem' }}>
              Log Bins — {fmtDate(selectedDate)}
              {selectedDate > TODAY && (
                <span style={{ marginLeft: 8, fontSize: '0.78rem', fontWeight: 400,
                  color: '#aaa' }}>(future)</span>
              )}
            </h2>

            {selectedDate > TODAY ? (
              <div style={{ color: '#aaa', fontSize: '0.85rem' }}>
                Can't log bins for a future date.
              </div>
            ) : (
              <QuickPickEntry
                date={selectedDate}
                existingBins={selectedPick?.bins_picked ?? null}
                existingNotes={selectedPick?.notes ?? ''}
                onSaved={refetchAll}
              />
            )}

            {/* Show order info for selected day if applicable */}
            {ordersMap[selectedDate] && (
              <div style={{ marginTop: '1rem', padding: '0.65rem 0.85rem',
                background: '#f0f6ff', borderRadius: 8, border: '1px solid #bde0ff',
                fontSize: '0.85rem' }}>
                <strong style={{ color: '#2980b9' }}>📦 Order due this day:</strong>{' '}
                {fmtNum(ordersMap[selectedDate].bins_required)} bins
                {ordersMap[selectedDate].customer && ` — ${ordersMap[selectedDate].customer}`}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: orders + recent picks ────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Order forecast */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#11420A',
              margin: '0 0 0.75rem' }}>
              📦 Order Forecast
            </h2>

            {editingOrder ? (
              <OrderForm editing={editingOrder} onSaved={() => { setEditingOrder(null); refetchAll(); }}
                onCancel={() => setEditingOrder(null)} />
            ) : (
              <OrderForm onSaved={refetchAll} />
            )}

            {/* Orders list */}
            {orders?.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {orders.map(o => {
                  const isPast  = o.date < TODAY;
                  const pickBy  = addDays(o.date, -holdDays);
                  const canPick = picksMap[pickBy] || daysAgo(pickBy) >= 0;
                  return (
                    <div key={o.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                      padding: '0.6rem 0.75rem', borderRadius: 8,
                      background: o.fulfilled ? '#f9f9f9' : isPast ? '#fff8f0' : '#f7fbf7',
                      border: `1px solid ${o.fulfilled ? '#e8e8e8' : isPast ? '#f5c6c6' : '#d4e0d4'}`,
                      opacity: o.fulfilled ? 0.65 : 1,
                    }}>
                      <input type="checkbox" checked={o.fulfilled}
                        onChange={() => toggleFulfilled(o)}
                        style={{ marginTop: 2, accentColor: '#2d6a1f', cursor: 'pointer',
                          width: 15, height: 15, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: '#11420A', fontSize: '0.9rem' }}>
                            {fmtNum(o.bins_required)} bins
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#5a6a5a' }}>
                            dispatch {fmtDate(o.date)}
                          </span>
                        </div>
                        {o.customer && (
                          <div style={{ fontSize: '0.78rem', color: '#5a6a5a' }}>{o.customer}</div>
                        )}
                        {!o.fulfilled && (
                          <div style={{ fontSize: '0.75rem', marginTop: 2,
                            color: daysAgo(pickBy) < 0 ? '#e67e22' : '#5a6a5a' }}>
                            Pick by: {fmtDate(pickBy)}
                            {daysAgo(pickBy) === 0 && <strong style={{ color: '#c0392b' }}> (today!)</strong>}
                          </div>
                        )}
                        {o.notes && (
                          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 1 }}>{o.notes}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {!o.fulfilled && (
                          <button onClick={() => setEditingOrder(o)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                              color: '#5a6a5a', fontSize: '0.85rem', padding: '0 3px' }}
                            title="Edit">✎</button>
                        )}
                        <button onClick={() => deleteOrder(o)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            color: '#ddd', fontSize: '0.95rem', padding: '0 3px',
                            transition: 'color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#e74c3c'}
                          onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                          title="Delete">🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {(!orders || orders.length === 0) && (
              <div style={{ marginTop: '0.75rem', color: '#aaa', fontSize: '0.85rem' }}>
                No orders entered yet. Add your first order above.
              </div>
            )}
          </div>

          {/* Recent picks */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#11420A',
              margin: '0 0 0.75rem' }}>Recent Picks</h2>
            {(!picks || picks.length === 0) ? (
              <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No picks logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {picks.slice(0, 14).map(p => {
                  const ago = daysAgo(p.date);
                  const ready = ago >= holdDays;
                  return (
                    <div key={p.date} onClick={() => setSelectedDate(p.date)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.45rem 0.7rem', borderRadius: 7, cursor: 'pointer',
                        background: selectedDate === p.date ? '#f0f7f0' : '#fafafa',
                        border: `1px solid ${selectedDate === p.date ? '#c8e6c8' : '#eee'}`,
                        transition: 'all 0.1s',
                      }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#11420A', fontSize: '0.88rem' }}>
                          {fmtDate(p.date)}
                        </span>
                        {p.notes && (
                          <span style={{ marginLeft: 6, fontSize: '0.76rem', color: '#888' }}>{p.notes}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: '0.72rem', padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                          background: ready ? '#e0f0ff' : '#fff3e0',
                          color: ready ? '#2980b9' : '#e67e22',
                        }}>
                          {ready ? '✓ Ready' : `${holdDays - ago}d to go`}
                        </span>
                        <span style={{ fontWeight: 800, color: '#2d6a1f', fontSize: '0.95rem' }}>
                          {fmtNum(p.bins_picked)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
