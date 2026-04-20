import { getLevelInfo } from '../../utils/congestionLevels';

export default function CongestionBadge({ level, score, showScore = false, size = 'sm' }) {
  const info = getLevelInfo(level);
  const sizeClass = size === 'lg' ? 'badge-lg' : '';

  return (
    <span
      className={`badge badge-${level} ${sizeClass}`}
      style={{ '--badge-color': info.color }}
      title={info.description}
    >
      <span className="pulse-dot" style={{ background: info.color }}></span>
      {info.label}
      {showScore && score !== undefined && (
        <span style={{ opacity: 0.7, marginLeft: 4 }}>({Math.round(score)})</span>
      )}
    </span>
  );
}
