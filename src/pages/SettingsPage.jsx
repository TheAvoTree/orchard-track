import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../hooks/useSettings.js';
import { useApi } from '../hooks/useApi.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

export default function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const [radius, setRadius] = useState(200);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  // Email notification settings
  const [emailEnabled,         setEmailEnabled]         = useState(true);
  const [notifyArrived,        setNotifyArrived]        = useState(true);
  const [notifyDeparted,       setNotifyDeparted]       = useState(false);
  const [fromName,             setFromName]             = useState('The Avo Tree');
  const [maintenanceAlertEmail, setMaintenanceAlertEmail] = useState('');
  const [emailSaving,          setEmailSaving]          = useState(false);
  const [emailSaved,           setEmailSaved]           = useState(false);
  const [testSending,          setTestSending]          = useState(false);
  const [testResult,           setTestResult]           = useState(null);

  const { data: locations, refetch: refetchLocations } = useApi('/api/locations');
  const { data: growers } = useApi('/api/growers');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);

  // Dry matter settings
  const [dmRate,    setDmRate]    = useState('0.071');
  const [dmMin,     setDmMin]     = useState('24');
  const [dmSaving,  setDmSaving]  = useState(false);
  const [dmSaved,   setDmSaved]   = useState(false);

  const boundaryCount = growers?.filter(g => g.boundary).length ?? 0;
  const totalGeocoded = growers?.filter(g => g.lat).length ?? 0;

  async function handleBackfillBoundaries() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch('/api/growers/backfill-boundaries', { method: 'POST' });
      const data = await res.json();
      setBackfillResult(data);
    } catch {
      setBackfillResult({ error: 'Failed' });
    }
    setBackfilling(false);
  }
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locType, setLocType] = useState('base');
  const [addingLoc, setAddingLoc] = useState(false);
  const [deletingLoc, setDeletingLoc] = useState(null);

  useEffect(() => {
    if (!settings) return;
    if (settings.geofence_radius_metres)    setRadius(Number(settings.geofence_radius_metres));
    if (settings.email_notifications_enabled !== undefined) setEmailEnabled(settings.email_notifications_enabled !== 'false');
    if (settings.notify_on_arrived  !== undefined) setNotifyArrived(settings.notify_on_arrived   !== 'false');
    if (settings.notify_on_departed !== undefined) setNotifyDeparted(settings.notify_on_departed !== 'false');
    if (settings.notify_from_name)  setFromName(settings.notify_from_name);
    if (settings.maintenance_alert_email !== undefined) setMaintenanceAlertEmail(settings.maintenance_alert_email);
    if (settings.dm_rate_per_day !== undefined) setDmRate(settings.dm_rate_per_day);
    if (settings.dm_minimum      !== undefined) setDmMin(settings.dm_minimum);
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const ok = await saveSettings({ geofence_radius_metres: radius });
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else alert('Failed to save settings.');
    setSaving(false);
  }

  async function handleEmailSave() {
    setEmailSaving(true); setEmailSaved(false);
    const ok = await saveSettings({
      email_notifications_enabled: String(emailEnabled),
      notify_on_arrived:           String(notifyArrived),
      notify_on_departed:          String(notifyDeparted),
      notify_from_name:            fromName,
      maintenance_alert_email:     maintenanceAlertEmail,
    });
    if (ok) { setEmailSaved(true); setTimeout(() => setEmailSaved(false), 3000); }
    else alert('Failed to save email settings.');
    setEmailSaving(false);
  }

  async function handleDmSave() {
    setDmSaving(true); setDmSaved(false);
    const rate = parseFloat(dmRate);
    const min  = parseFloat(dmMin);
    if (isNaN(rate) || rate <= 0 || isNaN(min) || min <= 0) {
      alert('Please enter valid positive numbers for both DM fields.');
      setDmSaving(false); return;
    }
    const ok = await saveSettings({
      dm_rate_per_day: String(rate),
      dm_minimum:      String(min),
    });
    if (ok) { setDmSaved(true); setTimeout(() => setDmSaved(false), 3000); }
    else alert('Failed to save dry matter settings.');
    setDmSaving(false);
  }

  async function handleTestEmail() {
    setTestSending(true); setTestResult(null);
    try {
      const res = await fetch('/api/notifications/test-email', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (e) { setTestResult({ error: e.message }); }
    setTestSending(false);
  }

  async function handleAddLocation(e) {
    e.preventDefault();
    if (!locName.trim() || !locAddress.trim()) return;
    setAddingLoc(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: locName.trim(), address: locAddress.trim(), type: locType }),
      });
      if (res.ok) {
        setLocName('');
        setLocAddress('');
        setLocType('base');
        refetchLocations();
      } else {
        alert('Failed to add location.');
      }
    } catch {
      alert('Failed to add location.');
    }
    setAddingLoc(false);
  }

  async function handleDeleteLocation(id) {
    setDeletingLoc(id);
    try {
      await fetch(`/api/locations/${id}`, { method: 'DELETE' });
      refetchLocations();
    } catch {
      alert('Failed to delete location.');
    }
    setDeletingLoc(null);
  }

  const currentRadius = Number(settings?.geofence_radius_metres) || 200;

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      {/* Two-column grid on wide screens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: '1rem', alignItems: 'start' }}>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d6a2d', marginTop: 0 }}>
          Geofence Radius
        </h2>
        <p style={{ color: '#5a6a5a', fontSize: '0.88rem', marginTop: 0 }}>
          Distance from each orchard pin that triggers an arrival or departure notification.
          Reduce this if neighbouring orchards are overlapping.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#2d6a2d' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="number"
              min={50}
              max={500}
              step={10}
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              style={{ width: 70, padding: '0.35rem 0.5rem', borderRadius: 6,
                border: '1px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }}
            />
            <span style={{ color: '#5a6a5a', fontSize: '0.88rem' }}>metres</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span style={{ color: '#2d6a2d', fontSize: '0.88rem', fontWeight: 600 }}>✓ Saved — map updated</span>}
        </div>

        <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem',
          background: '#e8f5e8', borderRadius: 8, fontSize: '0.85rem', color: '#2d6a2d' }}>
          <strong>Active radius:</strong> {currentRadius}m
          {radius !== currentRadius && <span style={{ color: '#f0a500' }}> → pending: {radius}m (unsaved)</span>}
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d6a2d', marginTop: 0 }}>
          Special Locations
        </h2>
        <p style={{ color: '#5a6a5a', fontSize: '0.88rem', marginTop: 0 }}>
          Packhouses, depots, and other fixed sites shown on the map with a red HQ marker.
        </p>

        {/* Existing locations list */}
        {locations?.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {locations.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 6,
                background: '#f5f9f5', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                <div>
                  <strong>{l.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#5a6a5a',
                    background: '#d4e0d4', borderRadius: 4, padding: '0 6px' }}>{l.type}</span>
                  <div style={{ color: '#5a6a5a', fontSize: '0.82rem', marginTop: 2 }}>{l.address}</div>
                  {!l.lat && <div style={{ color: '#f0a500', fontSize: '0.78rem' }}>Geocoding pending</div>}
                </div>
                <button
                  onClick={() => handleDeleteLocation(l.id)}
                  disabled={deletingLoc === l.id}
                  style={{ background: 'none', border: 'none', color: '#c0392b',
                    cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.25rem' }}
                  title="Remove location"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new location form */}
        <form onSubmit={handleAddLocation}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Name (e.g. Te Puna Packhouse)"
              value={locName}
              onChange={e => setLocName(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', borderRadius: 6,
                border: '1px solid #d4e0d4', fontSize: '0.9rem' }}
            />
            <input
              type="text"
              placeholder="Address (e.g. 89 Te Puna Road, Te Puna)"
              value={locAddress}
              onChange={e => setLocAddress(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', borderRadius: 6,
                border: '1px solid #d4e0d4', fontSize: '0.9rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={locType}
                onChange={e => setLocType(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: 6,
                  border: '1px solid #d4e0d4', fontSize: '0.9rem', flex: 1 }}
              >
                <option value="base">Base / Packhouse</option>
                <option value="depot">Depot</option>
                <option value="other">Other</option>
              </select>
              <button className="btn btn-primary" type="submit" disabled={addingLoc || !locName.trim() || !locAddress.trim()}>
                {addingLoc ? 'Adding…' : 'Add Location'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d6a2d', marginTop: 0 }}>
          Property Boundary Geofencing
        </h2>
        <p style={{ color: '#5a6a5a', fontSize: '0.88rem', marginTop: 0 }}>
          Fetches actual cadastral parcel outlines from LINZ (Land Information New Zealand)
          so geofence detection uses real property boundaries instead of circles.
          Requires a free <strong>LINZ_API_KEY</strong> in the backend .env.
        </p>

        <div style={{ padding: '0.6rem 0.9rem', background: '#e8f5e8', borderRadius: 6,
          fontSize: '0.85rem', color: '#2d6a2d', marginBottom: '1rem' }}>
          <strong>{boundaryCount}</strong> of <strong>{totalGeocoded}</strong> orchards have property boundaries
          {totalGeocoded > 0 && boundaryCount < totalGeocoded && (
            <span style={{ color: '#f0a500' }}> — {totalGeocoded - boundaryCount} still using radius circles</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleBackfillBoundaries}
            disabled={backfilling || !totalGeocoded}
          >
            {backfilling ? 'Fetching boundaries…' : 'Fetch Missing Boundaries'}
          </button>
          {backfillResult && !backfillResult.error && (
            <span style={{ fontSize: '0.85rem', color: '#2d6a2d', fontWeight: 600 }}>
              ✓ Updated {backfillResult.updated} of {backfillResult.total}
            </span>
          )}
          {backfillResult?.error && (
            <span style={{ fontSize: '0.85rem', color: '#c0392b' }}>Failed — check LINZ_API_KEY</span>
          )}
        </div>
        <p style={{ color: '#5a6a5a', fontSize: '0.82rem', marginBottom: 0, marginTop: '0.75rem' }}>
          This runs once against the LINZ API for each orchard without a boundary. Takes ~1 minute for 320 orchards.
          Orchards without a match automatically fall back to the radius circle above.
        </p>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d6a2d', marginTop: 0 }}>
          Orchard Pin Positions
        </h2>
        <p style={{ color: '#5a6a5a', fontSize: '0.88rem', margin: 0 }}>
          To adjust individual orchard pin positions, go to the <strong>Live Map</strong> tab,
          click <strong>Edit Pins</strong>, then drag any pin to the correct location.
          Neighbour address numbers are shown in edit mode to help with placement.
        </p>
      </div>

      {/* Dry Matter Calculator */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d6a2d', marginTop: 0 }}>
          🥑 Dry Matter Calculator
        </h2>
        <p style={{ color: '#5a6a5a', fontSize: '0.88rem', marginTop: 0 }}>
          Used in the Picking Plan to calculate when each grower's fruit will reach
          the minimum dry matter required for harvest. The safe-to-pick date is
          calculated as: <em>collection date + (minimum − current DM) ÷ daily increase</em>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#3a4a3a',
              display: 'block', marginBottom: 4 }}>
              Daily DM increase (% per day)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" step="0.001" min="0.01" max="1"
                value={dmRate}
                onChange={e => setDmRate(e.target.value)}
                style={{ width: 90, padding: '0.38rem 0.5rem', borderRadius: 6,
                  border: '1px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.82rem', color: '#5a6a5a' }}>% / day</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#8a9e8c', marginTop: 3 }}>
              Default 0.071 for Hass. Adjust if your orchards show a different rate.
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#3a4a3a',
              display: 'block', marginBottom: 4 }}>
              Minimum DM to pick (%)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" step="0.1" min="10" max="40"
                value={dmMin}
                onChange={e => setDmMin(e.target.value)}
                style={{ width: 90, padding: '0.38rem 0.5rem', borderRadius: 6,
                  border: '1px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.82rem', color: '#5a6a5a' }}>%</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#8a9e8c', marginTop: 3 }}>
              Default 24% for Hass. Gem and Reed may differ.
            </div>
          </div>

          {/* Preview */}
          {(() => {
            const rate = parseFloat(dmRate);
            const min  = parseFloat(dmMin);
            if (!isNaN(rate) && rate > 0 && !isNaN(min) && min > 0) {
              const exampleDm = min - 2;
              const days = Math.ceil(2 / rate);
              return (
                <div style={{ padding: '0.6rem 0.9rem', background: '#f0f7f0', borderRadius: 6,
                  fontSize: '0.82rem', color: '#2d6a2d' }}>
                  <strong>Example:</strong> Fruit at {exampleDm.toFixed(1)}% DM today →
                  ready in <strong>{days} days</strong> ({(min - exampleDm).toFixed(1)}% needed at {rate}/day)
                </div>
              );
            }
            return null;
          })()}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1.25rem' }}>
          <button className="btn btn-primary" onClick={handleDmSave} disabled={dmSaving}>
            {dmSaving ? 'Saving…' : 'Save'}
          </button>
          {dmSaved && <span style={{ color: '#2d6a2d', fontSize: '0.88rem', fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </div>

      {/* Push Notifications */}
      <PushNotificationCard />

      {/* Email Notifications */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d6a2d', marginTop: 0 }}>
          Email Notifications
        </h2>
        <p style={{ color: '#5a6a5a', fontSize: '0.88rem', marginTop: 0 }}>
          Automatically email growers when a picking vehicle arrives at or departs from their orchard.
          Requires a <strong>RESEND_API_KEY</strong> in the backend .env file.
        </p>

        {/* API key status */}
        <div style={{ padding: '0.6rem 0.9rem', borderRadius: 6, fontSize: '0.83rem',
          marginBottom: '1.1rem',
          background: settings?.resend_configured === 'true' ? '#e8f5e8' : '#fff3cd',
          color: settings?.resend_configured === 'true' ? '#1a5c1a' : '#856404' }}>
          {settings?.resend_configured === 'true'
            ? '✓ Resend API key configured — emails will send'
            : '⚠ No RESEND_API_KEY found — add it to backend/.env to enable sending'}
        </div>

        {/* Master toggle */}
        <Toggle label="Email notifications enabled" checked={emailEnabled} onChange={setEmailEnabled} />

        <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem',
          opacity: emailEnabled ? 1 : 0.45, pointerEvents: emailEnabled ? 'auto' : 'none',
          display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Toggle label="Notify grower on arrival" checked={notifyArrived}  onChange={setNotifyArrived} />
          <Toggle label="Notify grower on departure" checked={notifyDeparted} onChange={setNotifyDeparted} />
        </div>

        {/* From name */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5a6a5a',
            display: 'block', marginBottom: 4 }}>Sender name</label>
          <input type="text" value={fromName} onChange={e => setFromName(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #d4e0d4',
              fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }}
            placeholder="The Avo Tree" />
          <div style={{ fontSize: '0.75rem', color: '#8a9e8c', marginTop: 3 }}>
            Appears as the sender name in growers' inboxes. The from address is set by NOTIFY_FROM_EMAIL in .env.
          </div>
        </div>

        {/* Maintenance alert email */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5a6a5a',
            display: 'block', marginBottom: 4 }}>Fleet maintenance alert email</label>
          <input type="email" value={maintenanceAlertEmail}
            onChange={e => setMaintenanceAlertEmail(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #d4e0d4',
              fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }}
            placeholder="e.g. sam@theavotree.co.nz" />
          <div style={{ fontSize: '0.75rem', color: '#8a9e8c', marginTop: 3 }}>
            Receives daily alerts when rego/WOF expiry is within 30 days or RUC/service is within 1,000 km.
            Leave blank to disable fleet alerts.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleEmailSave} disabled={emailSaving}>
            {emailSaving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn" onClick={handleTestEmail} disabled={testSending}>
            {testSending ? 'Sending…' : 'Send Test Email'}
          </button>
          {emailSaved && <span style={{ color: '#2d6a2d', fontSize: '0.88rem', fontWeight: 600 }}>✓ Saved</span>}
          {testResult?.sent  && <span style={{ color: '#2d6a2d', fontSize: '0.85rem' }}>✓ Test sent to {testResult.to}</span>}
          {testResult?.error && <span style={{ color: '#c0392b', fontSize: '0.85rem' }}>{testResult.error}</span>}
          {testResult?.skipped && <span style={{ color: '#856404', fontSize: '0.85rem' }}>Skipped: {testResult.skipped}</span>}
        </div>
      </div>

      </div>{/* end two-column grid */}
    </div>
  );
}

// ── Picking Log Workers card ──────────────────────────────────────────────────

function WorkersCard() {
  const { data: workers, refetch } = useApi(`${BACKEND}/api/picking-logs/workers`);
  const [form, setForm] = useState({ name: '', pin: '', role: 'picker' });
  const [editId, setEditId] = useState(null);
  const [editPin, setEditPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function createWorker(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.pin.trim()) { setError('Name and PIN are required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${BACKEND}/api/picking-logs/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create worker.'); return; }
      setForm({ name: '', pin: '', role: 'picker' });
      refetch();
    } catch { setError('Server error — try again.'); }
    finally { setSaving(false); }
  }

  async function savePin(w) {
    if (!editPin.trim()) return;
    await fetch(`${BACKEND}/api/picking-logs/workers/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: editPin.trim() }),
    });
    setEditId(null); setEditPin('');
    refetch();
  }

  async function toggleActive(w) {
    await fetch(`${BACKEND}/api/picking-logs/workers/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !w.active }),
    });
    refetch();
  }

  async function changeRole(w, role) {
    await fetch(`${BACKEND}/api/picking-logs/workers/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    refetch();
  }

  async function deleteWorker(w) {
    if (!confirm(`Delete ${w.name}? This will permanently remove all their picking logs.`)) return;
    await fetch(`${BACKEND}/api/picking-logs/workers/${w.id}`, { method: 'DELETE' });
    refetch();
  }

  return (
    <div className="card" style={{ padding: '1.5rem', maxWidth: 500, marginTop: '1rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d6a2d', marginTop: 0 }}>
        Picking Log — Workers
      </h2>
      <p style={{ color: '#5a6a5a', fontSize: '0.88rem', marginTop: 0 }}>
        Add pickers here so they can sign into the Picking Log tab with their name and PIN.
        Set role to <strong>Admin</strong> to allow viewing all workers' logs and managing this list.
      </p>

      {/* Existing workers */}
      {workers?.length > 0 && (
        <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {workers.map(w => (
            <div key={w.id} style={{
              padding: '0.6rem 0.85rem', borderRadius: 8,
              background: w.active ? '#f7fbf7' : '#fafafa',
              border: `1.5px solid ${w.active ? '#d4e0d4' : '#e8e8e8'}`,
              display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
            }}>
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: w.active ? '#2d6a1f' : '#bbb',
                color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem',
              }}>
                {w.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>

              {/* Name + role */}
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 600, color: '#11420A', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {w.name}
                  {!w.active && <span style={{ fontSize: '0.72rem', color: '#999', fontWeight: 400 }}>(inactive)</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <select value={w.role} onChange={e => changeRole(w, e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 4,
                      border: '1px solid #d4e0d4', background: '#fff', color: '#3a4a3a',
                      cursor: 'pointer' }}>
                    <option value="picker">Picker</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* PIN reset inline */}
              {editId === w.id ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="text" inputMode="numeric" maxLength={8}
                    value={editPin} onChange={e => setEditPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="New PIN"
                    autoFocus
                    style={{ width: 80, padding: '3px 6px', borderRadius: 6,
                      border: '1.5px solid #2d6a1f', fontSize: '0.85rem', textAlign: 'center' }} />
                  <button onClick={() => savePin(w)} className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '3px 10px' }}>Save</button>
                  <button onClick={() => { setEditId(null); setEditPin(''); }}
                    style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
              ) : (
                <button onClick={() => { setEditId(w.id); setEditPin(''); }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '3px 10px', whiteSpace: 'nowrap' }}>
                  Change PIN
                </button>
              )}

              {/* Active toggle */}
              <button onClick={() => toggleActive(w)}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '3px 10px', whiteSpace: 'nowrap',
                  color: w.active ? '#c0392b' : '#2d6a1f' }}>
                {w.active ? 'Deactivate' : 'Activate'}
              </button>

              {/* Delete */}
              <button onClick={() => deleteWorker(w)}
                style={{ background: 'none', border: 'none', color: '#ddd',
                  cursor: 'pointer', fontSize: '1.1rem', padding: '0 2px',
                  transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e74c3c'}
                onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                title="Delete worker">🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* Add worker form */}
      <div style={{ borderTop: workers?.length ? '1px solid #eef2ee' : 'none',
        paddingTop: workers?.length ? '1rem' : 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#3a4a3a', marginBottom: '0.5rem' }}>
          {workers?.length ? 'Add another worker' : 'Add your first worker'}
        </div>
        <form onSubmit={createWorker}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 2, minWidth: 130 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5a6a5a' }}>Full name</label>
              <input type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Joe Bloggs"
                style={{ padding: '0.42rem 0.6rem', borderRadius: 7,
                  border: '1.5px solid #d4e0d4', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 90 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5a6a5a' }}>PIN</label>
              <input type="text" inputMode="numeric" maxLength={8} value={form.pin}
                onChange={e => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))}
                placeholder="e.g. 1234"
                style={{ padding: '0.42rem 0.6rem', borderRadius: 7,
                  border: '1.5px solid #d4e0d4', fontSize: '0.9rem', textAlign: 'center' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 90 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5a6a5a' }}>Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                style={{ padding: '0.42rem 0.6rem', borderRadius: 7,
                  border: '1.5px solid #d4e0d4', fontSize: '0.9rem', background: '#fff' }}>
                <option value="picker">Picker</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}
              style={{ padding: '0.42rem 1rem', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
              {saving ? 'Adding…' : '+ Add'}
            </button>
          </div>
          {error && (
            <div style={{ marginTop: '0.5rem', color: '#c0392b', fontSize: '0.83rem' }}>{error}</div>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Push Notification Card ────────────────────────────────────────────────────

function PushNotificationCard() {
  const [status,     setStatus]     = useState('idle'); // idle | subscribed | denied | unsupported
  const [saving,     setSaving]     = useState(false);
  const [testResult, setTestResult] = useState('');

  // Check current subscription state on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return;
    }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      setStatus(sub ? 'subscribed' : 'idle');
    });
  }, []);

  async function subscribe() {
    setSaving(true); setTestResult('');
    try {
      // Fetch VAPID public key from backend
      const keyRes = await fetch(`${BACKEND}/api/push/vapid-public-key`);
      const { publicKey } = await keyRes.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(`${BACKEND}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), label: navigator.userAgent.slice(0, 60) }),
      });
      setStatus('subscribed');
    } catch (err) {
      if (err.name === 'NotAllowedError') setStatus('denied');
      else setTestResult(`Error: ${err.message}`);
    }
    setSaving(false);
  }

  async function unsubscribe() {
    setSaving(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(`${BACKEND}/api/push/unsubscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setStatus('idle'); setSaving(false);
  }

  async function sendTest() {
    setTestResult('Sending…');
    const res = await fetch(`${BACKEND}/api/push/test`, { method: 'POST' });
    const d = await res.json();
    setTestResult(res.ok ? `✓ Sent to ${d.sent} device${d.sent !== 1 ? 's' : ''}` : `Error: ${d.error}`);
  }

  return (
    <div className="card" style={{ padding: '1.5rem', maxWidth: 500, marginTop: '1rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d6a2d', marginTop: 0 }}>
        📱 Push Notifications
      </h2>
      <p style={{ color: '#5a6a5a', fontSize: '0.88rem', marginTop: 0, marginBottom: '1rem' }}>
        Enable push notifications on this device to receive orchard arrival reminders
        even when the app is not open.
      </p>

      {status === 'unsupported' && (
        <div style={{ color: '#888', fontSize: '0.85rem' }}>
          Push notifications are not supported on this browser.
          On iPhone, install the app first (Safari → Share → Add to Home Screen), then return here.
        </div>
      )}

      {status === 'denied' && (
        <div style={{ color: '#c0392b', fontSize: '0.85rem' }}>
          Permission denied. Go to your browser/phone settings and allow notifications for this site, then try again.
        </div>
      )}

      {status === 'idle' && (
        <button className="btn btn-primary" onClick={subscribe} disabled={saving}>
          {saving ? 'Enabling…' : '🔔 Enable notifications on this device'}
        </button>
      )}

      {status === 'subscribed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            color: '#155724', background: '#d4edda', borderRadius: 8,
            padding: '0.5rem 0.75rem', fontSize: '0.88rem', fontWeight: 600 }}>
            ✓ Notifications enabled on this device
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={sendTest} style={{ fontSize: '0.83rem' }}>
              Send test notification
            </button>
            <button className="btn btn-secondary" onClick={unsubscribe} disabled={saving}
              style={{ fontSize: '0.83rem', color: '#c0392b' }}>
              {saving ? 'Removing…' : 'Disable'}
            </button>
          </div>
          {testResult && <div style={{ fontSize: '0.82rem', color: '#5a6a5a' }}>{testResult}</div>}
        </div>
      )}

      <p style={{ color: '#5a6a5a', fontSize: '0.78rem', marginTop: '0.75rem', marginBottom: 0 }}>
        Enable on each device you want to receive notifications. Notifications are sent when
        your phone detects it's within an orchard geofence (app must be open for location detection).
        Background geofencing requires the installed app version.
      </p>
    </div>
  );
}

// Convert VAPID public key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!checked)}
        style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', flexShrink: 0,
          background: checked ? '#2d6a2d' : '#ccc', transition: 'background 0.2s', cursor: 'pointer' }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      <span style={{ fontSize: '0.88rem', color: '#1c2b1e' }}>{label}</span>
    </label>
  );
}
