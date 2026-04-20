/**
 * Prediction Engine Service
 * Sliding-window weighted regression for traffic congestion forecasting.
 * Predicts congestion 15, 30, and 45 minutes ahead.
 */

const TrafficData = require('../models/TrafficData');
const { getDBStatus, getInMemoryDB } = require('../config/db');
const { scoreToLevel } = require('./mockDataGenerator');

/**
 * Get historical data for prediction
 */
async function getHistoryForPrediction(locationId, hours = 4) {
  const { useInMemory } = getDBStatus();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  if (useInMemory) {
    const db = getInMemoryDB();
    return db.trafficData
      .filter(d => d.locationId === locationId && new Date(d.timestamp) >= since && !(d.prediction && d.prediction.isPredicted))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  return TrafficData.find({
    locationId,
    timestamp: { $gte: since },
    'prediction.isPredicted': false
  }).sort({ timestamp: 1 }).lean();
}

/**
 * Exponential weighted moving average
 */
function ewma(values, alpha = 0.3) {
  if (values.length === 0) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result;
  }
  return result;
}

/**
 * Calculate trend (slope) from recent values
 */
function calculateTrend(values) {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return isNaN(slope) ? 0 : slope;
}

/**
 * Time-of-day seasonality adjustment
 * Returns expected congestion multiplier for a given hour
 */
function getSeasonalFactor(hour) {
  const factors = {
    0: 0.15, 1: 0.10, 2: 0.08, 3: 0.07, 4: 0.10, 5: 0.20,
    6: 0.40, 7: 0.65, 8: 0.85, 9: 0.90, 10: 0.60, 11: 0.50,
    12: 0.55, 13: 0.58, 14: 0.50, 15: 0.55, 16: 0.70, 17: 0.88,
    18: 0.92, 19: 0.75, 20: 0.50, 21: 0.35, 22: 0.25, 23: 0.18
  };
  return factors[hour] || 0.5;
}

/**
 * Generate predictions for a location
 * @param {string} locationId
 * @returns {Array} Predictions for 15, 30, 45 minutes ahead
 */
async function generatePredictions(locationId) {
  const history = await getHistoryForPrediction(locationId, 4);

  if (history.length < 6) {
    // Not enough data — return simple persistence forecast
    const lastScore = history.length > 0 ? history[history.length - 1].congestionScore : 30;
    return [15, 30, 45].map(horizon => ({
      horizonMinutes: horizon,
      predictedScore: lastScore,
      predictedLevel: scoreToLevel(lastScore),
      confidence: 0.3,
      method: 'persistence'
    }));
  }

  const scores = history.map(d => d.congestionScore || 0);
  const speeds = history.map(d => d.avgSpeed || 0);
  const densities = history.map(d => d.vehicleDensity || 0);

  // Current values
  const currentScore = scores[scores.length - 1];
  const currentSpeed = speeds[speeds.length - 1];

  // EWMA of recent scores
  const recentScores = scores.slice(-12);
  const ewmaScore = ewma(recentScores, 0.35);

  // Trend from last 6 readings
  const trend = calculateTrend(scores.slice(-6));

  // Speed trend
  const speedTrend = calculateTrend(speeds.slice(-6));

  const predictions = [];
  const horizons = [15, 30, 45];

  for (const horizon of horizons) {
    const stepsAhead = horizon / 5; // 5-min intervals
    const now = new Date();
    const futureTime = new Date(now.getTime() + horizon * 60 * 1000);
    const futureHour = futureTime.getHours();

    // Seasonal adjustment
    const currentSeasonal = getSeasonalFactor(now.getHours());
    const futureSeasonal = getSeasonalFactor(futureHour);
    const seasonalShift = (futureSeasonal - currentSeasonal) * 50;

    // Trend projection
    const trendProjection = trend * stepsAhead;

    // Weighted combination
    let predicted = ewmaScore * 0.5 + currentScore * 0.3 + (ewmaScore + trendProjection) * 0.2 + seasonalShift;

    // Speed-based adjustment: if speed is dropping, congestion likely rising
    if (speedTrend < -2) {
      predicted += Math.abs(speedTrend) * stepsAhead * 0.5;
    }

    // Clamp
    predicted = Math.max(0, Math.min(100, predicted));
    predicted = Math.round(predicted * 10) / 10;

    // Confidence decreases with horizon
    const baseConfidence = history.length > 20 ? 0.85 : 0.65;
    const confidence = Math.round(Math.max(0.3, baseConfidence - horizon * 0.008) * 100) / 100;

    predictions.push({
      horizonMinutes: horizon,
      predictedScore: predicted,
      predictedLevel: scoreToLevel(predicted),
      confidence,
      method: 'weighted_regression',
      timestamp: futureTime
    });
  }

  return predictions;
}

/**
 * Generate and store predictions for all locations
 */
async function generateAllPredictions(locations) {
  const { useInMemory } = getDBStatus();
  const allPredictions = {};

  for (const loc of locations) {
    const locId = useInMemory ? loc._id : loc._id.toString();
    const preds = await generatePredictions(locId);
    allPredictions[locId] = preds;
  }

  return allPredictions;
}

module.exports = { generatePredictions, generateAllPredictions, ewma, calculateTrend, getSeasonalFactor };
