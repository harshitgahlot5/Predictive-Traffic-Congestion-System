/**
 * Anomaly Detection Service
 * Uses statistical methods to identify traffic anomalies.
 */

const TrafficData = require('../models/TrafficData');
const { getDBStatus, getInMemoryDB } = require('../config/db');

function stats(arr) {
  if (arr.length === 0) return { mean: 0, std: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return { mean, std: Math.sqrt(variance) };
}

function zScore(value, mean, std) {
  if (std === 0) return 0;
  return (value - mean) / std;
}

async function getRecentReadings(locationId, count = 12) {
  const { useInMemory } = getDBStatus();
  if (useInMemory) {
    const db = getInMemoryDB();
    return db.trafficData
      .filter(d => d.locationId === locationId && !(d.prediction && d.prediction.isPredicted))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, count);
  }
  return TrafficData.find({ locationId, 'prediction.isPredicted': false })
    .sort({ timestamp: -1 }).limit(count).lean();
}

async function getHistoricalBaseline(locationId, currentHour) {
  const { useInMemory } = getDBStatus();
  if (useInMemory) {
    const db = getInMemoryDB();
    return db.trafficData.filter(d => {
      if (d.locationId !== locationId) return false;
      if (d.prediction && d.prediction.isPredicted) return false;
      const h = new Date(d.timestamp).getHours();
      return Math.abs(h - currentHour) <= 1 || Math.abs(h - currentHour) >= 23;
    });
  }
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const data = await TrafficData.find({
    locationId, timestamp: { $gte: since }, 'prediction.isPredicted': false
  }).lean();
  return data.filter(d => {
    const h = new Date(d.timestamp).getHours();
    return Math.abs(h - currentHour) <= 1 || Math.abs(h - currentHour) >= 23;
  });
}

async function detectAnomalies(reading) {
  const locationId = reading.locationId;
  const currentHour = new Date(reading.timestamp || Date.now()).getHours();
  const [historicalData, recentData] = await Promise.all([
    getHistoricalBaseline(locationId, currentHour),
    getRecentReadings(locationId, 12)
  ]);
  const anomalies = [];

  // Rule 1: Density Z-Score
  if (historicalData.length > 5) {
    const densities = historicalData.map(d => d.vehicleDensity || 0);
    const s = stats(densities);
    const z = zScore(reading.vehicleDensity || 0, s.mean, s.std);
    if (Math.abs(z) > 2.5) {
      anomalies.push({ type: 'unusual_congestion', confidence: Math.min(0.95, 0.5 + Math.abs(z) * 0.1), detail: `Density Z-score: ${z.toFixed(2)}` });
    }
  }

  // Rule 2: Sudden speed drop (accident)
  if (recentData.length >= 6) {
    const recentAvg = stats(recentData.slice(0, 3).map(d => d.avgSpeed || 0)).mean;
    const olderAvg = stats(recentData.slice(3, 6).map(d => d.avgSpeed || 0)).mean;
    if (olderAvg > 10 && recentAvg < olderAvg * 0.4) {
      anomalies.push({ type: 'accident', confidence: Math.min(0.92, 0.6 + (1 - recentAvg / olderAvg) * 0.3), detail: `Speed dropped from ${olderAvg.toFixed(1)} to ${recentAvg.toFixed(1)}` });
    }
  }

  // Rule 3: High density + zero flow (stalled)
  if (reading.vehicleDensity > 5 && reading.flowRate < 1.5) {
    anomalies.push({ type: 'stalled', confidence: Math.min(0.88, 0.5 + reading.vehicleDensity * 0.03), detail: `High density with low flow` });
  }

  // Rule 4: Score spike
  if (recentData.length >= 4) {
    const recentMean = stats(recentData.slice(1).map(d => d.congestionScore || 0)).mean;
    if (reading.congestionScore > recentMean + 30 && reading.congestionScore > 60) {
      anomalies.push({ type: 'unusual_congestion', confidence: 0.7, detail: `Score spiked to ${reading.congestionScore}` });
    }
  }

  if (anomalies.length === 0) return { detected: false, type: 'none', confidence: 0, details: '' };
  anomalies.sort((a, b) => b.confidence - a.confidence);
  const best = anomalies[0];
  return { detected: true, type: best.type, confidence: Math.round(best.confidence * 100) / 100, details: best.detail };
}

module.exports = { detectAnomalies, stats, zScore };
