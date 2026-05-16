import { useState, Fragment } from 'react';
import { useApi } from '../hooks/useApi.js';

const TH = { padding: '0.55rem 0.75rem', fontWeight: 700, color: '#11420A', fontSize: '0.8rem', textAlign: 'left', whiteSpace: 'nowrap' };
const TD = { padding: '0.5rem 0.75rem', verticalAlign: 'middle', fontSize: '0.85rem' };

function Field({ label, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, ...style }}>
      <label style={{ fontSize: '0.73rem', color: '#5a6a5a', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

const INPUT = { padding: '0.38rem 0.55rem', borderRadius: 6, border: '1px solid #d4e0d4', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' };

export default function GrowersPage() {
  const { data, loading, refetch } = useApi('/api/growers');
  const [search, setSearch]   = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const filtered = data?.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.address?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/growers/sync', { method: 'POST' });
      const result = await res.json();
      alert(`Sync complete: ${result.upserted} growers updated, ${result.geocoded} geocoded.`);
      refetch();
    } catch {
      alert('Sync failed — check backend connection.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(g) {
    if (!confirm(`Delete grower "${g.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/growers/${g.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      refetch();
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Growers</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="search" placeholder="Search growers…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: 7, border: '1px solid #d4e0d4',
              fontSize: '0.88rem', width: 200 }} />
          <button className="btn" onClick={() => { setShowAdd(v => !v); setEditingId(null); }} style={{ fontSize: '0.85rem' }}>
            {showAdd ? 'Cancel' : '+ Add Grower'}
          </button>
          <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : '↑ Sync from Sheets'}
          </button>
        </div>
      </div>

      {/* Add grower form */}
      {showAdd && (
        <GrowerForm onSaved={() => { setShowAdd(false); refetch(); }} />
      )}

      {/* Table */}
      <div className="card">
        {loading && <div className="state-loading">Loading…</div>}
        {!loading && !filtered.length && <div className="state-empty">No growers found.</div>}
        {filtered.length > 0 && (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#f5f9f5', borderBottom: '2px solid #d4e0d4' }}>
                  <th style={TH}>ID</th>
                  <th style={TH}>Name</th>
                  <th style={TH}>Address</th>
                  <th style={TH}>Phone</th>
                  <th style={TH}>Hass</th>
                  <th style={TH}>Reeds</th>
                  <th style={TH}>Spray Free</th>
                  <th style={TH}>Gate Code</th>
                  <th style={TH}>Pin</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g, i) => (
                  <Fragment key={g.id}>
                    <tr style={{ background: i % 2 === 0 ? '#fff' : '#fafcfa',
                      borderBottom: '1px solid #eef2ee' }}>
                      <td style={{ ...TD, color: '#5a6a5a', fontSize: '0.78rem' }}>{g.external_id ?? '—'}</td>
                      <td style={{ ...TD, fontWeight: 500 }}>
                        {g.name}
                        {g.email && (
                          <div style={{ fontSize: '0.75rem', color: '#5a6a5a', fontWeight: 400 }}>{g.email}</div>
                        )}
                      </td>
                      <td style={{ ...TD, color: '#5a6a5a', maxWidth: 200 }}>{g.address}</td>
                      <td style={TD}>{g.phone ?? '—'}</td>
                      <td style={{ ...TD, textAlign: 'center' }}>{g.hass_trees ?? '—'}</td>
                      <td style={{ ...TD, textAlign: 'center' }}>{g.reeds_trees ?? '—'}</td>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        {g.spray_free
                          ? <span style={{ background: '#e8f5e8', color: '#1a5c1a', border: '1px solid #a8d8a8',
                              borderRadius: 10, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                              Spray Free
                            </span>
                          : <span style={{ color: '#bbb', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                        {g.gate_code
                          ? <span style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffc107',
                              borderRadius: 6, padding: '1px 7px', fontSize: '0.78rem' }}>
                              {g.gate_code}
                            </span>
                          : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        {g.lat
                          ? <span style={{ color: '#11420A', fontSize: '0.85rem' }}>✓</span>
                          : <span style={{ color: '#aaa', fontSize: '0.75rem' }}>pending</span>}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => { setEditingId(editingId === g.id ? null : g.id); setShowAdd(false); }}
                          style={{ background: 'none', border: '1px solid #d4e0d4', color: '#11420A',
                            padding: '3px 9px', borderRadius: 5, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                          {editingId === g.id ? 'Close' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDelete(g)}
                          style={{ background: 'none', border: 'none', color: '#c0392b',
                            padding: '3px 6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, marginLeft: 4 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                    {editingId === g.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0, background: '#f5f9f5' }}>
                          <GrowerForm
                            grower={g}
                            onSaved={() => { setEditingId(null); refetch(); }}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && (
        <p style={{ color: '#5a6a5a', fontSize: '0.82rem', marginTop: '0.5rem' }}>
          {data.length} growers · {data.filter(g => g.spray_free).length} spray free
        </p>
      )}
    </div>
  );
}

function GrowerForm({ grower, onSaved, onCancel }) {
  const isEdit = !!grower;
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [form, setForm] = useState({
    name:    grower?.name    ?? '',
    address: grower?.address ?? '',
    billing_address: grower?.billing_address ?? '',
    phone:   grower?.phone   ?? '',
    email:   grower?.email   ?? '',
    hass_trees:  grower?.hass_trees  ?? '',
    reeds_trees: grower?.reeds_trees ?? '',
    spray_free:  grower?.spray_free  ?? false,
    gate_code:   grower?.gate_code   ?? '',
    bank_account_name:   grower?.bank_account_name   ?? '',
    bank_account_number: grower?.bank_account_number ?? '',
    gst_number:          grower?.gst_number          ?? '',
  });

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) return;
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        hass_trees:  form.hass_trees  === '' ? null : parseInt(form.hass_trees),
        reeds_trees: form.reeds_trees === '' ? null : parseInt(form.reeds_trees),
        phone:       form.phone.trim()  || null,
        email:       form.email.trim()  || null,
        gate_code:   form.gate_code.trim() || null,
        bank_account_name:   form.bank_account_name.trim()   || null,
        bank_account_number: form.bank_account_number.trim() || null,
        gst_number:          form.gst_number.trim()          || null,
        billing_address:     form.billing_address.trim()     || null,
      };
      const res = await fetch(
        isEdit ? `/api/growers/${grower.id}` : '/api/growers',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onSaved();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div className="card" style={{ padding: '1.1rem', marginBottom: isEdit ? 0 : '1rem',
      background: '#f5f9f5', borderRadius: isEdit ? 0 : 10 }}>
      <div style={{ fontWeight: 700, color: '#11420A', fontSize: '0.9rem', marginBottom: '0.85rem' }}>
        {isEdit ? `Edit ${grower.name}` : 'Add New Grower'}
      </div>
      <form onSubmit={handleSubmit}>

        {/* Row 1: Name + Orchard Address */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          <Field label="Grower Name *" style={{ flex: '2 1 200px' }}>
            <input style={INPUT} type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Hugh Clark" required />
          </Field>
          <Field label="Orchard Address *" style={{ flex: '3 1 260px' }}>
            <input style={INPUT} type="text" value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="e.g. 313A Pahoia Road" required />
          </Field>
        </div>

        {/* Optional separate billing address */}
        <div style={{ marginBottom: '0.6rem' }}>
          <Field label="Billing Address (leave blank if same as orchard address)">
            <input style={INPUT} type="text" value={form.billing_address}
              onChange={e => set('billing_address', e.target.value)}
              placeholder="e.g. 25 Queen St, Auckland — for AvoGrade invoicing" />
          </Field>
        </div>

        {/* Row 2: Contact */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          <Field label="Phone" style={{ flex: '1 1 140px' }}>
            <input style={INPUT} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="027 000 0000" />
          </Field>
          <Field label="Email" style={{ flex: '2 1 200px' }}>
            <input style={INPUT} type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="grower@example.com" />
          </Field>
        </div>

        {/* Row 3: Orchard details */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem', alignItems: 'flex-end' }}>
          <Field label="Hass Trees" style={{ flex: '1 1 90px' }}>
            <input style={INPUT} type="number" min={0} value={form.hass_trees}
              onChange={e => set('hass_trees', e.target.value)} placeholder="—" />
          </Field>
          <Field label="Reed Trees" style={{ flex: '1 1 90px' }}>
            <input style={INPUT} type="number" min={0} value={form.reeds_trees}
              onChange={e => set('reeds_trees', e.target.value)} placeholder="—" />
          </Field>
          <Field label="Gate Code" style={{ flex: '1 1 110px' }}>
            <input style={INPUT} type="text" value={form.gate_code}
              onChange={e => set('gate_code', e.target.value)} placeholder="e.g. 1234#" />
          </Field>
          <div style={{ flex: '0 0 auto', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
            <input type="checkbox" id={`spray_free_${grower?.id ?? 'new'}`} checked={form.spray_free}
              onChange={e => set('spray_free', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#11420A', cursor: 'pointer' }} />
            <label htmlFor={`spray_free_${grower?.id ?? 'new'}`} style={{ fontSize: '0.85rem', color: '#11420A', fontWeight: 600, cursor: 'pointer' }}>
              Spray Free
            </label>
          </div>
        </div>

        {/* Row 4: Bank details (AvoGrade) */}
        <div style={{ borderTop: '1px solid #d4e0d4', paddingTop: '0.65rem', marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#5a6a5a', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Payment Details (AvoGrade)
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Field label="Account Name" style={{ flex: '2 1 180px' }}>
              <input style={INPUT} type="text" value={form.bank_account_name}
                onChange={e => set('bank_account_name', e.target.value)}
                placeholder="e.g. H Clark Trust" />
            </Field>
            <Field label="Account Number" style={{ flex: '1 1 160px' }}>
              <input style={INPUT} type="text" value={form.bank_account_number}
                onChange={e => set('bank_account_number', e.target.value)}
                placeholder="XX-XXXX-XXXXXXX-XX" />
            </Field>
            <Field label="GST Number (leave blank if not registered)" style={{ flex: '1 1 160px' }}>
              <input style={INPUT} type="text" value={form.gst_number}
                onChange={e => set('gst_number', e.target.value)}
                placeholder="e.g. 123-456-789" />
            </Field>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-primary" type="submit" disabled={saving || !form.name.trim() || !form.address.trim()}>
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Grower')}
          </button>
          {isEdit && onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          )}
          {error && <span style={{ fontSize: '0.82rem', color: '#c0392b' }}>{error}</span>}
        </div>
      </form>
    </div>
  );
}
