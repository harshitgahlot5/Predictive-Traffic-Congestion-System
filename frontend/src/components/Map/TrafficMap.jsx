import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLevelInfo } from '../../utils/congestionLevels';
import CongestionBadge from '../common/CongestionBadge';
import './TrafficMap.css';

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;

function createMarkerIcon(level, isPredicted = false) {
  const info = getLevelInfo(level);
  const size = 28;
  const color = info.markerColor;
  const opacity = isPredicted ? '0.6' : '1';
  const glow = isPredicted ? '' : `<circle cx="${size/2}" cy="${size/2}" r="${size/2 + 4}" fill="none" stroke="${color}" stroke-opacity="0.25" stroke-width="3"/>`;

  const svg = `
    <svg width="${size + 10}" height="${size + 10}" xmlns="http://www.w3.org/2000/svg">
      ${glow}
      <circle cx="${(size+10)/2}" cy="${(size+10)/2}" r="${size/2 - 1}" fill="${color}" fill-opacity="${opacity}"
        stroke="rgba(255,255,255,0.5)" stroke-width="2.5" stroke-dasharray="${isPredicted ? '4,3' : 'none'}"/>
      <circle cx="${(size+10)/2}" cy="${(size+10)/2}" r="${size/5}" fill="rgba(255,255,255,0.5)"/>
    </svg>
  `;

  const totalSize = size + 10;
  return L.divIcon({
    html: `<div class="traffic-marker ${isPredicted ? 'predicted' : 'live'}" 
      style="width:${totalSize}px;height:${totalSize}px;--pulse-color:${color}40">${svg}</div>`,
    className: '',
    iconSize: [totalSize, totalSize],
    iconAnchor: [totalSize/2, totalSize/2],
    popupAnchor: [0, -totalSize/2 - 4]
  });
}

function MapBounds({ locations }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (locations.length > 0 && !hasFitted.current) {
      const bounds = L.latLngBounds(locations.map(l => {
        const loc = l.location || l;
        return [loc.lat, loc.lng];
      }));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
      hasFitted.current = true;
    }
  }, [locations, map]);

  return null;
}

export default function TrafficMap({ trafficData = [], predictions = {}, onLocationSelect, selectedId, theme }) {
  const center = [12.9716, 77.5946]; // Bengaluru center
  
  const tileUrl = theme === 'light' 
    ? "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
    : "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png";

  return (
    <div className="traffic-map-container" id="traffic-map">
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}
        zoomControl={true} attributionControl={false}>
        <TileLayer
          url={tileUrl}
          attribution='&copy; Stadia Maps'
        />

        {trafficData.length > 0 && <MapBounds locations={trafficData} />}

        {trafficData.map((item, idx) => {
          const loc = item.location || item;
          if (!loc || !loc.lat || !loc.lng) return null;
          const level = item.congestionLevel || 'low';
          const locId = loc._id || loc.cameraId || idx;

          return (
            <Marker key={`real-${locId}`} position={[loc.lat, loc.lng]}
              icon={createMarkerIcon(level, false)}>
              <Popup>
                <div className="marker-popup">
                  <h3>{loc.name || 'Unknown'}</h3>
                  <CongestionBadge level={level} score={item.congestionScore} showScore />
                  <div className="popup-stats" style={{ marginTop: 10 }}>
                    <span className="popup-stat-label">Vehicles</span>
                    <span className="popup-stat-value">{item.vehicleCount || 0}</span>
                    <span className="popup-stat-label">Speed</span>
                    <span className="popup-stat-value">{item.avgSpeed?.toFixed(1) || 0} km/h</span>
                    <span className="popup-stat-label">Flow Rate</span>
                    <span className="popup-stat-value">{item.flowRate?.toFixed(1) || 0}/min</span>
                    <span className="popup-stat-label">Density</span>
                    <span className="popup-stat-value">{item.vehicleDensity?.toFixed(2) || 0}</span>
                  </div>
                  {item.anomaly?.detected && (
                    <div style={{ marginTop: 8, padding: '4px 8px', background: 'var(--traffic-high-bg)',
                      borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--traffic-high)' }}>
                      ⚠️ {item.anomaly.type?.replace('_', ' ')} detected
                    </div>
                  )}
                  <button className="btn btn-primary popup-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (onLocationSelect) onLocationSelect(item);
                    }}>
                    View Details →
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="map-legend">
        <h4>Congestion Levels</h4>
        {['low', 'medium', 'high', 'standstill'].map(level => {
          const info = getLevelInfo(level);
          return (
            <div key={level} className="legend-item">
              <div className="legend-dot" style={{ background: info.markerColor }}></div>
              <span>{info.label}</span>
            </div>
          );
        })}
        <div className="legend-divider"></div>
        <div className="legend-item predicted">
          <div className="legend-dot" style={{ background: 'var(--accent-blue)', borderStyle: 'dashed' }}></div>
          <span>Predicted</span>
        </div>
      </div>
    </div>
  );
}
