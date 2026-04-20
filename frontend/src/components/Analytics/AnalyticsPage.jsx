import { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { getLatestTraffic, generateAllPredictions } from '../../services/api';
import { getLevelInfo } from '../../utils/congestionLevels';
import Loader from '../common/Loader';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function AnalyticsPage({ theme }) {
  const [trafficData, setTrafficData] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getLatestTraffic().catch(() => ({ data: [] })),
      generateAllPredictions().catch(() => ({ data: {} }))
    ]).then(([trafficRes, predRes]) => {
      setTrafficData(trafficRes.data || []);
      setPredictions(predRes.data || {});
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader text="Loading analytics..." /></div>;

  const textColor = theme === 'light' ? '#475569' : '#94a3b8';
  const gridColor = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
  const tooltipBg = theme === 'light' ? '#ffffff' : '#1a2235';
  const tooltipTitle = theme === 'light' ? '#0f172a' : '#f0f4ff';
  const tooltipBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: textColor, font: { size: 11 } } },
      tooltip: { backgroundColor: tooltipBg, titleColor: tooltipTitle, bodyColor: textColor, borderColor: tooltipBorder, borderWidth: 1, cornerRadius: 8 }
    },
    scales: {
      x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
      y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }
    }
  };

  // Congestion distribution
  const levelCounts = { low: 0, medium: 0, high: 0, standstill: 0 };
  trafficData.forEach(d => { levelCounts[d.congestionLevel || 'low']++; });

  const doughnutData = {
    labels: Object.keys(levelCounts).map(l => getLevelInfo(l).label),
    datasets: [{
      data: Object.values(levelCounts),
      backgroundColor: Object.keys(levelCounts).map(l => getLevelInfo(l).color),
      borderWidth: 0,
      hoverOffset: 8
    }]
  };

  // Congestion scores bar chart
  const barData = {
    labels: trafficData.map(d => (d.location?.name || 'Unknown').split(' ').slice(0, 2).join(' ')),
    datasets: [{
      label: 'Congestion Score',
      data: trafficData.map(d => d.congestionScore || 0),
      backgroundColor: trafficData.map(d => getLevelInfo(d.congestionLevel || 'low').color + '80'),
      borderColor: trafficData.map(d => getLevelInfo(d.congestionLevel || 'low').color),
      borderWidth: 1,
      borderRadius: 4
    }]
  };

  // Speed comparison
  const speedData = {
    labels: trafficData.map(d => (d.location?.name || '').split(' ').slice(0, 2).join(' ')),
    datasets: [{
      label: 'Avg Speed (km/h)',
      data: trafficData.map(d => d.avgSpeed || 0),
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#06b6d4'
    }]
  };

  return (
    <div id="analytics-page" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>📊 Network Analytics</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.85rem', marginBottom: 16, color: 'var(--text-secondary)' }}>Congestion Distribution</h3>
          <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={doughnutData} options={{
              ...chartOptions,
              cutout: '65%',
              scales: undefined,
              plugins: { ...chartOptions.plugins, legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { size: 11 } } } }
            }} />
          </div>
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.85rem', marginBottom: 16, color: 'var(--text-secondary)' }}>Congestion by Location</h3>
          <div style={{ height: 250 }}>
            <Bar data={barData} options={{ ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }} />
          </div>
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.85rem', marginBottom: 16, color: 'var(--text-secondary)' }}>Speed Across Network</h3>
          <div style={{ height: 250 }}>
            <Line data={speedData} options={chartOptions} />
          </div>
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.85rem', marginBottom: 16, color: 'var(--text-secondary)' }}>Predictions Overview</h3>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {Object.entries(predictions).map(([locId, preds]) => {
              const loc = trafficData.find(d => {
                const id = d.location?._id || d.locationId;
                return id === locId || String(id) === String(locId);
              });
              const name = loc?.location?.name || locId;
              return (
                <div key={locId} style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>{name}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(preds || []).map((p, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 'var(--radius-sm)',
                        background: getLevelInfo(p.predictedLevel).bgColor, fontSize: '0.72rem' }}>
                        <div style={{ color: getLevelInfo(p.predictedLevel).color, fontWeight: 600 }}>+{p.horizonMinutes}m</div>
                        <div style={{ fontWeight: 700, color: getLevelInfo(p.predictedLevel).color }}>{p.predictedScore?.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
