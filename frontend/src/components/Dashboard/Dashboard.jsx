import { useState, useEffect, useCallback } from 'react';
import TrafficMap from '../Map/TrafficMap';
import StatsPanel from './StatsPanel';
import LocationDetail from './LocationDetail';
import Loader from '../common/Loader';
import { getLatestTraffic } from '../../services/api';
import { formatTimeAgo } from '../../utils/congestionLevels';
import './Dashboard.css';

export default function Dashboard({ theme }) {
  const [trafficData, setTrafficData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await getLatestTraffic();
      setTrafficData(res.data || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch traffic data. Is the backend running?');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleLocationSelect = (item) => {
    setSelectedItem(item);
  };

  if (loading && trafficData.length === 0) {
    return (
      <div className="dashboard-layout">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader text="Connecting to TrafficSense AI..." />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout" id="dashboard">
      <div className="dashboard-map-area">
        {error && (
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 900,
            background: 'var(--traffic-high-bg)', border: '1px solid rgba(255,82,82,0.3)',
            borderRadius: 'var(--radius-md)', padding: '10px 20px', fontSize: '0.82rem',
            color: 'var(--traffic-high)', backdropFilter: 'blur(12px)'
          }}>
            ⚠️ {error}
          </div>
        )}
        <TrafficMap
          trafficData={trafficData}
          onLocationSelect={handleLocationSelect}
          selectedId={selectedItem?.location?._id}
          theme={theme}
        />
      </div>

      <div className="dashboard-side-panel">
        <div className="side-panel-header">
          <h2>{selectedItem ? '📍 Location Details' : '📊 Overview'}</h2>
          {selectedItem && (
            <button className="side-panel-close" onClick={() => setSelectedItem(null)}>✕</button>
          )}
        </div>

        <div className="side-panel-content">
          {selectedItem ? (
            <LocationDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
          ) : (
            <>
              <StatsPanel trafficData={trafficData} />
              <div className="detail-section" style={{ marginTop: 8 }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: 'var(--text-muted)', marginBottom: 10 }}>All Locations</h4>
                {trafficData.map((item, idx) => {
                  const loc = item.location || item;
                  return (
                    <div key={idx} className="prediction-row" style={{ cursor: 'pointer', marginBottom: 6 }}
                      onClick={() => handleLocationSelect(item)}>
                      <span style={{ flex: 1, fontSize: '0.82rem' }}>{loc.name || 'Unknown'}</span>
                      <span className={`badge badge-sm badge-${item.congestionLevel || 'low'}`}
                        style={{
                          padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.65rem',
                          fontWeight: 600, textTransform: 'uppercase',
                          background: `var(--traffic-${item.congestionLevel || 'low'}-bg)`,
                          color: `var(--traffic-${item.congestionLevel || 'low'})`
                        }}>
                        {item.congestionLevel || 'low'}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>
                        {Math.round(item.congestionScore || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="refresh-bar">
          <span>{lastUpdated ? `Updated ${formatTimeAgo(lastUpdated)}` : 'Loading...'}</span>
          <button className="btn" onClick={fetchData} style={{ padding: '4px 12px', fontSize: '0.72rem' }}>
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
