import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi.js';

const HAZARD_ICONS = {
  powerline:        '⚡',
  steep_terrain:    '🏔',
  steep_drop:       '🧱',
  chemical_storage: '☣',
  bee_hive:         '🐝',
  water_hazard:     '💧',
  machinery:        '⚙',
  other:            '⚠',
};
const HAZARD_LABELS = {
  powerline: 'Powerlines', steep_terrain: 'Steep Terrain',
  steep_drop: 'Steep Drop / Retaining Wall / Cliff',
  chemical_storage: 'Chemical Storage', bee_hive: 'Bee Hive',
  water_hazard: 'Water Hazard', machinery: 'Machinery', other: 'Other',
};
const SEV_STYLE = {
  low:      { background: '#e8f5e8', color: '#155724' },
  medium:   { background: '#fff3cd', color: '#856404' },
  high:     { background: '#ffe0b2', color: '#7c4000' },
  critical: { background: '#f8d7da', color: '#721c24' },
};

function SevBadge({ severity }) {
  return (
    <span style={{ ...SEV_STYLE[severity], borderRadius: 4, padding: '1px 7px',
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
      {severity}
    </span>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, loading, refetch } = useApi('/api/safety/active');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  async function runScan() {
    setScanning(true); setScanResult(null);
    try {
      const res = await fetch('/api/safety/scan-hazards', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await res.json();
      setScanResult(d);
      refetch();
    } catch (e) { setScanResult({ error: e.message }); }
    setScanning(false);
  }

  if (loading) return <div className="state-loading">Loading…</div>;

  const spray   = data?.spray   ?? [];
  const hazards = data?.hazards ?? [];

  return (
    <div>
      {/* Scan button */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1.5rem',
        padding: '1rem', background: '#f5f9f5', borderRadius: 8, border: '1px solid #d4e8d4' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2d6a2d' }}>LINZ Auto-Scan</div>
          <div style={{ fontSize: '0.8rem', color: '#5a6a5a', marginTop: 2 }}>
            Checks all orchards with property boundaries for powerlines (⚡) and steep terrain (⛰) using LINZ data.
          </div>
        </div>
        <button className="btn btn-primary" onClick={runScan} disabled={scanning} style={{ flexShrink: 0 }}>
          {scanning ? 'Scanning…' : '🔍 Scan All Orchards'}
        </button>
        {scanResult && !scanResult.error && (
          <span style={{ fontSize: '0.83rem', color: '#2d6a2d', fontWeight: 600 }}>
            ✓ Scanned {scanResult.scanned} orchards — {scanResult.results?.reduce((s,r) => s + r.new_hazards, 0)} new hazards found
          </span>
        )}
        {scanResult?.error && <span style={{ fontSize: '0.83rem', color: '#c0392b' }}>{scanResult.error}</span>}
      </div>

      {/* Active spray withholding */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: spray.length ? '#c0392b' : '#2d6a2d',
          marginBottom: '0.5rem' }}>
          🚫 Spray Withholding ({spray.length} active)
        </h3>
        {!spray.length && <div style={{ color: '#5a6a5a', fontSize: '0.88rem' }}>No orchards currently under spray withholding.</div>}
        {spray.map(s => (
          <div key={s.grower_id} style={{ background: '#fff5f5', border: '1px solid #f5c6cb',
            borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '0.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#721c24' }}>{s.grower_name}</div>
              <div style={{ fontSize: '0.8rem', color: '#721c24', marginTop: 2 }}>
                {s.product && <span><strong>{s.product}</strong> · </span>}
                Sprayed {new Date(s.spray_date).toLocaleDateString('en-NZ')} ·
                Safe re-entry: <strong>{new Date(s.safe_reentry_date).toLocaleDateString('en-NZ')}</strong>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#721c24' }}>{s.days_remaining}</div>
              <div style={{ fontSize: '0.72rem', color: '#888' }}>days left</div>
            </div>
          </div>
        ))}
      </div>

      {/* Active hazards */}
      <div>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: hazards.length ? '#856404' : '#2d6a2d',
          marginBottom: '0.5rem' }}>
          ⚠ Orchards with Active Hazards ({hazards.length})
        </h3>
        {!hazards.length && <div style={{ color: '#5a6a5a', fontSize: '0.88rem' }}>No active hazards recorded.</div>}
        {hazards.map(h => (
          <div key={h.grower_id} style={{ background: '#fffdf0', border: '1px solid #e8d87a',
            borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{h.grower_name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {h.hazards.map(hz => (
                <span key={hz.id} style={{ ...SEV_STYLE[hz.severity], borderRadius: 6,
                  padding: '3px 10px', fontSize: '0.8rem', fontWeight: 600 }}>
                  {HAZARD_ICONS[hz.type]} {hz.title}
                  {hz.auto_detected && <span style={{ marginLeft: 4, opacity: 0.7, fontSize: '0.7rem' }}>auto</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hazards tab ───────────────────────────────────────────────────────────────

function HazardsTab({ growers }) {
  const { data, loading, refetch } = useApi('/api/safety/hazards?status=active');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    grower_id: '', type: 'other', title: '', description: '',
    severity: 'medium', reported_by: '',
  });

  async function submit(e) {
    e.preventDefault();
    const res = await fetch('/api/safety/hazards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowForm(false); setForm({ grower_id: '', type: 'other', title: '', description: '', severity: 'medium', reported_by: '' }); refetch(); }
    else alert((await res.json()).error);
  }

  async function resolve(id) {
    const by = prompt('Resolved by (name):');
    if (by === null) return;
    await fetch(`/api/safety/hazards/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolved_by: by || 'crew' }),
    });
    refetch();
  }

  async function del(id) {
    if (!confirm('Delete this hazard?')) return;
    await fetch(`/api/safety/hazards/${id}`, { method: 'DELETE' });
    refetch();
  }

  if (loading) return <div className="state-loading">Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#5a6a5a' }}>{data?.length ?? 0} active hazards</div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ Report Hazard'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem' }}>
              <label style={lbl}>
                Orchard *
                <select required value={form.grower_id} onChange={e => setForm(f => ({ ...f, grower_id: e.target.value }))} style={sel}>
                  <option value="">— Select orchard —</option>
                  {growers?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              <label style={lbl}>
                Hazard Type
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={sel}>
                  {Object.entries(HAZARD_LABELS).map(([k, v]) => <option key={k} value={k}>{HAZARD_ICONS[k]} {v}</option>)}
                </select>
              </label>
              <label style={lbl}>
                Severity
                <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={sel}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label style={lbl}>
                Title *
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Overhead powerlines near driveway" style={inp} />
              </label>
              <label style={{ ...lbl, gridColumn: 'span 2' }}>
                Description
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Additional details, location on property, precautions…"
                  rows={2} style={{ ...inp, resize: 'vertical' }} />
              </label>
              <label style={lbl}>
                Reported by
                <input value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))}
                  placeholder="Your name" style={inp} />
              </label>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <button className="btn btn-primary" type="submit">Save Hazard</button>
            </div>
          </form>
        </div>
      )}

      {!data?.length && !loading && (
        <div className="state-empty">No active hazards. Use "Scan All Orchards" on the Overview tab to auto-detect powerlines and steep terrain.</div>
      )}

      {data?.map(h => (
        <div key={h.id} className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '0.5rem',
          borderLeft: `4px solid ${h.severity === 'critical' ? '#c0392b' : h.severity === 'high' ? '#e67e22' : h.severity === 'medium' ? '#f0c040' : '#2d6a2d'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '1.1rem' }}>{HAZARD_ICONS[h.type]}</span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{h.title}</span>
                <SevBadge severity={h.severity} />
                {h.auto_detected && <span style={{ fontSize: '0.72rem', background: '#e8f5e8', color: '#2d6a2d',
                  borderRadius: 4, padding: '1px 6px' }}>auto-detected</span>}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>
                {h.grower_name} · {HAZARD_LABELS[h.type]}
                {h.reported_by && ` · Reported by ${h.reported_by}`}
                {' · '}{new Date(h.reported_at).toLocaleDateString('en-NZ')}
              </div>
              {h.description && <div style={{ fontSize: '0.82rem', color: '#444', marginTop: 6, lineHeight: 1.5 }}>{h.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
              <button className="btn btn-secondary" style={{ fontSize: '0.76rem', padding: '0.2rem 0.55rem' }}
                onClick={() => resolve(h.id)}>✓ Resolve</button>
              <button style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
                onClick={() => del(h.id)} title="Delete">×</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Spray tab ─────────────────────────────────────────────────────────────────

function SprayTab({ growers }) {
  const { data, loading, refetch } = useApi('/api/safety/spray');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    grower_id: '', spray_date: new Date().toISOString().slice(0, 10),
    product: '', withholding_days: 14, notes: '', reported_by: '',
  });

  async function submit(e) {
    e.preventDefault();
    const res = await fetch('/api/safety/spray', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowForm(false); refetch(); }
    else alert((await res.json()).error);
  }

  async function del(id) {
    if (!confirm('Delete this spray record?')) return;
    await fetch(`/api/safety/spray/${id}`, { method: 'DELETE' });
    refetch();
  }

  if (loading) return <div className="state-loading">Loading…</div>;

  const active   = data?.filter(s => s.under_withholding) ?? [];
  const historic = data?.filter(s => !s.under_withholding) ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#5a6a5a' }}>
          {active.length} active restriction{active.length !== 1 ? 's' : ''} · {data?.length ?? 0} total records
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ Log Spray'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem' }}>
              <label style={lbl}>
                Orchard *
                <select required value={form.grower_id} onChange={e => setForm(f => ({ ...f, grower_id: e.target.value }))} style={sel}>
                  <option value="">— Select orchard —</option>
                  {growers?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              <label style={lbl}>
                Spray Date *
                <input type="date" required value={form.spray_date}
                  onChange={e => setForm(f => ({ ...f, spray_date: e.target.value }))} style={inp} />
              </label>
              <label style={lbl}>
                Product / Chemical
                <input value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
                  placeholder="e.g. Copper oxychloride" style={inp} />
              </label>
              <label style={lbl}>
                Withholding (days)
                <input type="number" min={1} value={form.withholding_days}
                  onChange={e => setForm(f => ({ ...f, withholding_days: Number(e.target.value) }))} style={inp} />
              </label>
              <label style={{ ...lbl, gridColumn: 'span 2' }}>
                Notes
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Full coverage spray, avoid for 2 weeks" style={inp} />
              </label>
              <label style={lbl}>
                Reported by
                <input value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))}
                  placeholder="Your name or 'grower'" style={inp} />
              </label>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <button className="btn btn-primary" type="submit">Save Record</button>
            </div>
          </form>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: '#c0392b', marginBottom: '0.5rem' }}>
            🚫 Currently restricted ({active.length})
          </h3>
          {active.map(s => <SprayRow key={s.id} s={s} onDelete={del} highlight />)}
        </div>
      )}

      {historic.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: '#5a6a5a', marginBottom: '0.5rem' }}>
            Past Records
          </h3>
          {historic.map(s => <SprayRow key={s.id} s={s} onDelete={del} />)}
        </div>
      )}

      {!data?.length && <div className="state-empty">No spray records yet.</div>}
    </div>
  );
}

function SprayRow({ s, onDelete, highlight }) {
  return (
    <div style={{
      background: highlight ? '#fff5f5' : '#fafafa',
      border: `1px solid ${highlight ? '#f5c6cb' : '#e8f0e8'}`,
      borderRadius: 8, padding: '0.8rem 1rem', marginBottom: '0.4rem',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: highlight ? '#721c24' : '#1c2b1e' }}>
          {s.grower_name}
          {s.product && <span style={{ fontWeight: 400, marginLeft: 8, color: '#5a6a5a' }}>— {s.product}</span>}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#666', marginTop: 2 }}>
          Sprayed {new Date(s.spray_date).toLocaleDateString('en-NZ')} ·
          {highlight
            ? <span style={{ color: '#c0392b', fontWeight: 600 }}> Safe re-entry {new Date(s.safe_reentry_date).toLocaleDateString('en-NZ')} ({s.days_remaining}d)</span>
            : ` Cleared ${new Date(s.safe_reentry_date).toLocaleDateString('en-NZ')}`}
          {s.withholding_days !== 14 && ` · ${s.withholding_days}d withholding`}
          {s.reported_by && ` · by ${s.reported_by}`}
        </div>
        {s.notes && <div style={{ fontSize: '0.77rem', color: '#888', marginTop: 3, fontStyle: 'italic' }}>{s.notes}</div>}
      </div>
      <button style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem', marginLeft: 12 }}
        onClick={() => onDelete(s.id)} title="Delete">×</button>
    </div>
  );
}

// ── Grower portal link tab ────────────────────────────────────────────────────

function PortalTab({ growers }) {
  const [selectedId, setSelectedId] = useState('');
  const [copied, setCopied] = useState(false);
  const [portalData, setPortalData] = useState(null);

  const grower = growers?.find(g => String(g.id) === selectedId);
  const token = grower?.safety_token;
  const portalUrl = token ? `${window.location.origin}/safety/${token}` : '';

  function copy() {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (!token) return;
    fetch(`/api/safety/portal/${token}`)
      .then(r => r.json()).then(setPortalData).catch(() => {});
  }, [token]);

  return (
    <div>
      <div style={{ background: '#e8f5e8', border: '1px solid #b8ddb8', borderRadius: 8,
        padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#2d4a2d' }}>
        <strong>How it works:</strong> Each grower gets a unique link. They can open it on their phone to log sprays
        and report hazards without needing an account. Share the link via text or WhatsApp.
      </div>

      <label style={{ ...lbl, marginBottom: '0.75rem' }}>
        Select Grower
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...sel, maxWidth: 320 }}>
          <option value="">— Choose a grower —</option>
          {growers?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>

      {portalUrl && (
        <div style={{ background: '#f5f9f5', border: '1px solid #d4e0d4', borderRadius: 8, padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5a6a5a', marginBottom: 6 }}>
            Portal link for {grower?.name}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ background: '#fff', border: '1px solid #d4e0d4', borderRadius: 5,
              padding: '0.35rem 0.7rem', fontSize: '0.82rem', wordBreak: 'break-all', flex: 1 }}>
              {portalUrl}
            </code>
            <button className="btn btn-secondary" onClick={copy} style={{ flexShrink: 0 }}>
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>

          {portalData && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#5a6a5a' }}>
              <strong>Current status:</strong>{' '}
              {portalData.spray?.filter(s => s.under_withholding).length ?? 0} active spray restriction(s) ·{' '}
              {portalData.hazards?.length ?? 0} active hazard(s)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SafetyPage() {
  const { data: growers } = useApi('/api/growers');
  const [tab, setTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'hazards',  label: '⚠ Hazards' },
    { id: 'spray',    label: '🚫 Spray' },
    { id: 'portal',   label: '🔗 Grower Portal' },
  ];

  return (
    <div className="page">
      <h1 className="page-title">Health & Safety</h1>

      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', borderBottom: '2px solid #e8f0e8', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '0.45rem 1rem', border: 'none', cursor: 'pointer',
            borderBottom: tab === t.id ? '2px solid #2d6a2d' : '2px solid transparent',
            background: 'none', fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? '#2d6a2d' : '#666', fontSize: '0.88rem', marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'hazards'  && <HazardsTab  growers={growers} />}
      {tab === 'spray'    && <SprayTab    growers={growers} />}
      {tab === 'portal'   && <PortalTab   growers={growers} />}
    </div>
  );
}

const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.83rem', fontWeight: 600, color: '#1c2b1e' };
const inp = { padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' };
const sel = { ...inp };
