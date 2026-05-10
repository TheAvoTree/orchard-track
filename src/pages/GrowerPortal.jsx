import { useState, useEffect } from 'react';

const HAZARD_ICONS = {
  powerline: '⚡', steep_terrain: '⛰', chemical_storage: '☣',
  bee_hive: '🐝', water_hazard: '💧', machinery: '⚙', other: '⚠',
};
const HAZARD_LABELS = {
  powerline: 'Powerlines', steep_terrain: 'Steep Terrain',
  chemical_storage: 'Chemical Storage', bee_hive: 'Bee Hive',
  water_hazard: 'Water Hazard', machinery: 'Machinery', other: 'Other',
};
const SEV_STYLE = {
  low:      { background: '#e8f5e8', color: '#155724' },
  medium:   { background: '#fff3cd', color: '#856404' },
  high:     { background: '#ffe0b2', color: '#7c4000' },
  critical: { background: '#f8d7da', color: '#721c24' },
};

export default function GrowerPortal({ token }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [view,     setView]     = useState('home'); // 'home' | 'log-spray' | 'report-hazard'

  const [sprayForm, setSprayForm] = useState({
    spray_date: new Date().toISOString().slice(0, 10),
    product: '', withholding_days: 14, notes: '',
  });
  const [hazardForm, setHazardForm] = useState({ type: 'other', title: '', description: '', severity: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(null);

  async function load() {
    try {
      const res = await fetch(`/api/safety/portal/${token}`);
      if (!res.ok) throw new Error('Invalid or expired link');
      setData(await res.json());
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [token]);

  async function submitSpray(e) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/safety/portal/${token}/spray`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sprayForm),
    });
    if (res.ok) { setSubmitted('spray'); setView('home'); load(); }
    else alert((await res.json()).error);
    setSubmitting(false);
  }

  async function submitHazard(e) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/safety/portal/${token}/hazard`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hazardForm),
    });
    if (res.ok) { setSubmitted('hazard'); setView('home'); load(); }
    else alert((await res.json()).error);
    setSubmitting(false);
  }

  if (loading) return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', paddingTop: '4rem', color: '#5a6a5a' }}>Loading…</div>
    </div>
  );

  if (error) return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔗</div>
        <div style={{ color: '#c0392b', fontWeight: 700 }}>{error}</div>
        <div style={{ color: '#888', fontSize: '0.85rem', marginTop: 8 }}>
          Contact The Avo Tree for a new link.
        </div>
      </div>
    </div>
  );

  const { grower, hazards, spray } = data;
  const activeSpray = spray?.filter(s => s.under_withholding) ?? [];

  // ── Home view ──

  if (view === 'home') return (
    <div style={pageStyle}>
      <div style={header}>
        <div style={{ fontSize: '1.5rem' }}>🥑</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}>The Avo Tree</div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>Orchard Safety Portal</div>
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{grower.name}</div>
        <div style={{ fontSize: '0.83rem', color: '#5a6a5a', marginBottom: '1.25rem' }}>{grower.address}</div>

        {submitted === 'spray'  && <div style={successBanner}>✓ Spray record submitted successfully</div>}
        {submitted === 'hazard' && <div style={successBanner}>✓ Hazard reported — our team will be notified</div>}

        {/* Active spray restriction */}
        {activeSpray.length > 0 && activeSpray.map(s => (
          <div key={s.id} style={{ background: '#fff5f5', border: '1px solid #f5c6cb',
            borderRadius: 8, padding: '0.9rem 1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#c0392b', marginBottom: 4 }}>🚫 Spray Withholding Active</div>
            <div style={{ fontSize: '0.85rem', color: '#721c24' }}>
              {s.product && <><strong>{s.product}</strong> · </>}
              Applied {new Date(s.spray_date).toLocaleDateString('en-NZ')}<br />
              <strong>Safe re-entry: {new Date(s.safe_reentry_date).toLocaleDateString('en-NZ')}</strong>
              {' '}({s.days_remaining} day{s.days_remaining !== 1 ? 's' : ''} remaining)
            </div>
          </div>
        ))}

        {/* Active hazards */}
        {hazards?.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: '#856404', marginBottom: 8 }}>Active Hazards</div>
            {hazards.map(h => (
              <div key={h.id} style={{ ...SEV_STYLE[h.severity], borderRadius: 6,
                padding: '0.6rem 0.85rem', marginBottom: 6, fontSize: '0.85rem' }}>
                <strong>{HAZARD_ICONS[h.type]} {h.title}</strong>
                {h.description && <div style={{ marginTop: 4, opacity: 0.85 }}>{h.description}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: '1rem' }}>
          <button onClick={() => setView('log-spray')} style={actionBtn('#c0392b')}>
            🚫 Log Spray Application
          </button>
          <button onClick={() => setView('report-hazard')} style={actionBtn('#e67e22')}>
            ⚠ Report a Hazard
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#aaa', textAlign: 'center' }}>
          This portal is specific to {grower.name}.<br />
          Managed by The Avo Tree · Orchard Track
        </div>
      </div>
    </div>
  );

  // ── Log spray view ──

  if (view === 'log-spray') return (
    <div style={pageStyle}>
      <div style={{ ...header, background: '#c0392b' }}>
        <button onClick={() => setView('home')} style={backBtn}>← Back</button>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Log Spray Application</div>
        <div />
      </div>
      <div style={{ padding: '1.25rem' }}>
        <p style={{ fontSize: '0.85rem', color: '#5a6a5a', marginTop: 0 }}>
          Record a spray application on <strong>{grower.name}</strong>.
          This will set a withholding period during which the picking crew will be warned not to enter.
        </p>
        <form onSubmit={submitSpray} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={mLbl}>
            Date of spray *
            <input type="date" required value={sprayForm.spray_date}
              onChange={e => setSprayForm(f => ({ ...f, spray_date: e.target.value }))} style={mInp} />
          </label>
          <label style={mLbl}>
            Product / Chemical
            <input value={sprayForm.product} onChange={e => setSprayForm(f => ({ ...f, product: e.target.value }))}
              placeholder="e.g. Copper oxychloride" style={mInp} />
          </label>
          <label style={mLbl}>
            Withholding period (days)
            <input type="number" min={1} value={sprayForm.withholding_days}
              onChange={e => setSprayForm(f => ({ ...f, withholding_days: Number(e.target.value) }))} style={mInp} />
            <span style={{ fontSize: '0.75rem', color: '#888' }}>Standard is 14 days — check product label</span>
          </label>
          <label style={mLbl}>
            Notes
            <textarea value={sprayForm.notes} onChange={e => setSprayForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} placeholder="Any additional information…" style={{ ...mInp, resize: 'vertical' }} />
          </label>
          <button type="submit" disabled={submitting} style={actionBtn('#c0392b')}>
            {submitting ? 'Submitting…' : 'Submit Spray Record'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Report hazard view ──

  return (
    <div style={pageStyle}>
      <div style={{ ...header, background: '#e67e22' }}>
        <button onClick={() => setView('home')} style={backBtn}>← Back</button>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Report a Hazard</div>
        <div />
      </div>
      <div style={{ padding: '1.25rem' }}>
        <p style={{ fontSize: '0.85rem', color: '#5a6a5a', marginTop: 0 }}>
          Report a hazard on <strong>{grower.name}</strong> that the picking crew should be aware of.
        </p>
        <form onSubmit={submitHazard} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={mLbl}>
            Hazard Type
            <select value={hazardForm.type} onChange={e => setHazardForm(f => ({ ...f, type: e.target.value }))} style={mInp}>
              {Object.entries(HAZARD_LABELS).map(([k, v]) => <option key={k} value={k}>{HAZARD_ICONS[k]} {v}</option>)}
            </select>
          </label>
          <label style={mLbl}>
            Title / Brief description *
            <input required value={hazardForm.title} onChange={e => setHazardForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Overhead powerlines near driveway" style={mInp} />
          </label>
          <label style={mLbl}>
            Severity
            <select value={hazardForm.severity} onChange={e => setHazardForm(f => ({ ...f, severity: e.target.value }))} style={mInp}>
              <option value="low">Low — minor risk, be aware</option>
              <option value="medium">Medium — take precautions</option>
              <option value="high">High — significant risk</option>
              <option value="critical">Critical — immediate danger</option>
            </select>
          </label>
          <label style={mLbl}>
            Details
            <textarea value={hazardForm.description} onChange={e => setHazardForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Location on property, specific danger, what precautions to take…"
              style={{ ...mInp, resize: 'vertical' }} />
          </label>
          <button type="submit" disabled={submitting} style={actionBtn('#e67e22')}>
            {submitting ? 'Submitting…' : 'Submit Hazard Report'}
          </button>
        </form>
      </div>
    </div>
  );
}

const pageStyle = {
  maxWidth: 480, margin: '0 auto', minHeight: '100vh',
  background: '#fff', fontFamily: "'Helvetica Neue', Arial, sans-serif",
};
const header = {
  background: '#2d6a2d', padding: '1rem 1.25rem',
  display: 'flex', alignItems: 'center', gap: 12,
};
const backBtn = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)',
  cursor: 'pointer', fontSize: '0.9rem', padding: 0,
};
const actionBtn = (bg) => ({
  background: bg, color: '#fff', border: 'none', borderRadius: 10,
  padding: '0.9rem 1rem', fontSize: '1rem', fontWeight: 700,
  cursor: 'pointer', textAlign: 'center',
});
const successBanner = {
  background: '#d4edda', color: '#155724', borderRadius: 8,
  padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 600, fontSize: '0.88rem',
};
const mLbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.88rem', fontWeight: 600 };
const mInp = {
  padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #d4e0d4',
  fontSize: '1rem', width: '100%', boxSizing: 'border-box',
};
