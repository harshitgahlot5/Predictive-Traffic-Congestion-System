import CongestionBadge from '../common/CongestionBadge';

export default function StatsPanel({ trafficData = [] }) {
  if (trafficData.length === 0) return null;

  const avgScore = trafficData.reduce((s, d) => s + (d.congestionScore || 0), 0) / trafficData.length;
  const totalVehicles = trafficData.reduce((s, d) => s + (d.vehicleCount || 0), 0);
  const anomalyCount = trafficData.filter(d => d.anomaly?.detected).length;
  const avgSpeed = trafficData.reduce((s, d) => s + (d.avgSpeed || 0), 0) / trafficData.length;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Locations</span>
        <span className="stat-value">{trafficData.length}</span>
        <span className="stat-sub">monitored</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Avg Speed</span>
        <span className="stat-value">{avgSpeed.toFixed(0)}<small style={{fontSize:'0.7em',opacity:0.6}}> km/h</small></span>
        <span className="stat-sub">across network</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Total Vehicles</span>
        <span className="stat-value">{totalVehicles}</span>
        <span className="stat-sub">detected now</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Anomalies</span>
        <span className="stat-value" style={{ color: anomalyCount > 0 ? 'var(--traffic-high)' : 'var(--traffic-low)' }}>
          {anomalyCount}
        </span>
        <span className="stat-sub">{anomalyCount > 0 ? 'active alerts' : 'all clear'}</span>
      </div>
    </div>
  );
}
