import { useApi } from '../hooks/useApi.js';
import { format } from 'date-fns';

export default function EventsPage() {
  const { data, loading, refetch } = useApi('/api/events?limit=100');

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Arrival &amp; Departure Events</h1>
        <button className="btn btn-secondary" onClick={refetch}>↻ Refresh</button>
      </div>

      <div className="card">
        {loading && <div className="state-loading">Loading…</div>}
        {!loading && !data?.length && <div className="state-empty">No events recorded yet.</div>}
        {data?.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Grower</th>
                  <th>Address</th>
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
                    <td><span className={`badge badge-${e.event_type}`}>{e.event_type}</span></td>
                    <td style={{ fontWeight: 500 }}>{e.grower_name}</td>
                    <td style={{ color: '#5a6a5a', fontSize: '0.85rem' }}>{e.grower_address}</td>
                    <td>{e.vehicle_name}</td>
                    <td>{e.driver_name ?? '—'}</td>
                    <td>
                      {e.notified_sms   && <span className="badge badge-sms"   style={{ marginRight: 4 }}>SMS</span>}
                      {e.notified_email && <span className="badge badge-email"  style={{ marginRight: 4 }}>Email</span>}
                      {!e.notified_sms && !e.notified_email && <span style={{ color: '#aaa' }}>—</span>}
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
