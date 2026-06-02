import { useState, useMemo, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi.js';

const BACKEND  = import.meta.env.VITE_BACKEND_URL || '';
const AVOGRADE = import.meta.env.VITE_AVOGRADE_URL || '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toYMD(date) {
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

// Start of current week (Monday)
function weekStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return toYMD(d);
}

// Start of current month
function monthStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return toYMD(d);
}

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

function StatCard({ label, value, unit, sub, color = '#2d6a1f' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '1rem 1.25rem',
      border: '1.5px solid #d4e0d4',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: '0.72rem', color: '#5a6a5a', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#5a6a5a', marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: '0.76rem', color: '#5a6a5a', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Bin Log Search ────────────────────────────────────────────────────────────

const PERIODS = [
  { key: 'week',    label: 'This week' },
  { key: 'month',   label: 'This month' },
  { key: '30days',  label: 'Last 30 days' },
  { key: 'season',  label: 'Full season' },
  { key: 'custom',  label: 'Custom range' },
];

function BinLogSearch({ bins, currentSeason }) {
  const [period,      setPeriod]      = useState('month');
  const [customFrom,  setCustomFrom]  = useState(addDays(TODAY, -30));
  const [customTo,    setCustomTo]    = useState(TODAY);
  const [growerQuery, setGrowerQuery] = useState('');
  const [sortBy,      setSortBy]      = useState('bins'); // 'bins' | 'grower' | 'date'
  const [sortDir,     setSortDir]     = useState('desc');

  // Derive date range from period selection
  const { fromDate, toDate } = useMemo(() => {
    switch (period) {
      case 'week':   return { fromDate: weekStart(),           toDate: TODAY };
      case 'month':  return { fromDate: monthStart(),          toDate: TODAY };
      case '30days': return { fromDate: addDays(TODAY, -30),   toDate: TODAY };
      case 'season': return {
        fromDate: currentSeason?.start_date
          ? toYMD(new Date(currentSeason.start_date))
          : addDays(TODAY, -365),
        toDate: TODAY,
      };
      case 'custom': return { fromDate: customFrom, toDate: customTo };
      default:       return { fromDate: monthStart(), toDate: TODAY };
    }
  }, [period, customFrom, customTo, currentSeason]);

  // Filter bins by date range + grower query
  const filtered = useMemo(() => {
    if (!bins) return [];
    const q = growerQuery.trim().toLowerCase();
    return bins.filter(b => {
      const d = toYMD(new Date(b.date_picked));
      if (d < fromDate || d > toDate) return false;
      if (q && !b.grower?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bins, fromDate, toDate, growerQuery]);

  // Group by grower
  const byGrower = useMemo(() => {
    const m = {};
    for (const b of filtered) {
      const g = b.grower || 'Unknown';
      if (!m[g]) m[g] = { grower: g, totalEquiv: 0, binCount: 0, varieties: {}, firstDate: b.date_picked, lastDate: b.date_picked };
      m[g].totalEquiv += Number(b.bin_equivalent || 1);
      m[g].binCount   += 1;
      const v = b.variety || 'Unknown';
      m[g].varieties[v] = (m[g].varieties[v] || 0) + Number(b.bin_equivalent || 1);
      const dp = b.date_picked;
      if (dp < m[g].firstDate) m[g].firstDate = dp;
      if (dp > m[g].lastDate)  m[g].lastDate  = dp;
    }
    return Object.values(m);
  }, [filtered]);

  // Sort rows
  const rows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...byGrower].sort((a, b) => {
      if (sortBy === 'bins')   return (b.totalEquiv - a.totalEquiv) * dir;
      if (sortBy === 'grower') return a.grower.localeCompare(b.grower) * dir;
      if (sortBy === 'date')   return a.lastDate.localeCompare(b.lastDate) * dir;
      return 0;
    });
  }, [byGrower, sortBy, sortDir]);

  const totalEquiv  = filtered.reduce((s, b) => s + Number(b.bin_equivalent || 1), 0);
  const totalBins   = filtered.length;
  const growerCount = rows.length;

  function handleSortClick(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  function arrow(col) {
    return sortBy === col ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';
  }

  const TH = {
    padding: '0.5rem 0.65rem', fontWeight: 700, color: '#2d6a2d',
    fontSize: '0.78rem', textAlign: 'left', cursor: 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap',
  };

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#11420A', margin: '0 0 0.9rem' }}>
        🔍 Bin Log Search
      </h2>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding: '0.25rem 0.65rem', borderRadius: 12, border: '1px solid',
            fontSize: '0.78rem', fontWeight: period === p.key ? 700 : 400, cursor: 'pointer',
            borderColor: period === p.key ? '#2d6a2d' : '#d4e0d4',
            background:  period === p.key ? '#2d6a2d' : '#fff',
            color:       period === p.key ? '#fff'    : '#5a6a5a',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center',
          marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ padding: '0.32rem 0.5rem', borderRadius: 6, border: '1px solid #d4e0d4',
              fontSize: '0.85rem' }} />
          <span style={{ color: '#5a6a5a', fontSize: '0.8rem' }}>to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ padding: '0.32rem 0.5rem', borderRadius: 6, border: '1px solid #d4e0d4',
              fontSize: '0.85rem' }} />
        </div>
      )}

      {/* Grower search */}
      <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
          color: '#aaa', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
        <input
          type="text"
          placeholder="Filter by grower name…"
          value={growerQuery}
          onChange={e => setGrowerQuery(e.target.value)}
          style={{ width: '100%', padding: '0.38rem 0.6rem 0.38rem 1.9rem',
            borderRadius: 7, border: '1px solid #d4e0d4', fontSize: '0.88rem',
            boxSizing: 'border-box' }}
        />
        {growerQuery && (
          <button onClick={() => setGrowerQuery('')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '0.9rem' }}>
            ×
          </button>
        )}
      </div>

      {/* Summary line */}
      <div style={{ fontSize: '0.78rem', color: '#5a6a5a', marginBottom: '0.6rem' }}>
        {!bins ? 'Loading…' : (
          <>
            <strong style={{ color: '#2d6a1f' }}>{fmtNum(totalEquiv)} equiv</strong>
            {' · '}
            {totalBins} bin{totalBins !== 1 ? 's' : ''}
            {' · '}
            {growerCount} grower{growerCount !== 1 ? 's' : ''}
            {' · '}
            {fmtDate(fromDate)} – {fmtDate(toDate)}
          </>
        )}
      </div>

      {/* Results table */}
      {rows.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f5f9f5', borderBottom: '2px solid #d4e0d4' }}>
                <th onClick={() => handleSortClick('grower')} style={{ ...TH, minWidth: 130 }}>
                  Grower{arrow('grower')}
                </th>
                <th onClick={() => handleSortClick('bins')} style={{ ...TH, textAlign: 'right' }}>
                  Equiv{arrow('bins')}
                </th>
                <th style={{ ...TH, textAlign: 'right', cursor: 'default' }}>Bins</th>
                <th style={{ ...TH, cursor: 'default' }}>Variety</th>
                <th onClick={() => handleSortClick('date')} style={{ ...TH }}>
                  Last picked{arrow('date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.grower} style={{
                  background: i % 2 === 0 ? '#fff' : '#fafcfa',
                  borderBottom: '1px solid #eef2ee',
                }}>
                  <td style={{ padding: '0.5rem 0.65rem', fontWeight: 500, color: '#11420A' }}>
                    {r.grower}
                  </td>
                  <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right',
                    fontWeight: 700, color: '#2d6a1f' }}>
                    {fmtNum(r.totalEquiv)}
                  </td>
                  <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', color: '#5a6a5a' }}>
                    {r.binCount}
                  </td>
                  <td style={{ padding: '0.5rem 0.65rem', color: '#5a6a5a', fontSize: '0.78rem' }}>
                    {Object.entries(r.varieties)
                      .sort((a, b) => b[1] - a[1])
                      .map(([v, n]) => `${v} (${fmtNum(n)})`)
                      .join(', ')}
                  </td>
                  <td style={{ padding: '0.5rem 0.65rem', color: '#5a6a5a', fontSize: '0.78rem',
                    whiteSpace: 'nowrap' }}>
                    {fmtDate(toYMD(new Date(r.lastDate)))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f5f9f5', borderTop: '2px solid #d4e0d4' }}>
                <td style={{ padding: '0.5rem 0.65rem', fontWeight: 700, color: '#11420A' }}>
                  Total
                </td>
                <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right',
                  fontWeight: 800, color: '#2d6a1f' }}>
                  {fmtNum(totalEquiv)}
                </td>
                <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right',
                  fontWeight: 700, color: '#11420A' }}>
                  {totalBins}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : bins ? (
        <div style={{ color: '#bbb', fontSize: '0.85rem', padding: '1rem 0' }}>
          {growerQuery
            ? `No bins found for "${growerQuery}" in this period.`
            : 'No bins recorded in AvoGrade for this period.'}
        </div>
      ) : (
        <div style={{ color: '#bbb', fontSize: '0.85rem', padding: '1rem 0' }}>Loading…</div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PickingLogPage() {
  const [selectedDate, setSelectedDate] = useState(TODAY);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: seasons } = useApi(`${AVOGRADE}/avograde/seasons`);
  const currentSeason = useMemo(() => {
    if (!seasons?.length) return null;
    return [...seasons].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))[0];
  }, [seasons]);

  const { data: binStats } = useApi(
    currentSeason ? `${AVOGRADE}/avograde/bins/stats?season_id=${currentSeason.id}` : null
  );

  const { data: bins } = useApi(
    currentSeason ? `${AVOGRADE}/avograde/bins?season_id=${currentSeason.id}` : null
  );

  const { data: growers } = useApi(`${BACKEND}/api/growers`);
  const { data: settings } = useApi(`${BACKEND}/api/settings`);

  // ── Derived data ──────────────────────────────────────────────────────────

  const dailyTotals = useMemo(() => {
    const m = {};
    for (const b of (bins || [])) {
      const d = toYMD(new Date(b.date_picked));
      m[d] = (m[d] || 0) + Number(b.bin_equivalent || 1);
    }
    return m;
  }, [bins]);

  const selectedDayBins = useMemo(() => {
    if (!bins) return [];
    return bins.filter(b => toYMD(new Date(b.date_picked)) === selectedDate);
  }, [bins, selectedDate]);

  const selectedDayByGrower = useMemo(() => {
    const m = {};
    for (const b of selectedDayBins) {
      if (!m[b.grower]) m[b.grower] = { total: 0, variety: b.variety };
      m[b.grower].total += Number(b.bin_equivalent || 1);
    }
    return m;
  }, [selectedDayBins]);

  const binsInStorage = Number(binStats?.in_storage || 0);
  const binsGraded    = Number(binStats?.graded      || 0);
  const binsSeason    = Number(binStats?.total_equiv  || 0);

  const oldestBinAge = useMemo(() => {
    const inStorage = (bins || []).filter(b => b.status === 'in-storage');
    if (!inStorage.length) return null;
    const oldest = inStorage.reduce((min, b) =>
      new Date(b.date_picked) < new Date(min.date_picked) ? b : min
    );
    return daysAgo(toYMD(new Date(oldest.date_picked)));
  }, [bins]);

  // ── Mobile geofence detection ─────────────────────────────────────────────
  const [nearbyOrchard,    setNearbyOrchard]    = useState(null);
  const [locationError,    setLocationError]    = useState('');
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

  const lastNotifiedOrchard = useRef(null);
  useEffect(() => {
    if (!nearbyOrchard || nearbyOrchard.id === lastNotifiedOrchard.current) return;
    lastNotifiedOrchard.current = nearbyOrchard.id;
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(`📍 You're at ${nearbyOrchard.name}`, {
          body: 'Log any bins picked today in AvoGrade.',
          icon: '/icon.svg', tag: 'geofence-arrival', data: { url: '/' },
        });
      });
    }
  }, [nearbyOrchard]);

  // ── Calendar cells (6 weeks aligned to Monday) ───────────────────────────
  const calendarCells = useMemo(() => {
    const startRaw = addDays(TODAY, -20);
    const dow = new Date(startRaw + 'T12:00:00').getDay();
    const monOffset = dow === 0 ? 6 : dow - 1;
    const start = addDays(startRaw, -monOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page" style={{ paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>🥑 Picking Schedule</h1>
          <div style={{ fontSize: '0.85rem', color: '#5a6a5a' }}>
            Bin data from AvoGrade
            {currentSeason && (
              <span style={{ marginLeft: 6, fontSize: '0.78rem', background: '#e8f5e8',
                color: '#2d6a1f', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                {currentSeason.label}
              </span>
            )}
          </div>
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

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <StatCard label="In Storage" value={fmtNum(binsInStorage)} unit="equiv"
          sub={oldestBinAge != null ? `Oldest: ${oldestBinAge}d` : 'No bins in storage'}
          color="#e67e22" />
        <StatCard label="Graded" value={fmtNum(binsGraded)} unit="equiv"
          sub="Awaiting dispatch" color="#16a085" />
        <StatCard label="Season Total" value={fmtNum(binsSeason)} unit="equiv"
          sub={currentSeason?.label} color="#2d6a1f" />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Left: calendar + selected day detail */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#11420A', margin: '0 0 0.6rem' }}>
              Pick Calendar
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.6rem',
              fontSize: '0.73rem', color: '#5a6a5a', flexWrap: 'wrap' }}>
              <span>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                  background: '#2d6a1f', marginRight: 4 }} />
                Bins picked
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 3 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.68rem',
                  fontWeight: 700, color: '#5a6a5a', padding: '2px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {calendarCells.map(d => {
                const total   = dailyTotals[d] || 0;
                const isToday = d === TODAY;
                const isSel   = d === selectedDate;
                const isFuture = d > TODAY;
                const ago     = daysAgo(d);
                const inHold  = total > 0 && ago >= 0 && ago < 7;

                return (
                  <button key={d} onClick={() => setSelectedDate(d)} style={{
                    minHeight: 40, borderRadius: 6, padding: '3px 2px',
                    border: isSel ? '2.5px solid #11420A' : isToday ? '2px solid #2d6a1f' : '1px solid #eef2ee',
                    background: isSel ? '#11420A'
                      : total > 0 ? (inHold ? '#fef9e7' : '#e8f5e8')
                      : isFuture ? '#fafafa' : '#fff',
                    color: isSel ? '#fff' : isFuture ? '#ccc' : '#11420A',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: isToday ? 700 : 400, lineHeight: 1.2 }}>
                      {new Date(d + 'T12:00:00').getDate()}
                    </span>
                    {total > 0 && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, lineHeight: 1,
                        color: isSel ? '#c8f0c8' : inHold ? '#e67e22' : '#2d6a1f' }}>
                        {fmtNum(total)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#11420A', marginBottom: '0.6rem' }}>
              {fmtLongDate(selectedDate)}
              {selectedDate === TODAY && (
                <span style={{ marginLeft: 6, fontSize: '0.75rem',
                  background: '#2d6a1f', color: '#fff', borderRadius: 4, padding: '1px 7px' }}>
                  Today
                </span>
              )}
            </div>

            {Object.keys(selectedDayByGrower).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {Object.entries(selectedDayByGrower)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([grower, info]) => (
                    <div key={grower} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.5rem 0.7rem', background: '#f7fbf7',
                      borderRadius: 8, border: '1px solid #d4e0d4',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#11420A', fontSize: '0.9rem' }}>{grower}</div>
                        <div style={{ fontSize: '0.76rem', color: '#888' }}>{info.variety}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: '#2d6a1f', fontSize: '1rem' }}>
                        {fmtNum(info.total)}
                        <span style={{ fontSize: '0.75rem', color: '#5a6a5a', marginLeft: 3 }}>equiv</span>
                      </div>
                    </div>
                  ))}
                <div style={{ fontSize: '0.78rem', color: '#5a6a5a', textAlign: 'right', marginTop: 2 }}>
                  Total: <strong style={{ color: '#2d6a1f' }}>
                    {fmtNum(Object.values(selectedDayByGrower).reduce((s, v) => s + v.total, 0))} equiv
                  </strong>
                  {' · '}data from AvoGrade
                </div>
              </div>
            ) : (
              <div style={{ color: '#bbb', fontSize: '0.85rem' }}>
                {selectedDate > TODAY ? 'Future date.' : 'No bins recorded in AvoGrade for this day.'}
              </div>
            )}
          </div>
        </div>

        {/* Right: Bin Log Search */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <BinLogSearch bins={bins} currentSeason={currentSeason} />
        </div>

      </div>
    </div>
  );
}
