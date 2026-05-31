import { useState, useCallback, useEffect, useMemo, useRef, Fragment } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle, Polygon, InfoWindow } from '@react-google-maps/api';
import { io as socketIO } from 'socket.io-client';
import { useLivePositions } from '../hooks/useLivePositions.js';
import { useApi } from '../hooks/useApi.js';
import { useSettings } from '../hooks/useSettings.js';
import { formatDistanceToNow } from 'date-fns';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

const MAP_CENTER = { lat: -37.6878, lng: 176.1651 };
const MAP_OPTIONS = {
  mapTypeId: 'hybrid',
  zoomControl: true,
  mapTypeControl: true,
  mapTypeControlOptions: { position: 3 }, // 3 = TOP_RIGHT, away from our buttons
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Colour scheme based on orchard variety
function growerColors(g) {
  const hasReeds = (g.reeds_trees ?? 0) > 0;
  const hasHass  = (g.hass_trees  ?? 0) > 0;
  if (hasReeds && hasHass) return { stroke: '#6a1a6a', fill: '#9b4db0', dot: '#6a1a6a' }; // purple = mixed
  if (hasReeds)            return { stroke: '#1a3a8c', fill: '#2d5cbf', dot: '#1a3a8c' }; // blue = reeds
  return                          { stroke: '#1a5c1a', fill: '#3d8b3d', dot: '#1a5c1a' }; // green = hass/unknown
}

export default function Dashboard() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const vehicles = useLivePositions();
  const { data: growers, refetch: refetchGrowers } = useApi('/api/growers');
  const { data: events } = useApi('/api/events?limit=10');
  const { data: locations } = useApi('/api/locations');
  const { data: pickingPlan } = useApi('/api/picking-plan?season=2026%2F27');
  const { data: activeHazards, refetch: refetchHazards } = useApi('/api/safety/hazards?status=active');
  const { settings } = useSettings();

  // Group active hazards by grower_id for quick lookup
  const hazardsByGrower = useMemo(() => {
    const m = new Map();
    if (!activeHazards) return m;
    for (const h of activeHazards) {
      if (!m.has(h.grower_id)) m.set(h.grower_id, []);
      m.get(h.grower_id).push(h);
    }
    return m;
  }, [activeHazards]);

  // In-app warning banner shown when a vehicle arrives at an orchard with hazards
  const [arrivalWarning, setArrivalWarning] = useState(null);
  useEffect(() => {
    const socket = socketIO(BACKEND || window.location.origin);
    socket.on('safety:arrival', (payload) => setArrivalWarning(payload));
    return () => socket.disconnect();
  }, []);

  // Hazard marker visibility
  const HAZARD_ZOOM_THRESHOLD = 14;  // ~property-level
  const [mapZoom, setMapZoom] = useState(11);
  const [showHazards, setShowHazards] = useState(true);
  const hazardsVisible = showHazards && mapZoom >= HAZARD_ZOOM_THRESHOLD;

  // Add-hazard mode: click anywhere on the map to drop a new hazard
  const [addHazardMode, setAddHazardMode] = useState(false);
  const [newHazardDraft, setNewHazardDraft] = useState(null); // { lat, lng, grower }

  // Ray-casting point-in-polygon to find which orchard a click belongs to
  function pointInRing(ring, lng, lat) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }
  function growerAtPoint(lat, lng) {
    if (!growers) return null;
    for (const g of growers) {
      if (!g.boundary) continue;
      const b = typeof g.boundary === 'string' ? JSON.parse(g.boundary) : g.boundary;
      const polys = b.type === 'Polygon' ? [b.coordinates] : b.coordinates;
      for (const rings of polys) if (pointInRing(rings[0], lng, lat)) return g;
    }
    // Fallback: nearest grower within ~200m
    let best = null, bestD = Infinity;
    for (const g of growers) {
      if (!g.lat || !g.lng) continue;
      const dLat = (g.lat - lat) * 111000;
      const dLng = (g.lng - lng) * 111000 * Math.cos(lat * Math.PI / 180);
      const d = Math.sqrt(dLat * dLat + dLng * dLng);
      if (d < bestD && d < 200) { best = g; bestD = d; }
    }
    return best;
  }

  function handleMapClick(e) {
    if (!addHazardMode) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const grower = growerAtPoint(lat, lng);
    if (!grower) {
      alert('Click inside an orchard boundary (or within 200m of an orchard pin) to add a hazard.');
      return;
    }
    setNewHazardDraft({
      lat, lng, grower_id: grower.id, grower_name: grower.name,
      type: 'steep_drop', title: '', severity: 'high',
    });
  }

  async function saveNewHazard() {
    if (!newHazardDraft?.title.trim()) return;
    try {
      const res = await fetch('/api/safety/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grower_id: newHazardDraft.grower_id,
          type: newHazardDraft.type,
          title: newHazardDraft.title.trim(),
          severity: newHazardDraft.severity,
          lat: newHazardDraft.lat,
          lng: newHazardDraft.lng,
          reported_by: 'live-map',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewHazardDraft(null);
      setAddHazardMode(false);
      refetchHazards();
    } catch (err) {
      alert(`Failed to add hazard: ${err.message}`);
    }
  }

  const radius = Number(settings?.geofence_radius_metres) || 200;

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedGrower,  setSelectedGrower]  = useState(null);
  const [editPins,   setEditPins]   = useState(false);
  const [savingPin,  setSavingPin]  = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const mapRef = useRef(null);

  const searchMatches = useMemo(() => {
    const q = mapSearch.trim().toLowerCase();
    if (!q || !growers) return [];
    return growers
      .filter(g => g.name.toLowerCase().includes(q) || g.address?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mapSearch, growers]);

  function flyToGrower(g) {
    if (!g.lat || !mapRef.current) return;
    mapRef.current.panTo({ lat: g.lat, lng: g.lng });
    mapRef.current.setZoom(17);
    setSelectedGrower(g);
    setMapSearch('');
  }

  // Filter state
  const [filterVariety,    setFilterVariety]    = useState('all'); // 'all' | 'hass' | 'reeds' | 'mixed'
  const [filterMinTrees,   setFilterMinTrees]   = useState(0);
  const [filterMaxTrees,   setFilterMaxTrees]   = useState(0); // 0 = no upper limit
  const [filterRadius,     setFilterRadius]     = useState(0); // km from HQ, 0 = any
  const [filterPickStatus, setFilterPickStatus] = useState('all'); // 'all' | 'pending' | 'first_pick' | 'complete' | 'second_pick'

  const maxTreesInData = useMemo(() => {
    if (!growers?.length) return 500;
    return Math.max(...growers.map(g => (g.hass_trees ?? 0) + (g.reeds_trees ?? 0)));
  }, [growers]);

  // Map grower_id → picking plan entry for fast lookup
  const pickingMap = useMemo(() => {
    const m = new Map();
    if (!pickingPlan) return m;
    for (const e of pickingPlan) {
      if (e.grower_id) m.set(e.grower_id, e);
    }
    return m;
  }, [pickingPlan]);

  const hqLocation = useMemo(() =>
    locations?.find(l => l.lat && l.lng) ?? null,
  [locations]);

  const filteredGrowers = useMemo(() => {
    if (!growers) return [];
    return growers.filter(g => {
      if (!g.lat) return false;
      const hass  = g.hass_trees  ?? 0;
      const reeds = g.reeds_trees ?? 0;
      const total = hass + reeds;

      if (filterVariety === 'hass'  && reeds > 0) return false;
      if (filterVariety === 'reeds' && reeds === 0) return false;
      if (filterVariety === 'mixed' && !(hass > 0 && reeds > 0)) return false;

      if (filterMinTrees > 0 && total < filterMinTrees) return false;
      if (filterMaxTrees > 0 && total > filterMaxTrees) return false;

      if (filterRadius > 0 && hqLocation) {
        const km = haversineKm(g.lat, g.lng, hqLocation.lat, hqLocation.lng);
        if (km > filterRadius) return false;
      }

      if (filterPickStatus !== 'all') {
        const plan = pickingMap.get(g.id);
        if (!plan) return false;
        if (filterPickStatus === 'second_pick') return plan.second_pick_needed;
        if (plan.status !== filterPickStatus) return false;
      }

      return true;
    });
  }, [growers, filterVariety, filterMinTrees, filterMaxTrees, filterRadius, filterPickStatus, pickingMap, hqLocation]);

  const activeFilterCount = [
    filterVariety !== 'all',
    filterMinTrees > 0,
    filterMaxTrees > 0,
    filterRadius > 0,
    filterPickStatus !== 'all',
  ].filter(Boolean).length;

  const handlePinDrop = useCallback(async (growerId, e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSavingPin(growerId);
    try {
      await fetch(`/api/growers/${growerId}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      refetchGrowers();
    } catch {
      alert('Failed to save pin position.');
    } finally {
      setSavingPin(null);
    }
  }, [refetchGrowers]);

  const handleHazardDrop = useCallback(async (hazardId, e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    try {
      const res = await fetch(`/api/safety/hazards/${hazardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refetchHazards();
    } catch (err) {
      alert(`Failed to save hazard position: ${err.message}`);
      refetchHazards(); // snap back on error
    }
  }, [refetchHazards]);

  if (!isLoaded) return <div className="state-loading">Loading map…</div>;

  const ringToPath = ring => ring.map(([lng, lat]) => ({ lat, lng }));

  // Emoji-based SVG icons for hazard markers
  const HAZARD_EMOJI = {
    powerline: '⚡',
    steep_terrain: '🏔',
    steep_drop: '🧱',
    chemical_storage: '☣',
    bee_hive: '🐝',
    water_hazard: '💧',
    machinery: '⚙',
    other: '⚠',
  };
  const HAZARD_BG = {
    powerline: '#f1c40f',
    steep_terrain: '#a0522d',
    steep_drop: '#7b2d2d',
    chemical_storage: '#8e44ad',
    bee_hive: '#e67e22',
    water_hazard: '#3498db',
    machinery: '#7f8c8d',
    other: '#c0392b',
  };
  const hazardIcon = (type) => {
    const emoji = HAZARD_EMOJI[type] ?? '⚠';
    const bg    = HAZARD_BG[type] ?? '#c0392b';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='38' viewBox='0 0 32 38'>
      <path d='M16 38 L4 18 a12 12 0 1 1 24 0 Z' fill='${bg}' stroke='#fff' stroke-width='2'/>
      <text x='16' y='20' text-anchor='middle' font-size='18' font-family='Apple Color Emoji, Segoe UI Emoji, sans-serif'>${emoji}</text>
    </svg>`;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(32, 38),
      anchor: new window.google.maps.Point(16, 38),
    };
  };

  return (
    <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 56px)' }}>
      <div style={{ flex: 1, position: 'relative' }}>

        {/* Arrival hazard warning banner — fires when any vehicle enters a geofence with active hazards */}
        {arrivalWarning && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
            background: '#c0392b', color: '#fff', padding: '0.9rem 1.2rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>
                ⚠ Safety warning — {arrivalWarning.vehicle_name}
                {arrivalWarning.driver_name && ` (${arrivalWarning.driver_name})`} arrived at {arrivalWarning.grower_name}
              </div>
              {arrivalWarning.spray && (
                <div style={{ fontSize: '0.88rem', marginTop: 2 }}>
                  🚫 Spray withholding: {arrivalWarning.spray.product} —
                  {' '}{arrivalWarning.spray.days_remaining} day{arrivalWarning.spray.days_remaining === 1 ? '' : 's'} remaining
                  (safe re-entry {new Date(arrivalWarning.spray.safe_reentry_date).toLocaleDateString('en-NZ')})
                </div>
              )}
              {arrivalWarning.hazards?.map((h, i) => (
                <div key={i} style={{ fontSize: '0.88rem', marginTop: 2 }}>
                  {h.type === 'powerline' ? '⚡' : h.type === 'steep_terrain' ? '⛰' : '⚠'}{' '}
                  {h.title} <span style={{ opacity: 0.85 }}>({h.severity})</span>
                </div>
              ))}
            </div>
            <button onClick={() => setArrivalWarning(null)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
              Dismiss
            </button>
          </div>
        )}


        {/* Top-left controls */}
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
            <button
              className={`btn ${editPins ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setEditPins(v => !v)}
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}
            >
              {editPins ? '✓ Done Editing' : '✎ Edit Pins'}
            </button>
            <button
              className={`btn ${showFilter ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowFilter(v => !v)}
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)', position: 'relative', whiteSpace: 'nowrap' }}
            >
              ⚙ Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            <button
              className={`btn ${showHazards ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowHazards(v => !v)}
              title={showHazards
                ? (mapZoom >= HAZARD_ZOOM_THRESHOLD ? 'Hazards visible — click to hide' : 'Zoom in to see hazard markers')
                : 'Hazards hidden — click to show'}
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}
            >
              ⚠ Hazards{showHazards ? ' on' : ' off'}
            </button>
            <button
              className={`btn ${addHazardMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setAddHazardMode(v => !v); setNewHazardDraft(null); }}
              title="Click on the map to drop a hazard at a specific location"
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}
            >
              {addHazardMode ? '✕ Cancel' : '+ Add Hazard'}
            </button>
          </div>
          {addHazardMode && !newHazardDraft && (
            <div style={{ background: '#fff', padding: '0.5rem 0.7rem', borderRadius: 6,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontSize: '0.85rem', maxWidth: 260 }}>
              Click on the map (inside an orchard boundary) to place a hazard.
            </div>
          )}
          {newHazardDraft && (
            <div style={{ background: '#fff', padding: '0.7rem 0.8rem', borderRadius: 8,
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                New hazard at {newHazardDraft.grower_name}
              </div>
              <label style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>
                Type
                <select value={newHazardDraft.type}
                  onChange={e => setNewHazardDraft(d => ({ ...d, type: e.target.value }))}
                  style={{ width: '100%', padding: '4px 6px', marginTop: 2, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="steep_drop">🧱 Steep Drop / Retaining Wall / Cliff</option>
                  <option value="powerline">⚡ Powerline</option>
                  <option value="steep_terrain">🏔 Steep Terrain</option>
                  <option value="water_hazard">💧 Water Hazard</option>
                  <option value="chemical_storage">☣ Chemical Storage</option>
                  <option value="bee_hive">🐝 Bee Hive</option>
                  <option value="machinery">⚙ Machinery</option>
                  <option value="other">⚠ Other</option>
                </select>
              </label>
              <label style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>
                Description
                <input type="text" autoFocus value={newHazardDraft.title}
                  onChange={e => setNewHazardDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="e.g. 3m retaining wall along southern edge"
                  style={{ width: '100%', padding: '4px 6px', marginTop: 2, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label style={{ fontSize: '0.8rem', color: '#5a6a5a' }}>
                Severity
                <select value={newHazardDraft.severity}
                  onChange={e => setNewHazardDraft(d => ({ ...d, severity: e.target.value }))}
                  style={{ width: '100%', padding: '4px 6px', marginTop: 2, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button className="btn btn-primary" onClick={saveNewHazard}
                  disabled={!newHazardDraft.title.trim()}>Save</button>
                <button className="btn btn-secondary" onClick={() => setNewHazardDraft(null)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Map grower search */}
          <div style={{ position: 'relative', width: 260 }}>
            <input
              type="search"
              placeholder="🔍 Search growers…"
              value={mapSearch}
              onChange={e => setMapSearch(e.target.value)}
              style={{
                width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8,
                border: '1px solid #d4e0d4', fontSize: '0.88rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)', boxSizing: 'border-box',
              }}
            />
            {searchMatches.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                background: '#fff', borderRadius: 8, boxShadow: '0 3px 12px rgba(0,0,0,0.25)',
                maxHeight: 320, overflowY: 'auto', zIndex: 20,
              }}>
                {searchMatches.map(g => (
                  <button
                    key={g.id}
                    onClick={() => flyToGrower(g)}
                    disabled={!g.lat}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '0.55rem 0.75rem', border: 'none',
                      borderBottom: '1px solid #eef2ee', background: 'transparent',
                      cursor: g.lat ? 'pointer' : 'not-allowed',
                      opacity: g.lat ? 1 : 0.5, fontSize: '0.85rem',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f9f5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontWeight: 600, color: '#11420A' }}>{g.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#5a6a5a' }}>
                      {g.address}
                      {!g.lat && <span style={{ marginLeft: 6, color: '#aaa' }}>(no pin)</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {editPins && (
            <div style={{ background: '#fff', padding: '0.5rem 0.75rem', borderRadius: 8,
              fontSize: '0.82rem', color: '#5a6a5a', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', maxWidth: 210 }}>
              Drag any pin to reposition an orchard. Changes save automatically.
            </div>
          )}

          {showFilter && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '0.9rem',
              boxShadow: '0 3px 12px rgba(0,0,0,0.25)', width: 240, fontSize: '0.85rem' }}>

              {/* Variety filter */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#2d6a2d', marginBottom: 6 }}>Variety</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {[['all','All'],['hass','Hass only'],['reeds','Has Reeds'],['mixed','Mixed']].map(([val, label]) => (
                    <button key={val} onClick={() => setFilterVariety(val)}
                      style={{ padding: '3px 10px', borderRadius: 12, border: '1.5px solid',
                        borderColor: filterVariety === val ? '#2d6a2d' : '#d4e0d4',
                        background: filterVariety === val ? '#2d6a2d' : '#fff',
                        color: filterVariety === val ? '#fff' : '#3a4a3a',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: filterVariety === val ? 700 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min trees */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#2d6a2d', marginBottom: 4 }}>
                  Min trees: <span style={{ color: '#5a6a5a', fontWeight: 400 }}>{filterMinTrees || 'Any'}</span>
                </div>
                <input type="range" min={0} max={maxTreesInData} step={10} value={filterMinTrees}
                  onChange={e => setFilterMinTrees(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#2d6a2d' }} />
              </div>

              {/* Max trees */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#2d6a2d', marginBottom: 4 }}>
                  Max trees: <span style={{ color: '#5a6a5a', fontWeight: 400 }}>{filterMaxTrees || 'Any'}</span>
                </div>
                <input type="range" min={0} max={maxTreesInData} step={10} value={filterMaxTrees}
                  onChange={e => setFilterMaxTrees(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#2d6a2d' }} />
              </div>

              {/* Radius from HQ */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#2d6a2d', marginBottom: 4 }}>
                  Radius from HQ: <span style={{ color: '#5a6a5a', fontWeight: 400 }}>
                    {filterRadius > 0 ? `${filterRadius} km` : 'Any'}
                  </span>
                </div>
                <input type="range" min={0} max={100} step={5} value={filterRadius}
                  onChange={e => setFilterRadius(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#2d6a2d' }} />
              </div>

              {/* Picking plan status */}
              <div style={{ marginBottom: '0.9rem' }}>
                <div style={{ fontWeight: 700, color: '#2d6a2d', marginBottom: 6 }}>Picking Status</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {[
                    ['all',         'All'],
                    ['pending',     'Not Started'],
                    ['first_pick',  'First Pick ✓'],
                    ['complete',    'Complete'],
                    ['second_pick', '2nd Pick'],
                  ].map(([val, label]) => (
                    <button key={val} onClick={() => setFilterPickStatus(val)}
                      style={{ padding: '3px 10px', borderRadius: 12, border: '1.5px solid', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: filterPickStatus === val ? 700 : 400,
                        borderColor: filterPickStatus === val ? '#2d6a2d' : '#d4e0d4',
                        background:  filterPickStatus === val ? '#2d6a2d' : '#fff',
                        color:       filterPickStatus === val ? '#fff'    : '#3a4a3a' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#5a6a5a', fontSize: '0.8rem' }}>
                  Showing <strong>{filteredGrowers.length}</strong> of {growers?.filter(g=>g.lat).length ?? 0}
                </span>
                <button onClick={() => {
                  setFilterVariety('all'); setFilterMinTrees(0); setFilterMaxTrees(0);
                  setFilterRadius(0); setFilterPickStatus('all');
                }}
                  style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: 600 }}>
                  Reset
                </button>
              </div>

              {/* Legend */}
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #eef2ee',
                display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['#1a5c1a', 'Hass only'],
                  ['#1a3a8c', 'Reed trees'],
                  ['#6a1a6a', 'Mixed (Hass + Reed)'],
                ].map(([color, label]) => (
                  <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', color: '#3a4a3a' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={MAP_CENTER}
          zoom={11}
          options={MAP_OPTIONS}
          onLoad={map => { mapRef.current = map; setMapZoom(map.getZoom()); }}
          onZoomChanged={() => mapRef.current && setMapZoom(mapRef.current.getZoom())}
          onClick={handleMapClick}
        >
          {filteredGrowers.map(g => {
            const boundary = g.boundary
              ? (typeof g.boundary === 'string' ? JSON.parse(g.boundary) : g.boundary)
              : null;

            let polygonPaths = null;
            if (boundary?.type === 'Polygon') {
              polygonPaths = [ringToPath(boundary.coordinates[0])];
            } else if (boundary?.type === 'MultiPolygon') {
              polygonPaths = boundary.coordinates.map(poly => ringToPath(poly[0]));
            }

            const colors = growerColors(g);
            const shapeOptions = {
              strokeColor: colors.stroke,
              strokeOpacity: 1,
              strokeWeight: 2.5,
              fillColor: colors.fill,
              fillOpacity: 0.22,
              clickable: !editPins,
            };

            return (
              <Fragment key={g.id}>
                {polygonPaths ? (
                  polygonPaths.map((path, i) => (
                    <Polygon key={i} paths={path} options={shapeOptions}
                      onClick={() => !editPins && flyToGrower(g)} />
                  ))
                ) : (
                  <Circle center={{ lat: g.lat, lng: g.lng }} radius={radius}
                    options={shapeOptions}
                    onClick={() => !editPins && flyToGrower(g)} />
                )}

                {!editPins && (
                  <Marker
                    position={{ lat: g.lat, lng: g.lng }}
                    title={g.name}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      fillColor: colors.dot,
                      fillOpacity: 0.9,
                      strokeColor: '#ffffff',
                      strokeWeight: 1.5,
                      scale: 5,
                    }}
                    onClick={() => flyToGrower(g)}
                  />
                )}

                {/* Hazard markers — shown when toggled on AND (zoomed in OR editing pins) */}
                {(hazardsVisible || editPins) && hazardsByGrower.get(g.id)?.map((h, hi) => {
                  // Use stored lat/lng if set; otherwise fan out around the orchard centre
                  const hasCoord = h.lat != null && h.lng != null;
                  const offset = 0.0003 * (hi + 1);
                  const angle = (hi * 137) * Math.PI / 180;
                  const hlat = hasCoord ? h.lat : g.lat + Math.cos(angle) * offset;
                  const hlng = hasCoord ? h.lng : g.lng + Math.sin(angle) * offset;
                  return (
                    <Marker
                      key={`h-${h.id}`}
                      position={{ lat: hlat, lng: hlng }}
                      icon={hazardIcon(h.type)}
                      title={editPins
                        ? `${h.title} — drag to reposition`
                        : `${h.title} (${h.severity})`}
                      draggable={editPins}
                      onDragEnd={e => handleHazardDrop(h.id, e)}
                      onClick={() => !editPins && setSelectedGrower(g)}
                      zIndex={150}
                    />
                  );
                })}

                {editPins && (
                  <Marker
                    position={{ lat: g.lat, lng: g.lng }}
                    draggable={true}
                    onDragEnd={e => handlePinDrop(g.id, e)}
                    title={`${g.name} — ${g.address}`}
                    label={{
                      text: g.address?.match(/^\d+[A-Za-z]*/)?.[0] ?? '•',
                      color: '#ffffff', fontSize: '11px', fontWeight: 'bold',
                    }}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      fillColor: savingPin === g.id ? '#f0a500' : colors.dot,
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                      scale: 14,
                    }}
                    onClick={() => setSelectedGrower(g)}
                  />
                )}
              </Fragment>
            );
          })}

          {selectedGrower && (
            <InfoWindow
              position={{ lat: selectedGrower.lat, lng: selectedGrower.lng }}
              onCloseClick={() => setSelectedGrower(null)}
            >
              <div style={{ fontSize: '0.85rem', minWidth: 170 }}>
                <strong>{selectedGrower.name}</strong><br />
                {selectedGrower.address}<br />
                {selectedGrower.phone && <>{selectedGrower.phone}<br /></>}
                <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedGrower.hass_trees > 0 && (
                    <span style={{ background: '#e8f5e8', color: '#1a5c1a', borderRadius: 4, padding: '1px 6px', fontSize: '0.8rem' }}>
                      Hass: {selectedGrower.hass_trees}
                    </span>
                  )}
                  {selectedGrower.reeds_trees > 0 && (
                    <span style={{ background: '#e8eef8', color: '#1a3a8c', borderRadius: 4, padding: '1px 6px', fontSize: '0.8rem' }}>
                      Reeds: {selectedGrower.reeds_trees}
                    </span>
                  )}
                </div>
                {hazardsByGrower.get(selectedGrower.id)?.length > 0 && (
                  <div style={{ marginTop: 6, padding: '5px 7px', background: '#fdf4e3',
                    border: '1px solid #f5c97c', borderRadius: 5 }}>
                    <div style={{ fontWeight: 700, color: '#8a5a00', fontSize: '0.78rem', marginBottom: 3 }}>
                      ⚠ Active hazards
                    </div>
                    {hazardsByGrower.get(selectedGrower.id).map(h => (
                      <div key={h.id} style={{ fontSize: '0.78rem', color: '#5a4400' }}>
                        {h.type === 'powerline' ? '⚡' : h.type === 'steep_terrain' ? '⛰' : '⚠'}{' '}
                        {h.title}
                        <span style={{ marginLeft: 5, fontSize: '0.7rem', color: '#a07a00' }}>
                          ({h.severity})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {pickingMap.get(selectedGrower.id) && (() => {
                  const p = pickingMap.get(selectedGrower.id);
                  const statusLabel = { pending: 'Not Started', first_pick: 'First Pick ✓', complete: 'Complete ✓✓' };
                  const statusColor = { pending: '#666', first_pick: '#856404', complete: '#155724' };
                  const statusBg    = { pending: '#f5f5f5', first_pick: '#fff3cd', complete: '#d4edda' };
                  return (
                    <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ background: statusBg[p.status], color: statusColor[p.status],
                        borderRadius: 4, padding: '1px 6px', fontSize: '0.78rem', fontWeight: 600 }}>
                        {statusLabel[p.status]}
                      </span>
                      {p.second_pick_needed && (
                        <span style={{ background: '#fde8e8', color: '#c0392b', borderRadius: 4,
                          padding: '1px 6px', fontSize: '0.78rem', fontWeight: 600 }}>
                          2nd pick
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </InfoWindow>
          )}

          {vehicles.map(v => (
            <Marker key={v.id} position={{ lat: v.lat, lng: v.lng }} title={v.name}
              icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/truck.png',
                scaledSize: { width: 32, height: 32 } }}
              onClick={() => setSelectedVehicle(v)}
            />
          ))}

          {selectedVehicle && (
            <InfoWindow
              position={{ lat: selectedVehicle.lat, lng: selectedVehicle.lng }}
              onCloseClick={() => setSelectedVehicle(null)}
            >
              <div style={{ fontSize: '0.85rem' }}>
                <strong>{selectedVehicle.name}</strong><br />
                {selectedVehicle.driver_name && <>{selectedVehicle.driver_name}<br /></>}
                {selectedVehicle.speed_kmh != null && <>{Math.round(selectedVehicle.speed_kmh)} km/h<br /></>}
                <span style={{ color: '#5a6a5a' }}>
                  {formatDistanceToNow(new Date(selectedVehicle.recorded_at), { addSuffix: true })}
                </span>
              </div>
            </InfoWindow>
          )}

          {locations?.filter(l => l.lat).map(l => (
            <Marker key={`loc-${l.id}`} position={{ lat: l.lat, lng: l.lng }} title={l.name}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#c0392b', fillOpacity: 1,
                strokeColor: '#ffffff', strokeWeight: 3, scale: 16,
              }}
              label={{ text: 'HQ', color: '#ffffff', fontSize: '10px', fontWeight: 'bold' }}
              zIndex={200}
            />
          ))}

          {filterRadius > 0 && hqLocation && (
            <Circle
              center={{ lat: hqLocation.lat, lng: hqLocation.lng }}
              radius={filterRadius * 1000}
              options={{
                strokeColor: '#c0392b', strokeOpacity: 0.6, strokeWeight: 2,
                strokeDasharray: '8,4',
                fillColor: '#c0392b', fillOpacity: 0.04,
                clickable: false,
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* Side panel */}
      <aside style={{ width: 300, background: '#fff', borderLeft: '1px solid #d4e0d4',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #d4e0d4', fontWeight: 700,
          color: '#2d6a2d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Recent Events
          <span style={{ fontSize: '0.78rem', fontWeight: 400, color: '#5a6a5a' }}>
            {radius}m radius
          </span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!events?.length && <div className="state-empty">No events yet</div>}
          {events?.map(e => (
            <div key={e.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #eef2ee', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span className={`badge badge-${e.event_type}`}>{e.event_type}</span>
                <span style={{ color: '#5a6a5a', fontSize: '0.78rem' }}>
                  {formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true })}
                </span>
              </div>
              <div style={{ fontWeight: 600 }}>{e.grower_name}</div>
              <div style={{ color: '#5a6a5a' }}>{e.vehicle_name}
                {e.driver_name && ` · ${e.driver_name}`}
              </div>
              <div style={{ marginTop: 3 }}>
                {e.notified_sms   && <span className="badge badge-sms"   style={{ marginRight: 4 }}>SMS</span>}
                {e.notified_email && <span className="badge badge-email">Email</span>}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
