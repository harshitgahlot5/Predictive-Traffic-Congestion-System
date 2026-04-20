import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { formatTime } from '../../utils/congestionLevels';
import './PredictionChart.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function PredictionChart({ history = [], predictions = [] }) {
  // Sample history to max 36 points for readability
  const step = Math.max(1, Math.floor(history.length / 36));
  const sampled = history.filter((_, i) => i % step === 0 || i === history.length - 1);

  const historyLabels = sampled.map(d => formatTime(d.timestamp));
  const historyScores = sampled.map(d => d.congestionScore || 0);

  // Add prediction points
  const predLabels = predictions.map(p => `+${p.horizonMinutes}m`);
  const predScores = predictions.map(p => p.predictedScore || 0);

  const allLabels = [...historyLabels, ...predLabels];
  const allHistoryScores = [...historyScores, ...Array(predLabels.length).fill(null)];
  const allPredScores = [...Array(historyLabels.length - 1).fill(null), historyScores[historyScores.length - 1] || 0, ...predScores];

  const data = {
    labels: allLabels,
    datasets: [
      {
        label: 'Actual',
        data: allHistoryScores,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
        fill: true
      },
      {
        label: 'Predicted',
        data: allPredScores,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 4,
        pointBackgroundColor: '#f59e0b',
        tension: 0.3,
        fill: true
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 20, padding: 12 }
      },
      tooltip: {
        backgroundColor: '#1a2235',
        titleColor: '#f0f4ff',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 45, maxTicksLimit: 10 },
        grid: { color: 'rgba(255,255,255,0.04)' }
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#64748b', font: { size: 10 }, stepSize: 25 },
        grid: { color: 'rgba(255,255,255,0.04)' }
      }
    }
  };

  return (
    <div className="prediction-chart-wrapper" id="prediction-chart">
      <div style={{ height: 190 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
