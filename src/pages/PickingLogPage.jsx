import { useState, useMemo, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYMD(date) {
  // Use local time so NZ dates aren't shifted back to UTC yesterday
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

// ── Geofence helpers ──────────────────────────────────────────────────────────

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestInGeofence(lat, lng, growers, radiusM) {
  let best = null, bestDist = Infinity;
  for (const g of (growers || [])) {
    if (!g.lat || !g.lng) continue;
    const d = haversineM(lat, lng, g.lat, g.lng);
    if (d <= radiusM && d < bestDist) { best = g; bestDist = d; }
  }
  return best;
}

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
        {unit && <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#5a6a5a', marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: '0.76rem', color: '#5a6a5a', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Order forecast form ───────────────────────────────────────────────────────

function OrderForm({ onSaved, editing, onCancel }) {
  const [date,     setDate]     = useState(editing?.dispatch_date?.slice(0,10) || editing?.date?.slice(0,10) || addDays(TODAY, 14));
  const [bins,     setBins]     = useState(editing ? String(editing.bins_required) : '');
  const [variety,  setVariety]  = useState(editing?.customer || 'Hass');
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
        body: JSON.stringify({ dispatch_date: date, bins_required: Number(bins), customer: variety, notes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Server error (${res.status})`);
        return;
      }
      onSaved();
      if (!editing) { setBins(''); setNotes(''); setVariety('Hass'); }
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
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a4a3a' }}>Variety</label>
          <input type="text" value={variety} onChange={e => setVariety(e.target.value)}
            placeholder="e.g. Hass"
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
  const [editingOrder, setEditingOrder] = useState(null);
  const [holdMin, setHoldMin] = useState(7);
  const [holdMax, setHoldMax] = useState(10);

  const to60 = addDays(TODAY, 60);

  // ── Data fetching ─────────────────────────────────────────────────────────

  // Current AvoGrade season
  const { data: seasons } = useApi(`${BACKEND}/api/seasons`);
  const currentSeason = useMemo(() => {
    if (!seasons?.length) return null;
    return [...seasons].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))[0];
  }, [seasons]);

  // AvoGrade bin stats (In Storage, Graded, Season Total)
  const { data: binStats, refetch: refetchBinStats } = useApi(
    currentSeason ? `${BACKEND}/api/bins/stats?season_id=${currentSeason.id}` : null
  );

  // AvoGrade individual bins (for calendar daily totals)
  const { data: bins, refetch: refetchBins } = useApi(
    currentSeason ? `${BACKEND}/api/bins?season_id=${currentSeason.id}` : null
  );

  // OrchardTrack order forecasts (picking deadlines)
  const { data: orders, refetch: refetchOrders } =
    useApi(`${BACKEND}/api/harvest/orders?from=${addDays(TODAY, -7)}&to=${to60}`);

  // Growers for geofence detection
  const { data: growers } = useApi(`${BACKEND}/api/growers`);

  // Settings for geofence radius
  const { data: settings } = useApi(`${BACKEND}/api/settings`);

  function refetchAll() { refetchBinStats(); refetchBins(); refetchOrders(); }

  // ── Derived data ──────────────────────────────────────────────────────────

  // Group AvoGrade bins by pick date → daily totals (large-bin equivalents)
  const dailyTotals = useMemo(() => {
    const m = {};
    for (const b of (bins || [])) {
      const d = toYMD(new Date(b.date_picked));
      m[d] = (m[d] || 0) + Number(b.bin_equivalent || 1);
    }
    return m;
  }, [bins]);

  // Bins picked on selected date, grouped by grower
  const selectedDayBins = useMemo(() => {
    if (!bins) return [];
    return (bins).filter(b => toYMD(new Date(b.date_picked)) === selectedDate);
  }, [bins, selectedDate]);

  const selectedDayByGrower = useMemo(() => {
    const m = {};
    for (const b of selectedDayBins) {
      if (!m[b.grower]) m[b.grower] = { total: 0, variety: b.variety };
      m[b.grower].total += Number(b.bin_equivalent || 1);
    }
    return m;
  }, [selectedDayBins]);

  const ordersMap = useMemo(() => {
    const m = {};
    for (const o of (orders || [])) m[o.date] = o;
    return m;
  }, [orders]);

  // Stats from AvoGrade
  const binsInStorage = Number(binStats?.in_storage || 0);
  const binsGraded    = Number(binStats?.graded      || 0);
  const binsSeason    = Number(binStats?.total_equiv  || 0);

  // Oldest bin in storage
  const oldestBinAge = useMemo(() => {
    const inStorage = (bins || []).filter(b => b.status === 'in-storage');
    if (!inStorage.length) return null;
    const oldest = inStorage.reduce((min, b) =>
      new Date(b.date_picked) < new Date(min.date_picked) ? b : min
    );
    return daysAgo(toYMD(new Date(oldest.date_picked)));
  }, [bins]);

  // Order forecast calculations
  const upcomingOrders = (orders || []).filter(o => !o.fulfilled && o.date >= TODAY);
  const upcomingBinsNeeded = upcomingOrders.reduce((s, o) => s + Number(o.bins_required), 0);
  const stockShortfall = upcomingBinsNeeded - binsInStorage;

  const nextOrder    = upcomingOrders[0] ?? null;
  const pickByDate   = nextOrder ? addDays(nextOrder.date, -holdMin) : null;
  const daysToPickBy = pickByDate ? daysAgo(pickByDate) * -1 : null;

  // ── Mobile geofence detection ─────────────────────────────────────────────
  const [nearbyOrchard,   setNearbyOrchard]   = useState(null);
  const [locationError,   setLocationError]   = useState('');
  const [locationWatching, setLocationWatching] = useState(false);
  const watchIdRef = useRef(null);
  const geofenceRadius = Number(settings?.geofence_radius_metres) || 200;

  function startWatching() {
    if (!navigator.geolocation) { setLocationError('Geolocation not supported on this device.'); return; }
    setLocationError(''); setLocationWatching(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => setNearbyOrchard(nearestInGeofence(pos.coords.latitude, pos.coords.longitude, growers, geofenceRadius)),
      err => { setLocationError(err.code === 1 ? 'Location permission denied.' : 'Unable to get location.'); setLocationWatching(false); },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  }

  function stopWatching() {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setLocationWatching(false); setNearbyOrchard(null);
  }

  useEffect(() => () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);

  // ── Calendar cells (6 weeks aligned to Monday) ───────────────────────────
  const calendarCells = useMemo(() => {
    const startRaw = addDays(TODAY, -20);
    const dow = new Date(startRaw + 'T12:00:00').getDay();
    const monOffset = dow === 0 ? 6 : dow - 1;
    const start = addDays(startRaw, -monOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, []);

  // When geofence detects an orchard, show a local notification if permission granted
  const lastNotifiedOrchard = useRef(null);
  useEffect(() => {
    if (!nearbyOrchard || nearbyOrchard.id === lastNotifiedOrchard.current) return;
    lastNotifiedOrchard.current = nearbyOrchard.id;
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(`📍 You're at ${nearbyOrchard.name}`, {
          body: 'Log any bins picked today in AvoGrade.',
          icon: '/icon.svg',
          tag:  'geofence-arrival',
          data: { url: '/' },
        });
      });
    }
  }, [nearbyOrchard]);

  // ── Render ────────────────────────────────────────────────────────────────

  async function toggleFulfilled(order) {
    await fetch(`${BACKEND}/api/harvest/orders/${order.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfilled: !order.fulfilled }),
    });
    refetchAll();
  }

  async function deleteOrder(order) {
    if (!confirm('Remove this order?')) return;
    await fetch(`${BACKEND}/api/harvest/orders/${order.id}`, { method: 'DELETE' });
    refetchAll();
  }

  return (
    <div className="page" style={{ paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>🥑 Picking Schedule</h1>
          <div style={{ fontSize: '0.85rem', color: '#5a6a5a' }}>
            Picking deadlines based on order forecast · Bin data from AvoGrade
            {currentSeason && <span style={{ marginLeft: 6, fontSize: '0.78rem', background: '#e8f5e8',
              color: '#2d6a1f', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
              {currentSeason.label}
            </span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8rem', color: '#5a6a5a', fontWeight: 600 }}>Hold window:</label>
          <input type="number" min="1" max="30" value={holdMin}
            onChange={e => setHoldMin(Number(e.target.value))}
            style={{ width: 48, padding: '0.3rem 0.4rem', borderRadius: 6,
              border: '1.5px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }} />
          <span style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>–</span>
          <input type="number" min="1" max="60" value={holdMax}
            onChange={e => setHoldMax(Number(e.target.value))}
            style={{ width: 48, padding: '0.3rem 0.4rem', borderRadius: 6,
              border: '1.5px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }} />
          <span style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>days</span>
        </div>
      </div>

      {/* Mobile geofence banner */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {!locationWatching ? (
          <button onClick={startWatching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.9rem',
              borderRadius: 20, border: '1.5px solid #d4e0d4', background: '#fff',
              cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, color: '#5a6a5a' }}>
            📍 Detect my orchard
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {nearbyOrchard ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.9rem',
                borderRadius: 20, background: '#e8f5e8', border: '1.5px solid #a8d8a8',
                fontSize: '0.85rem', fontWeight: 700, color: '#11420A' }}>
                📍 You're at <span style={{ color: '#2d6a1f' }}>{nearbyOrchard.name}</span>
              </div>
            ) : (
              <div style={{ padding: '0.4rem 0.9rem', borderRadius: 20,
                background: '#f5f5f5', border: '1.5px solid #e0e0e0',
                fontSize: '0.83rem', color: '#888' }}>
                📡 Watching… no orchard nearby
              </div>
            )}
            <button onClick={stopWatching}
              style={{ fontSize: '0.78rem', color: '#aaa', background: 'none',
                border: 'none', cursor: 'pointer', padding: '0 4px' }}>Stop</button>
          </div>
        )}
        {locationError && <div style={{ fontSize: '0.8rem', color: '#c0392b' }}>{locationError}</div>}
      </div>

      {/* Stats row — live from AvoGrade */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <StatCard label="In Storage" value={fmtNum(binsInStorage)} unit="equiv"
          sub={`${oldestBinAge != null ? `Oldest: ${oldestBinAge}d` : 'No bins in storage'}`}
          color="#e67e22" />
        <StatCard label="Graded" value={fmtNum(binsGraded)} unit="equiv"
          sub="Awaiting dispatch" color="#16a085" />
        <StatCard label="Season Total" value={fmtNum(binsSeason)} unit="equiv"
          sub={currentSeason?.label} color="#2d6a1f" />
        <StatCard label="Upcoming Orders" value={fmtNum(upcomingBinsNeeded)} unit="bins"
          sub={upcomingOrders.length > 0 ? `${upcomingOrders.length} order${upcomingOrders.length !== 1 ? 's' : ''}` : 'No orders entered'}
          warn={stockShortfall > 0} color={stockShortfall > 0 ? '#c0392b' : '#2d6a1f'} />
        {stockShortfall > 0 ? (
          <StatCard label="Shortfall" value={fmtNum(stockShortfall)} unit="bins"
            sub="Need to pick more" warn />
        ) : upcomingBinsNeeded > 0 ? (
          <StatCard label="Surplus" value={fmtNum(-stockShortfall)} unit="bins"
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
            Pick by {fmtDate(pickByDate)}
            {daysToPickBy !== null && (
              daysToPickBy > 0 ? ` (${daysToPickBy}d away)`
              : daysToPickBy === 0 ? ' (today!)'
              : ` (${Math.abs(daysToPickBy)}d overdue)`
            )}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Left: calendar + selected day detail */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#11420A', margin: '0 0 0.6rem' }}>
              Pick Calendar
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.6rem',
              fontSize: '0.73rem', color: '#5a6a5a', flexWrap: 'wrap' }}>
              <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#2d6a1f', marginRight:4 }} />Bins picked</span>
              <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#dbeafe', border:'1px solid #93c5fd', marginRight:4 }} />Order due</span>
              <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#fff3e0', border:'1px solid #fcd34d', marginRight:4 }} />Pick-by deadline</span>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:'0.68rem',
                  fontWeight:700, color:'#5a6a5a', padding:'2px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {calendarCells.map(d => {
                const total    = dailyTotals[d] || 0;
                const order    = ordersMap[d];
                const isToday  = d === TODAY;
                const isSel    = d === selectedDate;
                const isFuture = d > TODAY;
                const ago      = daysAgo(d);
                const inHold   = total > 0 && ago >= 0 && ago < holdMin;
                // Is this a pick-by deadline for any order?
                const isPickBy = (orders || []).some(o => !o.fulfilled && addDays(o.date, -holdMin) === d);

                return (
                  <button key={d} onClick={() => setSelectedDate(d)}
                    style={{
                      minHeight: 40, borderRadius: 6, padding: '3px 2px',
                      border: isSel ? '2.5px solid #11420A' : isToday ? '2px solid #2d6a1f' : '1px solid #eef2ee',
                      background: isSel ? '#11420A'
                        : order && !order.fulfilled ? '#dbeafe'
                        : isPickBy ? '#fff3e0'
                        : total > 0 ? (inHold ? '#fef9e7' : '#e8f5e8')
                        : isFuture ? '#fafafa' : '#fff',
                      color: isSel ? '#fff' : isFuture ? '#ccc' : '#11420A',
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
                    {isPickBy && !total && (
                      <span style={{ fontSize:'0.58rem', lineHeight:1, color: isSel ? '#ffe' : '#d4770a', fontWeight:700 }}>
                        ⚑
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight:700, fontSize:'0.95rem', color:'#11420A', marginBottom: '0.6rem' }}>
              {fmtLongDate(selectedDate)}
              {selectedDate === TODAY && <span style={{ marginLeft:6, fontSize:'0.75rem',
                background:'#2d6a1f', color:'#fff', borderRadius:4, padding:'1px 7px' }}>Today</span>}
            </div>

            {/* Bins picked this day (from AvoGrade) */}
            {Object.keys(selectedDayByGrower).length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', marginBottom:'0.75rem' }}>
                {Object.entries(selectedDayByGrower).map(([grower, info]) => (
                  <div key={grower} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'0.5rem 0.7rem', background:'#f7fbf7',
                    borderRadius:8, border:'1px solid #d4e0d4',
                  }}>
                    <div>
                      <div style={{ fontWeight:600, color:'#11420A', fontSize:'0.9rem' }}>{grower}</div>
                      <div style={{ fontSize:'0.76rem', color:'#888' }}>{info.variety}</div>
                    </div>
                    <div style={{ fontWeight:800, color:'#2d6a1f', fontSize:'1rem' }}>
                      {fmtNum(info.total)}<span style={{ fontSize:'0.75rem', color:'#5a6a5a', marginLeft:3 }}>equiv</span>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize:'0.78rem', color:'#5a6a5a', textAlign:'right', marginTop:2 }}>
                  Total: <strong style={{ color:'#2d6a1f' }}>{fmtNum(Object.values(selectedDayByGrower).reduce((s,v)=>s+v.total,0))} equiv</strong>
                  {' · '}data from AvoGrade
                </div>
              </div>
            ) : (
              <div style={{ color:'#bbb', fontSize:'0.85rem', marginBottom:'0.5rem' }}>
                {selectedDate > TODAY ? 'Future date.' : 'No bins recorded in AvoGrade for this day.'}
              </div>
            )}

            {/* Order due on this day */}
            {ordersMap[selectedDate] && (
              <div style={{ padding:'0.6rem 0.8rem', background:'#f0f6ff',
                borderRadius:8, border:'1px solid #bde0ff', fontSize:'0.83rem' }}>
                <strong style={{ color:'#2980b9' }}>📦 Order due:</strong>{' '}
                {fmtNum(ordersMap[selectedDate].bins_required)} bins
                {ordersMap[selectedDate].customer && ` — ${ordersMap[selectedDate].customer}`}
              </div>
            )}

            {/* Pick-by deadline indicator */}
            {(orders || []).filter(o => !o.fulfilled && addDays(o.date, -holdMin) === selectedDate).map(o => (
              <div key={o.id} style={{ marginTop:'0.5rem', padding:'0.6rem 0.8rem', background:'#fff8e8',
                borderRadius:8, border:'1px solid #fcd34d', fontSize:'0.83rem', color:'#92600a' }}>
                <strong>⚑ Pick-by deadline</strong> — need {fmtNum(o.bins_required)} bins picked today
                to be ready for dispatch on {fmtDate(o.date)}
              </div>
            ))}
          </div>
        </div>

        {/* Right: order forecast */}
        <div style={{ flex: 1, minWidth: 300 }}>
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
                  const pickBy  = addDays(o.date, -holdMin);
                  const pickByAgo = daysAgo(pickBy);
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
                        style={{ marginTop:2, accentColor:'#2d6a1f', cursor:'pointer', width:15, height:15, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
                          <span style={{ fontWeight:700, color:'#11420A', fontSize:'0.9rem' }}>
                            {fmtNum(o.bins_required)} bins
                          </span>
                          <span style={{ fontSize:'0.77rem', color:'#5a6a5a' }}>dispatch {fmtDate(o.date)}</span>
                        </div>
                        {o.customer && <div style={{ fontSize:'0.78rem', color:'#5a6a5a' }}>{o.customer}</div>}
                        {!o.fulfilled && (
                          <div style={{ fontSize:'0.74rem', marginTop:2,
                            color: pickByAgo > 0 ? '#c0392b' : '#5a6a5a' }}>
                            Pick by: {fmtDate(pickBy)}
                            {pickByAgo === 0 && <strong style={{ color:'#c0392b' }}> (today!)</strong>}
                            {pickByAgo > 0 && <strong style={{ color:'#c0392b' }}> ({pickByAgo}d overdue)</strong>}
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
        </div>
      </div>
    </div>
  );
}
