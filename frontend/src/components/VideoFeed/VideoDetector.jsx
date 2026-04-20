import { useState, useRef, useEffect, useCallback } from 'react';
import CongestionBadge from '../common/CongestionBadge';
import { scoreToLevel } from '../../utils/congestionLevels';
import './VideoDetector.css';

// Vehicle types we care about from COCO dataset
const VEHICLE_CLASSES = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'];
const VEHICLE_COLORS = {
  car: '#3b82f6', truck: '#f59e0b', bus: '#10b981',
  motorcycle: '#8b5cf6', bicycle: '#06b6d4'
};

/**
 * Canvas-based traffic simulation when no real video/model available
 */
function SimulatedTraffic({ canvasRef, isRunning, onDetection }) {
  const vehiclesRef = useRef([]);
  const frameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 500;

    // Initialize vehicles
    const initVehicles = () => {
      const count = 15 + Math.floor(Math.random() * 20);
      vehiclesRef.current = Array.from({ length: count }, () => createVehicle(canvas));
    };

    function createVehicle(canvas) {
      const lane = Math.floor(Math.random() * 4);
      const direction = lane < 2 ? 1 : -1;
      const type = VEHICLE_CLASSES[Math.floor(Math.random() * VEHICLE_CLASSES.length)];
      const sizes = { car: [40, 22], truck: [60, 24], bus: [70, 22], motorcycle: [25, 14], bicycle: [20, 12] };
      const [w, h] = sizes[type];

      return {
        x: direction > 0 ? -w - Math.random() * 400 : canvas.width + Math.random() * 400,
        y: 180 + lane * 45 + (Math.random() - 0.5) * 10,
        w, h, type, direction,
        speed: (1.5 + Math.random() * 3) * direction,
        color: VEHICLE_COLORS[type]
      };
    }

    function drawRoad(ctx, w, h) {
      // Road surface
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);

      // Road
      ctx.fillStyle = '#2d2d44';
      ctx.fillRect(0, 150, w, 220);

      // Lane markings
      ctx.setLineDash([30, 20]);
      ctx.strokeStyle = '#4a4a6a';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 150 + i * 55);
        ctx.lineTo(w, 150 + i * 55);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Road edges
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 150);
      ctx.lineTo(w, 150);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 370);
      ctx.lineTo(w, 370);
      ctx.stroke();

      // Buildings / scenery
      ctx.fillStyle = '#0f0f23';
      for (let i = 0; i < 8; i++) {
        const bw = 60 + Math.random() * 40;
        const bh = 40 + Math.random() * 80;
        ctx.fillRect(i * 110 + 10, 150 - bh - 10, bw, bh);
        ctx.fillRect(i * 110 + 10, 380, bw, 30 + Math.random() * 50);
      }
    }

    function animate() {
      if (!isRunning) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRoad(ctx, canvas.width, canvas.height);

      const detectedVehicles = { car: 0, truck: 0, bus: 0, motorcycle: 0, bicycle: 0 };

      vehiclesRef.current.forEach(v => {
        v.x += v.speed;

        // Reset when off screen
        if ((v.direction > 0 && v.x > canvas.width + 100) || (v.direction < 0 && v.x < -100)) {
          const nv = createVehicle(canvas);
          Object.assign(v, nv);
        }

        // Draw vehicle body
        ctx.fillStyle = v.color;
        ctx.fillRect(v.x, v.y, v.w, v.h);

        // Draw bounding box
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(v.x - 4, v.y - 4, v.w + 8, v.h + 8);

        // Label
        ctx.fillStyle = v.color;
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(v.type, v.x, v.y - 7);

        // Count if visible
        if (v.x > 0 && v.x < canvas.width) {
          detectedVehicles[v.type]++;
        }
      });

      // Timestamp overlay
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, 200, 28);
      ctx.fillStyle = '#00E676';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillText(`FEED: CAM-SBJ001 | ${new Date().toLocaleTimeString()}`, 8, 18);

      onDetection(detectedVehicles);
      frameRef.current = requestAnimationFrame(animate);
    }

    initVehicles();
    if (isRunning) animate();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isRunning, canvasRef, onDetection]);

  return null;
}

export default function VideoDetector() {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [detections, setDetections] = useState({ car: 0, truck: 0, bus: 0, motorcycle: 0, bicycle: 0 });
  const [log, setLog] = useState([]);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(Date.now());
  const frameCountRef = useRef(0);

  const handleDetection = useCallback((vehicles) => {
    setDetections(vehicles);

    // FPS calculation
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastTimeRef.current = now;

      // Log entry every second
      const total = Object.values(vehicles).reduce((a, b) => a + b, 0);
      setLog(prev => [{
        time: new Date().toLocaleTimeString(),
        count: total,
        vehicles: { ...vehicles }
      }, ...prev].slice(0, 30));
    }
  }, []);

  const totalVehicles = Object.values(detections).reduce((a, b) => a + b, 0);
  const densityScore = Math.min(100, totalVehicles * 3);
  const congestionLevel = scoreToLevel(densityScore);

  return (
    <div className="video-detector-page" id="video-detector">
      <div className="video-section">
        <div className="video-wrapper">
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          <SimulatedTraffic canvasRef={canvasRef} isRunning={isRunning} onDetection={handleDetection} />

          <div className="video-overlay">
            <span className="overlay-badge live">● LIVE</span>
            <span className="overlay-badge detecting">🔍 DETECTING</span>
            <span className="overlay-badge" style={{ background: 'rgba(0,0,0,0.6)', color: '#94a3b8' }}>
              {fps} FPS
            </span>
          </div>

          <div className="video-count-overlay">
            <div className="count-total">{totalVehicles}</div>
            <div className="count-label">vehicles detected</div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(detections).filter(([, v]) => v > 0).map(([type, count]) => (
            <div key={type} className="stat-card" style={{ flex: '1 1 100px', padding: '10px 14px' }}>
              <span className="stat-label" style={{ fontSize: '0.7rem' }}>
                {type === 'car' ? '🚗' : type === 'truck' ? '🚛' : type === 'bus' ? '🚌' : type === 'motorcycle' ? '🏍️' : '🚲'} {type}
              </span>
              <span className="stat-value" style={{ fontSize: '1.4rem', color: VEHICLE_COLORS[type] }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="detection-sidebar">
        <div className="glass-card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Detection Status</h3>
          <div style={{ marginBottom: 12 }}>
            <CongestionBadge level={congestionLevel} score={densityScore} showScore size="lg" />
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Density</span>
              <span className="stat-value" style={{ fontSize: '1.2rem' }}>{(totalVehicles / 10).toFixed(1)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Score</span>
              <span className="stat-value" style={{ fontSize: '1.2rem' }}>{densityScore}</span>
            </div>
          </div>
        </div>

        <div className="detection-controls">
          <button className={`btn ${isRunning ? '' : 'btn-primary'}`} onClick={() => setIsRunning(!isRunning)}>
            {isRunning ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button className="btn" onClick={() => setLog([])}>🗑️ Clear Log</button>
        </div>

        <div className="detection-log">
          <h4>Detection Log</h4>
          {log.length === 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: 10 }}>
              Waiting for detections...
            </div>
          )}
          {log.map((entry, i) => (
            <div key={i} className="log-entry">
              <span className="log-time">{entry.time}</span>
              <span style={{ fontWeight: 600 }}>{entry.count} vehicles</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
