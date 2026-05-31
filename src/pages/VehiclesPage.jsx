import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { format } from 'date-fns';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

// ── helpers ──────────────────────────────────────────────────────────────────

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - Date.now()) / 86400000);
}
function kmsLeft(due, speedo) {
  return (due != null && speedo != null) ? due - speedo : null;
}
function hrsLeft(due, current) {
  return (due != null && current != null) ? due - current : null;
}

function dateStatus(d) {
  if (d === null) return 'none';
  if (d < 0)   return 'expired';
  if (d <= 7)  return 'urgent';
  if (d <= 30) return 'warning';
  return 'ok';
}
function kmStatus(left) {
  if (left === null) return 'none';
  if (left <= 200)  return 'urgent';
  if (left <= 1000) return 'warning';
  return 'ok';
}
function hrStatus(left) {
  if (left === null) return 'none';
  if (left <= 5)   return 'urgent';
  if (left <= 20)  return 'warning';
  return 'ok';
}

const S = {
  ok:      { bg: '#d4edda', text: '#155724' },
  warning: { bg: '#fff3cd', text: '#856404' },
  urgent:  { bg: '#f8d7da', text: '#721c24' },
  expired: { bg: '#f8d7da', text: '#721c24' },
  none:    { bg: '#f0f0f0', text: '#888' },
};
const ICON = { ok: '🟢', warning: '🟡', urgent: '🔴', expired: '🔴', none: '⚪' };

function Badge({ status, label }) {
  return (
    <span style={{ ...S[status], borderRadius: 5, padding: '2px 7px',
      fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {ICON[status]} {label}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtN(n, unit = '') {
  if (n == null) return null;
  return Number(n).toLocaleString() + (unit ? ' ' + unit : '');
}

// ── per-type summary badges ───────────────────────────────────────────────────

function SummaryBadges({ v }) {
  if (v.asset_type === 'vehicle') {
    const regoD = daysUntil(v.rego_expiry);
    const wofD  = daysUntil(v.wof_expiry);
    const svc   = kmsLeft(v.service_due_km, v.current_speedo);
    const ruc   = kmsLeft(v.ruc_expiry_km, v.current_speedo);
    return (
      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Badge status={dateStatus(regoD)} label="Rego" />
        <Badge status={dateStatus(wofD)}  label="WOF" />
        <Badge status={kmStatus(svc)}     label="Service" />
        <Badge status={kmStatus(ruc)}     label="RUC" />
      </span>
    );
  }
  if (v.asset_type === 'trailer') {
    const regoD = daysUntil(v.rego_expiry);
    const wofD  = daysUntil(v.wof_expiry);
    return (
      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Badge status={dateStatus(regoD)} label="Rego" />
        <Badge status={dateStatus(wofD)}  label="WOF" />
      </span>
    );
  }
  // machinery
  const oilLeft    = hrsLeft(v.last_oil_change_hours != null ? Number(v.last_oil_change_hours) + Number(v.oil_change_interval || 100) : null, v.current_hours);
  const filterLeft = hrsLeft(v.last_oil_filter_hours != null ? Number(v.last_oil_filter_hours) + Number(v.oil_filter_interval || 200) : null, v.current_hours);
  const hrs = v.current_hours != null ? `${fmtN(v.current_hours)} hrs` : 'Hours not set';
  return (
    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.78rem', color: '#666', marginRight: 2 }}>{hrs}</span>
      <Badge status={hrStatus(oilLeft)}    label="Oil" />
      <Badge status={hrStatus(filterLeft)} label="Filter" />
    </span>
  );
}

// ── detail view (read-only) ───────────────────────────────────────────────────

function DetailRow({ label, status, primary, secondary }) {
  return (
    <tr style={{ borderBottom: '1px solid #f0f5f0' }}>
      <td style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#5a6a5a', fontWeight: 600, width: 130 }}>{label}</td>
      <td style={{ padding: '6px 8px' }}><Badge status={status} label={primary} /></td>
      <td style={{ padding: '6px 8px', fontSize: '0.78rem', color: '#666' }}>{secondary ?? ''}</td>
    </tr>
  );
}

function MaintenanceDetail({ v }) {
  if (v.asset_type === 'vehicle') {
    const regoD = daysUntil(v.rego_expiry);
    const wofD  = daysUntil(v.wof_expiry);
    const svc   = kmsLeft(v.service_due_km, v.current_speedo);
    const ruc   = kmsLeft(v.ruc_expiry_km, v.current_speedo);
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
        <DetailRow label="Registration"
          status={dateStatus(regoD)}
          primary={v.rego_expiry ? `${fmtDate(v.rego_expiry)} (${regoD < 0 ? 'EXPIRED' : regoD + 'd'})` : 'Not set'}
          secondary={v.rego_appt_booked} />
        <DetailRow label="WOF"
          status={dateStatus(wofD)}
          primary={v.wof_expiry ? `${fmtDate(v.wof_expiry)} (${wofD < 0 ? 'EXPIRED' : wofD + 'd'})` : 'Not set'}
          secondary={v.wof_appt_booked} />
        <DetailRow label="Service"
          status={kmStatus(svc)}
          primary={v.service_due_km ? `Due at ${fmtN(v.service_due_km, 'km')}${svc !== null ? ` · ${fmtN(svc, 'km')} left` : ''}` : 'Not set'}
          secondary={v.service_appt_booked} />
        <DetailRow label="RUC"
          status={kmStatus(ruc)}
          primary={v.ruc_expiry_km ? `Exp. at ${fmtN(v.ruc_expiry_km, 'km')}${ruc !== null ? ` · ${fmtN(ruc, 'km')} left` : ''}` : 'Not set'}
          secondary={v.ruc_last_purchased_date ? `Last purchased ${fmtDate(v.ruc_last_purchased_date)}` : null} />
        {v.current_speedo != null && (
          <tr><td style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#5a6a5a', fontWeight: 600 }}>Odometer</td>
            <td colSpan={2} style={{ padding: '6px 8px', fontSize: '0.82rem', color: '#444' }}>{fmtN(v.current_speedo, 'km')}</td></tr>
        )}
      </tbody></table>
    );
  }

  if (v.asset_type === 'trailer') {
    const regoD = daysUntil(v.rego_expiry);
    const wofD  = daysUntil(v.wof_expiry);
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
        <DetailRow label="Registration"
          status={dateStatus(regoD)}
          primary={v.rego_expiry ? `${fmtDate(v.rego_expiry)} (${regoD < 0 ? 'EXPIRED' : regoD + 'd'})` : 'Not set'}
          secondary={v.rego_appt_booked} />
        <DetailRow label="WOF"
          status={dateStatus(wofD)}
          primary={v.wof_expiry ? `${fmtDate(v.wof_expiry)} (${wofD < 0 ? 'EXPIRED' : wofD + 'd'})` : 'Not set'}
          secondary={v.wof_appt_booked} />
      </tbody></table>
    );
  }

  // machinery
  const oilNextHrs    = v.last_oil_change_hours != null ? Number(v.last_oil_change_hours) + Number(v.oil_change_interval || 100) : null;
  const filterNextHrs = v.last_oil_filter_hours != null ? Number(v.last_oil_filter_hours) + Number(v.oil_filter_interval  || 200) : null;
  const oilLeft    = hrsLeft(oilNextHrs, v.current_hours);
  const filterLeft = hrsLeft(filterNextHrs, v.current_hours);

  const parts = [
    v.oil_type         && ['Oil Type', v.oil_type],
    v.oil_filter_part  && ['Oil Filter', v.oil_filter_part],
    v.fuel_filter_part && ['Fuel Filter', v.fuel_filter_part],
    v.air_filter_part  && ['Air Filter', v.air_filter_part],
    v.pre_cleaner_part && ['Pre Cleaner', v.pre_cleaner_part],
    v.spark_plug_part  && ['Spark Plug', v.spark_plug_part],
  ].filter(Boolean);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
      <tr style={{ borderBottom: '1px solid #f0f5f0' }}>
        <td style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#5a6a5a', fontWeight: 600, width: 130 }}>Current Hours</td>
        <td colSpan={2} style={{ padding: '6px 8px', fontSize: '0.88rem', fontWeight: 700, color: '#1c2b1e' }}>
          {v.current_hours != null ? fmtN(v.current_hours, 'hrs') : '— not set'}
        </td>
      </tr>
      <DetailRow label={`Oil Change (/${v.oil_change_interval || 100}hrs)`}
        status={hrStatus(oilLeft)}
        primary={oilNextHrs ? `Next at ${fmtN(oilNextHrs, 'hrs')}${oilLeft !== null ? ` · ${fmtN(oilLeft, 'hrs')} left` : ''}` : 'Not set'}
        secondary={v.last_oil_change_hours ? `Last at ${fmtN(v.last_oil_change_hours, 'hrs')}` : null} />
      <DetailRow label={`Oil Filter (/${v.oil_filter_interval || 200}hrs)`}
        status={hrStatus(filterLeft)}
        primary={filterNextHrs ? `Next at ${fmtN(filterNextHrs, 'hrs')}${filterLeft !== null ? ` · ${fmtN(filterLeft, 'hrs')} left` : ''}` : 'Not set'}
        secondary={v.last_oil_filter_hours ? `Last at ${fmtN(v.last_oil_filter_hours, 'hrs')}` : null} />
      {parts.length > 0 && (
        <tr><td colSpan={3} style={{ paddingTop: 12, paddingBottom: 4, paddingLeft: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2d6a2d', marginBottom: 6 }}>Parts Reference</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {parts.map(([label, val]) => (
              <span key={label} style={{ background: '#f0f5f0', borderRadius: 5, padding: '3px 8px', fontSize: '0.78rem', color: '#2d4a2d' }}>
                <span style={{ color: '#888', marginRight: 4 }}>{label}:</span>{val}
              </span>
            ))}
          </div>
        </td></tr>
      )}
    </tbody></table>
  );
}

// ── edit panel ────────────────────────────────────────────────────────────────

function EditPanel({ v, onSaved, onCancel }) {
  const isVehicle  = v.asset_type === 'vehicle';
  const isTrailer  = v.asset_type === 'trailer';
  const isMachinery = v.asset_type === 'machinery';

  const [form, setForm] = useState({
    rego_expiry:             v.rego_expiry?.slice(0,10)             ?? '',
    rego_appt_booked:        v.rego_appt_booked                     ?? '',
    wof_expiry:              v.wof_expiry?.slice(0,10)              ?? '',
    wof_appt_booked:         v.wof_appt_booked                      ?? '',
    service_due_km:          v.service_due_km                       ?? '',
    service_appt_booked:     v.service_appt_booked                  ?? '',
    ruc_expiry_km:           v.ruc_expiry_km                        ?? '',
    ruc_last_purchased_date: v.ruc_last_purchased_date?.slice(0,10) ?? '',
    current_speedo:          v.current_speedo                       ?? '',
    current_hours:           v.current_hours                        ?? '',
    last_oil_change_hours:   v.last_oil_change_hours                ?? '',
    oil_change_interval:     v.oil_change_interval                  ?? 100,
    last_oil_filter_hours:   v.last_oil_filter_hours                ?? '',
    oil_filter_interval:     v.oil_filter_interval                  ?? 200,
    last_fuel_filter_hours:  v.last_fuel_filter_hours               ?? '',
    fuel_filter_interval:    v.fuel_filter_interval                 ?? '',
    oil_type:                v.oil_type                             ?? '',
    oil_filter_part:         v.oil_filter_part                      ?? '',
    fuel_filter_part:        v.fuel_filter_part                     ?? '',
    air_filter_part:         v.air_filter_part                      ?? '',
    pre_cleaner_part:        v.pre_cleaner_part                     ?? '',
    spark_plug_part:         v.spark_plug_part                      ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, val) => setForm(f => ({ ...f, [k]: val }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${v.id}/maintenance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: '#f8faf8', border: '1px solid #d4e0d4', borderRadius: 8, padding: '1.1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>

        {(isVehicle || isTrailer) && (
          <div>
            <div style={secLabel}>Registration</div>
            <FR label="Expiry"><input type="date" value={form.rego_expiry} onChange={e=>set('rego_expiry',e.target.value)} style={inp}/></FR>
            <FR label="Notes"><input value={form.rego_appt_booked} onChange={e=>set('rego_appt_booked',e.target.value)} placeholder="e.g. Booked" style={inp}/></FR>
          </div>
        )}

        {(isVehicle || isTrailer) && (
          <div>
            <div style={secLabel}>Warrant of Fitness</div>
            <FR label="Expiry"><input type="date" value={form.wof_expiry} onChange={e=>set('wof_expiry',e.target.value)} style={inp}/></FR>
            <FR label="Notes"><input value={form.wof_appt_booked} onChange={e=>set('wof_appt_booked',e.target.value)} placeholder="e.g. Yes" style={inp}/></FR>
          </div>
        )}

        {isVehicle && (
          <div>
            <div style={secLabel}>Service (km)</div>
            <FR label="Due at (km)"><input type="number" value={form.service_due_km} onChange={e=>set('service_due_km',e.target.value)} placeholder="e.g. 168000" style={inp}/></FR>
            <FR label="Notes"><input value={form.service_appt_booked} onChange={e=>set('service_appt_booked',e.target.value)} placeholder="e.g. Booked" style={inp}/></FR>
          </div>
        )}

        {isVehicle && (
          <div>
            <div style={secLabel}>Road User Charges</div>
            <FR label="Expiry at (km)"><input type="number" value={form.ruc_expiry_km} onChange={e=>set('ruc_expiry_km',e.target.value)} placeholder="e.g. 191743" style={inp}/></FR>
            <FR label="Last Purchased"><input type="date" value={form.ruc_last_purchased_date} onChange={e=>set('ruc_last_purchased_date',e.target.value)} style={inp}/></FR>
          </div>
        )}

        {isVehicle && (
          <div>
            <div style={secLabel}>Odometer</div>
            <FR label="Current (km)"><input type="number" value={form.current_speedo} onChange={e=>set('current_speedo',e.target.value)} placeholder="e.g. 186647" style={inp}/></FR>
          </div>
        )}

        {isMachinery && (
          <div>
            <div style={secLabel}>Current Hours</div>
            <FR label="Hours"><input type="number" step="0.1" value={form.current_hours} onChange={e=>set('current_hours',e.target.value)} placeholder="e.g. 967.1" style={inp}/></FR>
          </div>
        )}

        {isMachinery && (
          <div>
            <div style={secLabel}>Oil Change</div>
            <FR label="Last done (hrs)"><input type="number" step="0.1" value={form.last_oil_change_hours} onChange={e=>set('last_oil_change_hours',e.target.value)} placeholder="e.g. 926" style={inp}/></FR>
            <FR label="Interval (hrs)"><input type="number" value={form.oil_change_interval} onChange={e=>set('oil_change_interval',e.target.value)} style={inp}/></FR>
          </div>
        )}

        {isMachinery && (
          <div>
            <div style={secLabel}>Oil Filter</div>
            <FR label="Last done (hrs)"><input type="number" step="0.1" value={form.last_oil_filter_hours} onChange={e=>set('last_oil_filter_hours',e.target.value)} placeholder="e.g. 926" style={inp}/></FR>
            <FR label="Interval (hrs)"><input type="number" value={form.oil_filter_interval} onChange={e=>set('oil_filter_interval',e.target.value)} style={inp}/></FR>
          </div>
        )}

        {isMachinery && (
          <div>
            <div style={secLabel}>Fuel Filter</div>
            <FR label="Last done (hrs)"><input type="number" step="0.1" value={form.last_fuel_filter_hours} onChange={e=>set('last_fuel_filter_hours',e.target.value)} placeholder="optional" style={inp}/></FR>
            <FR label="Interval (hrs)"><input type="number" value={form.fuel_filter_interval} onChange={e=>set('fuel_filter_interval',e.target.value)} placeholder="e.g. 400" style={inp}/></FR>
          </div>
        )}

        {isMachinery && (
          <div>
            <div style={secLabel}>Parts Reference</div>
            <FR label="Oil Type"><input value={form.oil_type} onChange={e=>set('oil_type',e.target.value)} placeholder="e.g. 10W 30" style={inp}/></FR>
            <FR label="Oil Filter #"><input value={form.oil_filter_part} onChange={e=>set('oil_filter_part',e.target.value)} placeholder="e.g. Z418 (Ryco)" style={inp}/></FR>
            <FR label="Air Filter #"><input value={form.air_filter_part} onChange={e=>set('air_filter_part',e.target.value)} style={inp}/></FR>
            <FR label="Fuel Filter #"><input value={form.fuel_filter_part} onChange={e=>set('fuel_filter_part',e.target.value)} style={inp}/></FR>
            <FR label="Pre Cleaner #"><input value={form.pre_cleaner_part} onChange={e=>set('pre_cleaner_part',e.target.value)} style={inp}/></FR>
          </div>
        )}

      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function FR({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: '0.78rem', color: '#5a6a5a', width: 96, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

// ── group of assets ───────────────────────────────────────────────────────────

function AssetGroup({ title, assets, editingId, setEditingId, expandedId, setExpandedId, refetch }) {
  if (!assets.length) return null;
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: '#2d6a2d', marginBottom: '0.5rem',
        paddingBottom: 6, borderBottom: '2px solid #d4e8d4' }}>
        {title} ({assets.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {assets.map(v => {
          const expanded = expandedId === v.id;
          const editing  = editingId  === v.id;
          return (
            <div key={v.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', cursor: 'pointer',
                background: expanded ? '#f5faf5' : '#fff' }}
                onClick={() => { setExpandedId(x => x === v.id ? null : v.id); if (editing) setEditingId(null); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.name}</span>
                    {v.asset_type !== 'machinery' && (
                      <span style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>{v.device_id}</span>
                    )}
                    {v.driver_name && <span style={{ marginLeft: 6, fontSize: '0.78rem', color: '#888' }}>· {v.driver_name}</span>}
                    {v.notes && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#c47a00', fontStyle: 'italic' }}>{v.notes}</span>}
                  </div>
                  <SummaryBadges v={v} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <button className="btn btn-secondary" style={{ padding: '0.18rem 0.55rem', fontSize: '0.76rem' }}
                    onClick={e => { e.stopPropagation(); setEditingId(x => x === v.id ? null : v.id); setExpandedId(v.id); }}>
                    {editing ? 'Cancel' : 'Edit'}
                  </button>
                  <span style={{ color: '#bbb' }}>{expanded ? '▲' : '▼'}</span>
                </div>
              </div>
              {expanded && (
                <div style={{ borderTop: '1px solid #e8f0e8', padding: '0.75rem 1rem' }}>
                  {editing
                    ? <EditPanel v={v} onSaved={() => { setEditingId(null); refetch(); }} onCancel={() => setEditingId(null)} />
                    : <MaintenanceDetail v={v} />
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── fleet maintenance tab ─────────────────────────────────────────────────────

function FleetMaintenance() {
  const { data, loading, refetch } = useApi('/api/vehicles/maintenance');
  const [editingId,  setEditingId]  = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  if (loading) return <div className="state-loading">Loading…</div>;
  if (!data?.length) return <div className="state-empty">No assets found.</div>;

  const vehicles  = data.filter(v => v.asset_type === 'vehicle');
  const trailers  = data.filter(v => v.asset_type === 'trailer');
  const machinery = data.filter(v => v.asset_type === 'machinery');
  const props = { editingId, setEditingId, expandedId, setExpandedId, refetch };

  return (
    <>
      <AssetGroup title="Vehicles"  assets={vehicles}  {...props} />
      <AssetGroup title="Trailers"  assets={trailers}  {...props} />
      <AssetGroup title="Machinery" assets={machinery} {...props} />
    </>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function VehiclesPage() {
  const { data, loading, refetch } = useApi('/api/vehicles');
  const [tab,      setTab]      = useState('vehicles');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ name: '', device_id: '', driver_name: '', asset_type: 'vehicle' });
  const [saving,   setSaving]   = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setForm({ name: '', device_id: '', driver_name: '', asset_type: 'vehicle' });
      setShowForm(false);
      refetch();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(v) {
    await fetch(`/api/vehicles/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !v.active }),
    });
    refetch();
  }

  const TYPE_LABEL = { vehicle: 'Vehicle', trailer: 'Trailer', machinery: 'Machinery' };
  const needsReg = form.asset_type !== 'machinery';

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Fleet</h1>
        {tab === 'vehicles' && (
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cancel' : '+ Add Asset'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', borderBottom: '2px solid #e8f0e8' }}>
        {[['vehicles','Assets'],['maintenance','Maintenance'],['events','Tracker Events']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.45rem 1rem', border: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid #2d6a2d' : '2px solid transparent',
            background: 'none', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#2d6a2d' : '#666', fontSize: '0.9rem', marginBottom: -2,
            whiteSpace: 'nowrap',
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'vehicles' && (
        <>
          {showForm && (
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={lbl}>
                  Type
                  <select value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))} style={{ ...inputStyle, width: 130 }}>
                    <option value="vehicle">Vehicle</option>
                    <option value="trailer">Trailer</option>
                    <option value="machinery">Machinery</option>
                  </select>
                </label>
                <label style={lbl}>
                  Name *
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Hilux" style={inputStyle} />
                </label>
                {needsReg && (
                  <label style={lbl}>
                    Registration *
                    <input required={needsReg} value={form.device_id} onChange={e => setForm(f => ({ ...f, device_id: e.target.value }))}
                      placeholder="e.g. ABC123" style={inputStyle} />
                  </label>
                )}
                {form.asset_type === 'vehicle' && (
                  <label style={lbl}>
                    Driver
                    <input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))}
                      placeholder="Optional" style={inputStyle} />
                  </label>
                )}
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </form>
            </div>
          )}

          <div className="card">
            {loading && <div className="state-loading">Loading…</div>}
            {!loading && !data?.length && <div className="state-empty">No assets added yet.</div>}
            {data?.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Type</th><th>Reg / ID</th><th>Driver</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {data.map(v => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 500 }}>{v.name}{v.notes && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#c47a00', fontStyle: 'italic' }}>{v.notes}</span>}</td>
                        <td><span className="badge" style={{ background: '#e8f5e8', color: '#2d6a2d' }}>{TYPE_LABEL[v.asset_type]}</span></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.83rem' }}>{v.device_id}</td>
                        <td>{v.driver_name ?? '—'}</td>
                        <td><span className="badge" style={v.active ? { background: '#d4edda', color: '#155724' } : { background: '#e2e3e5', color: '#495057' }}>
                          {v.active ? 'Active' : 'Inactive'}</span></td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '0.22rem 0.6rem', fontSize: '0.78rem' }}
                            onClick={() => toggleActive(v)}>
                            {v.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'maintenance' && <FleetMaintenance />}
      {tab === 'events'      && <TrackerEvents />}
    </div>
  );
}

// ── Tracker Events ────────────────────────────────────────────────────────────

function TrackerEvents() {
  const { data, loading, refetch } = useApi(`${BACKEND}/api/events?limit=100`);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#11420A', fontSize: '0.95rem' }}>Arrival &amp; Departure Events</div>
          <div style={{ fontSize: '0.8rem', color: '#5a6a5a', marginTop: 2 }}>
            Logged automatically when vehicles enter or leave orchard geofences
          </div>
        </div>
        <button className="btn btn-secondary" onClick={refetch}>↻ Refresh</button>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        {loading && <div style={{ color: '#888', padding: '1rem', textAlign: 'center' }}>Loading…</div>}
        {!loading && !data?.length && (
          <div style={{ color: '#aaa', padding: '1.5rem', textAlign: 'center', fontSize: '0.88rem' }}>
            No events recorded yet — events will appear here once GPS trackers are installed in vehicles.
          </div>
        )}
        {data?.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Grower / Orchard</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Notified</th>
                </tr>
              </thead>
              <tbody>
                {data.map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#5a6a5a', fontSize: '0.82rem' }}>
                      {format(new Date(e.occurred_at), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td>
                      <span style={{
                        borderRadius: 5, padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600,
                        background: e.event_type === 'arrival' ? '#d4edda' : '#f8d7da',
                        color: e.event_type === 'arrival' ? '#155724' : '#721c24',
                      }}>
                        {e.event_type === 'arrival' ? '▶ Arrived' : '◀ Departed'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{e.grower_name}</td>
                    <td>{e.vehicle_name}</td>
                    <td>{e.driver_name ?? '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {e.notified_sms   && <span style={{ background: '#cce5ff', color: '#004085', borderRadius: 4, padding: '1px 6px', marginRight: 3 }}>SMS</span>}
                      {e.notified_email && <span style={{ background: '#d4edda', color: '#155724', borderRadius: 4, padding: '1px 6px' }}>Email</span>}
                      {!e.notified_sms && !e.notified_email && <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { padding: '0.4rem 0.7rem', borderRadius: 7, border: '1px solid #d4e0d4', fontSize: '0.88rem', width: 170 };
const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem', fontWeight: 600 };
const inp = { padding: '0.28rem 0.5rem', borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.83rem', width: '100%' };
const secLabel = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2d6a2d', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #d4e0d4' };
