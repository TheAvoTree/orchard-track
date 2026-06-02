import { useState, useRef, useEffect } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import GrowersPage from './pages/GrowersPage.jsx';
import VehiclesPage from './pages/VehiclesPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import PickingPlanPage from './pages/PickingPlanPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SafetyPage from './pages/SafetyPage.jsx';
import PickingLogPage from './pages/PickingLogPage.jsx';
import GrowerPortal from './pages/GrowerPortal.jsx';
import './App.css';

// Detect grower portal route: /safety/<token>
const portalMatch = window.location.pathname.match(/^\/safety\/([a-f0-9]{32})$/i);

const TABS = [
  { id: 'dashboard',    label: 'Live Map' },
  { id: 'picking-plan', label: 'Picking Plan' },
  { id: 'picking-log',  label: '🥑 Schedule' },
  { id: 'safety',       label: '⚠ Safety' },
  // { id: 'events', label: 'Events' },  // Hidden until GPS trackers are installed
  { id: 'growers',      label: 'Growers' },
  { id: 'vehicles',     label: 'Fleet' },
  { id: 'settings',     label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const navRef = useRef(null);
  const activeRef = useRef(null);

  // Scroll the active tab button into view when tab changes
  useEffect(() => {
    if (activeRef.current && navRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }, [tab]);

  // Serve grower portal if URL matches /safety/<token>
  if (portalMatch) {
    return <GrowerPortal token={portalMatch[1]} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <img
            className="app-logo-img"
            src="https://theavotree.co.nz/wp-content/uploads/2025/08/IDLogotypeColorGreen.svg"
            alt="The Avo Tree"
          />
          <span className="app-logo-sep" />
          <span className="app-logo-text">Orchard Track</span>
        </div>
        <nav className="app-nav" ref={navRef}>
          {TABS.map(t => (
            <button
              key={t.id}
              ref={tab === t.id ? activeRef : null}
              className={`nav-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === 'dashboard'    && <Dashboard />}
        {tab === 'picking-plan' && <PickingPlanPage />}
        {tab === 'picking-log'  && <PickingLogPage />}
        {tab === 'safety'       && <SafetyPage />}
        {tab === 'events'       && <EventsPage />}
        {tab === 'growers'      && <GrowersPage />}
        {tab === 'vehicles'     && <VehiclesPage />}
        {tab === 'settings'     && <SettingsPage />}
      </main>
    </div>
  );
}
