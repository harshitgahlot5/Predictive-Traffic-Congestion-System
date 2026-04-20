/**
 * Data Fusion Service
 * Combines camera-based vehicle detection data with maps API traffic data
 * to produce unified congestion readings with improved accuracy.
 */

const { scoreToLevel } = require('./mockDataGenerator');

// Weights for data fusion
const CAMERA_WEIGHT = 0.6;
const MAPS_WEIGHT = 0.4;

/**
 * Normalize vehicle density to a 0-100 scale
 * @param {number} density - Raw vehicle density (vehicles per unit area)
 * @param {string} roadType - Type of road
 * @returns {number} Normalized score 0-100
 */
function normalizeDensity(density, roadType = 'arterial') {
  const maxDensity = {
    highway: 12,
    arterial: 8,
    intersection: 10,
    residential: 5
  };
  const max = maxDensity[roadType] || 8;
  return Math.min(100, (density / max) * 100);
}

/**
 * Convert maps speed data to a congestion score
 * @param {number} speed - Current average speed (km/h)
 * @param {string} roadType - Type of road
 * @returns {number} Congestion score 0-100 (higher = more congested)
 */
function speedToCongestion(speed, roadType = 'arterial') {
  const freeFlowSpeed = {
    highway: 80,
    arterial: 50,
    intersection: 40,
    residential: 30
  };
  const maxSpeed = freeFlowSpeed[roadType] || 50;

  if (speed <= 0) return 100;
  if (speed >= maxSpeed) return 0;

  // Non-linear mapping: congestion rises sharply at low speeds
  const ratio = speed / maxSpeed;
  return Math.round((1 - Math.pow(ratio, 0.7)) * 100);
}

/**
 * Convert maps flow category to a score
 */
function flowCategoryToScore(category) {
  const scores = {
    free_flow: 10,
    moderate: 40,
    heavy: 70,
    stop_and_go: 92
  };
  return scores[category] || 50;
}

/**
 * Fuse camera and maps data into a unified reading
 * @param {Object} cameraData - { vehicleCount, vehicleDensity, flowRate, vehicles: {car, truck, ...} }
 * @param {Object} mapsData - { avgSpeed, flowCategory }
 * @param {string} roadType - Type of road
 * @returns {Object} Fused traffic reading
 */
function fuseData(cameraData, mapsData, roadType = 'arterial') {
  // Camera-based congestion score
  const cameraDensityScore = normalizeDensity(cameraData.vehicleDensity, roadType);

  // Flow rate contribution (low flow + high density = congestion)
  const flowPenalty = cameraData.flowRate < 2 && cameraData.vehicleDensity > 3 ? 15 : 0;
  const cameraScore = Math.min(100, cameraDensityScore + flowPenalty);

  // Maps-based congestion score
  const mapsSpeedScore = speedToCongestion(mapsData.avgSpeed, roadType);
  const mapsFlowScore = flowCategoryToScore(mapsData.flowCategory);
  const mapsScore = mapsSpeedScore * 0.6 + mapsFlowScore * 0.4;

  // Weighted fusion
  let fusedScore = cameraScore * CAMERA_WEIGHT + mapsScore * MAPS_WEIGHT;

  // Agreement bonus: if both sources agree, increase confidence
  const agreement = Math.abs(cameraScore - mapsScore);
  const confidence = agreement < 15 ? 0.9 : agreement < 30 ? 0.75 : 0.6;

  // Disagreement correction: if one source shows much higher,
  // bias toward the higher reading for safety
  if (agreement > 25) {
    fusedScore = Math.max(fusedScore, Math.min(cameraScore, mapsScore) + agreement * 0.3);
  }

  fusedScore = Math.max(0, Math.min(100, Math.round(fusedScore * 10) / 10));

  // Compute fused speed estimate
  const fusedSpeed = mapsData.avgSpeed; // Maps speed is more reliable

  return {
    congestionScore: fusedScore,
    congestionLevel: scoreToLevel(fusedScore),
    avgSpeed: Math.round(fusedSpeed * 10) / 10,
    vehicleCount: cameraData.vehicleCount,
    vehicleDensity: cameraData.vehicleDensity,
    flowRate: cameraData.flowRate,
    confidence,
    source: 'fused',
    rawData: {
      cameraVehicles: cameraData.vehicles || {},
      mapsSpeed: mapsData.avgSpeed,
      mapsFlowCategory: mapsData.flowCategory
    }
  };
}

/**
 * Quick fuse from a single congestion score and speed
 * Used when we don't have separate camera/maps sources
 */
function quickFuse(congestionScore, avgSpeed, roadType) {
  const speedScore = speedToCongestion(avgSpeed, roadType);
  const fused = congestionScore * 0.7 + speedScore * 0.3;
  return {
    congestionScore: Math.round(Math.max(0, Math.min(100, fused)) * 10) / 10,
    congestionLevel: scoreToLevel(fused)
  };
}

module.exports = {
  fuseData,
  quickFuse,
  normalizeDensity,
  speedToCongestion,
  flowCategoryToScore,
  CAMERA_WEIGHT,
  MAPS_WEIGHT
};
