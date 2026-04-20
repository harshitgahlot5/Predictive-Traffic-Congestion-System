/**
 * Congestion level definitions and color mapping
 */

export const CONGESTION_LEVELS = {
  low: {
    label: 'Low',
    color: '#00E676',
    bgColor: 'rgba(0, 230, 118, 0.12)',
    markerColor: '#00E676',
    emoji: '🟢',
    description: 'Free-flowing traffic'
  },
  medium: {
    label: 'Medium',
    color: '#FFEA00',
    bgColor: 'rgba(255, 234, 0, 0.12)',
    markerColor: '#FFD600',
    emoji: '🟡',
    description: 'Moderate congestion'
  },
  high: {
    label: 'High',
    color: '#FF5252',
    bgColor: 'rgba(255, 82, 82, 0.12)',
    markerColor: '#FF1744',
    emoji: '🔴',
    description: 'Heavy congestion'
  },
  standstill: {
    label: 'Standstill',
    color: '#90A4AE',
    bgColor: 'rgba(55, 71, 79, 0.3)',
    markerColor: '#37474F',
    emoji: '⚫',
    description: 'Traffic at standstill'
  }
};

export function scoreToLevel(score) {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'standstill';
}

export function getLevelInfo(level) {
  return CONGESTION_LEVELS[level] || CONGESTION_LEVELS.low;
}

export function getScoreColor(score) {
  return getLevelInfo(scoreToLevel(score)).color;
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
