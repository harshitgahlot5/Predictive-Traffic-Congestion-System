import { useState, useEffect } from 'react';
import CongestionBadge from '../common/CongestionBadge';
import PredictionChart from '../Prediction/PredictionChart';
import { getPredictions, getLocationTraffic } from '../../services/api';
import { getLevelInfo, formatTimeAgo } from '../../utils/congestionLevels';

const VEHICLE_ICONS = { car: '🚗', truck: '🚛', bus: '🚌', motorcycle: '🏍️', bicycle: '🚲' };

export default function LocationDetail({ item, onClose }) {
  const [predictions, setPredictions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loc = item?.location || item;
  const locId = loc?._id || loc?.cameraId;

  useEffect(() => {
    if (!locId) return;
    setLoading(true);
    Promise.all([
      getPredictions(locId).catch(() => ({ data: [] })),
      getLocationTraffic(locId, 6).catch(() => ({ data: [] }))
    ]).then(([predRes, histRes]) => {
      setPredictions(predRes.data || []);
      setHistory(histRes.data || []);
    }).finally(() => setLoading(false));
  }, [locId]);

  if (!item || !loc) return null;

  const levelInfo = getLevelInfo(item.congestionLevel || 'low');
  const vehicles = item.rawData?.cameraVehicles || {};

  return (
    <div className="location-detail fade-in">
      <div className="location-header">
        <div>
          <h3>{loc.name}</h3>
          <span className="location-type">📍 {loc.type || 'intersection'} • {loc.cameraId}</span>
        </div>
        <div className="location-score-ring" style={{ borderColor: levelInfo.color, color: levelInfo.color }}>
          {Math.round(item.congestionScore || 0)}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CongestionBadge level={item.congestionLevel || 'low'} score={item.congestionScore} showScore size="lg" />
        <span style={{ marginLeft: 10, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {item.timestamp ? formatTimeAgo(item.timestamp) : ''}
        </span>
      </div>

      {item.anomaly?.detected && (
        <div className="anomaly-alert">
          <span className="anomaly-icon">⚠️</span>
          <div>
            <strong>{item.anomaly.type?.replace(/_/g, ' ')}</strong>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
              Confidence: {(item.anomaly.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      )}

      <div className="detail-section">
        <h4>Current Metrics</h4>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Speed</span>
            <span className="stat-value" style={{ fontSize: '1.3rem' }}>{item.avgSpeed?.toFixed(1) || 0}<small style={{fontSize:'0.6em'}}> km/h</small></span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Flow Rate</span>
            <span className="stat-value" style={{ fontSize: '1.3rem' }}>{item.flowRate?.toFixed(1) || 0}<small style={{fontSize:'0.6em'}}> /min</small></span>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h4>Vehicle Breakdown ({item.vehicleCount || 0} total)</h4>
        <div className="vehicle-breakdown">
          {Object.entries(vehicles).filter(([, v]) => v > 0).map(([type, count]) => (
            <div key={type} className="vehicle-item">
              <span className="v-label">{VEHICLE_ICONS[type] || '🚗'} {type}</span>
              <span className="v-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-section">
        <h4>Predictions</h4>
        {predictions.length > 0 ? (
          <div className="prediction-comparison">
            {predictions.map((pred, i) => (
              <div key={i} className="prediction-row">
                <span className="pred-time">+{pred.horizonMinutes}min</span>
                <CongestionBadge level={pred.predictedLevel} />
                <span className="pred-score" style={{ color: getLevelInfo(pred.predictedLevel).color }}>
                  {pred.predictedScore?.toFixed(0)}
                </span>
                <span className="pred-confidence">{(pred.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: 10 }}>
            {loading ? 'Loading predictions...' : 'No predictions available'}
          </div>
        )}
      </div>

      {history.length > 4 && (
        <div className="detail-section">
          <h4>6-Hour Trend</h4>
          <PredictionChart history={history} predictions={predictions} />
        </div>
      )}
    </div>
  );
}
