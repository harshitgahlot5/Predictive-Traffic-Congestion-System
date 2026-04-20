/**
 * Mock Data Generator Service
 * Generates realistic traffic data with rush-hour patterns,
 * noise, and occasional anomalies for demo purposes.
 */

const Location = require('../models/Location');
const TrafficData = require('../models/TrafficData');
const { getDBStatus, getInMemoryDB } = require('../config/db');

// Predefined monitoring locations (Bengaluru, India)
const SEED_LOCATIONS = [
  {
    name: 'Silk Board Junction',
    lat: 12.9170,
    lng: 77.6230,
    type: 'intersection',
    cameraId: 'CAM-SBJ001',
    description: 'One of the busiest junctions in Bengaluru'
  },
  {
    name: 'KR Puram Bridge',
    lat: 13.0070,
    lng: 77.6870,
    type: 'highway',
    cameraId: 'CAM-KRP002',
    description: 'Major highway bridge connecting east Bengaluru'
  },
  {
    name: 'Marathahalli Bridge',
    lat: 12.9565,
    lng: 77.7010,
    type: 'arterial',
    cameraId: 'CAM-MTH003',
    description: 'Key arterial road near Outer Ring Road'
  },
  {
    name: 'Hebbal Flyover',
    lat: 13.0358,
    lng: 77.5970,
    type: 'highway',
    cameraId: 'CAM-HBL004',
    description: 'Highway flyover connecting NH-44'
  },
  {
    name: 'Electronic City Toll',
    lat: 12.8456,
    lng: 77.6603,
    type: 'highway',
    cameraId: 'CAM-ECT005',
    description: 'Toll plaza on Hosur Road elevated expressway'
  },
  {
    name: 'MG Road Metro',
    lat: 12.9757,
    lng: 77.6062,
    type: 'arterial',
    cameraId: 'CAM-MGR006',
    description: 'Central business district arterial road'
  },
  {
    name: 'Bannerghatta Road',
    lat: 12.8915,
    lng: 77.5965,
    type: 'arterial',
    cameraId: 'CAM-BGR007',
    description: 'Major south Bengaluru corridor'
  },
  {
    name: 'Whitefield Main Road',
    lat: 12.9698,
    lng: 77.7500,
    type: 'intersection',
    cameraId: 'CAM-WFD008',
    description: 'IT hub intersection with heavy tech-park traffic'
  }
];

/**
 * Generate a congestion score based on time of day with realistic patterns
 * Uses sinusoidal functions to model rush hour peaks
 */
function generateCongestionScore(hour, minute, locationType) {
  const timeDecimal = hour + minute / 60;

  // Morning rush: peak at 9 AM
  const morningPeak = 75 * Math.exp(-0.5 * Math.pow((timeDecimal - 9) / 1.5, 2));

  // Evening rush: peak at 6 PM (wider and taller)
  const eveningPeak = 85 * Math.exp(-0.5 * Math.pow((timeDecimal - 18) / 2, 2));

  // Lunch hour small bump
  const lunchBump = 30 * Math.exp(-0.5 * Math.pow((timeDecimal - 13) / 1, 2));

  // Base level (overnight is low ~5-10, daytime ~15-25)
  const baseLine = 10 + 10 * Math.sin((timeDecimal - 6) * Math.PI / 18);

  let score = Math.max(baseLine, morningPeak, eveningPeak, lunchBump);

  // Location type multiplier
  const typeMultipliers = {
    intersection: 1.15,
    highway: 0.9,
    arterial: 1.0,
    residential: 0.6
  };
  score *= (typeMultipliers[locationType] || 1.0);

  // Add Gaussian noise (±10%)
  const noise = (Math.random() - 0.5) * score * 0.2;
  score = Math.max(0, Math.min(100, score + noise));

  return Math.round(score * 10) / 10;
}

/**
 * Map congestion score to level
 */
function scoreToLevel(score) {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'standstill';
}

/**
 * Map congestion score to maps flow category
 */
function scoreToFlowCategory(score) {
  if (score < 25) return 'free_flow';
  if (score < 50) return 'moderate';
  if (score < 75) return 'heavy';
  return 'stop_and_go';
}

/**
 * Generate vehicle breakdown based on congestion score
 */
function generateVehicleBreakdown(score) {
  const totalBase = 5 + Math.round(score * 0.8);
  const total = Math.max(3, totalBase + Math.round((Math.random() - 0.5) * 10));

  return {
    car: Math.max(0, Math.round(total * 0.55 + (Math.random() - 0.5) * 4)),
    truck: Math.max(0, Math.round(total * 0.12 + (Math.random() - 0.5) * 2)),
    bus: Math.max(0, Math.round(total * 0.10 + (Math.random() - 0.5) * 2)),
    motorcycle: Math.max(0, Math.round(total * 0.18 + (Math.random() - 0.5) * 3)),
    bicycle: Math.max(0, Math.round(total * 0.05 + (Math.random() - 0.5) * 1))
  };
}

/**
 * Generate an anomaly (5% chance)
 */
function generateAnomaly(score) {
  const shouldAnomaly = Math.random() < 0.05;
  if (!shouldAnomaly) {
    return { detected: false, type: 'none', confidence: 0 };
  }

  const types = ['accident', 'stalled', 'unusual_congestion', 'road_work'];
  const weights = score > 60
    ? [0.4, 0.25, 0.25, 0.1]  // High congestion: more accidents
    : [0.15, 0.15, 0.5, 0.2]; // Low congestion: more unusual patterns

  let rand = Math.random();
  let selectedType = types[0];
  let cumulative = 0;
  for (let i = 0; i < types.length; i++) {
    cumulative += weights[i];
    if (rand <= cumulative) {
      selectedType = types[i];
      break;
    }
  }

  return {
    detected: true,
    type: selectedType,
    confidence: 0.6 + Math.random() * 0.35
  };
}

/**
 * Generate a single traffic data reading
 */
function generateReading(locationId, locationType, timestamp) {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();

  const congestionScore = generateCongestionScore(hour, minute, locationType);
  const level = scoreToLevel(congestionScore);
  const vehicles = generateVehicleBreakdown(congestionScore);
  const totalVehicles = Object.values(vehicles).reduce((a, b) => a + b, 0);

  // Speed inversely correlated with congestion
  const maxSpeed = locationType === 'highway' ? 100 : 60;
  const avgSpeed = Math.max(2, maxSpeed * (1 - congestionScore / 110) + (Math.random() - 0.5) * 8);

  // Flow rate: vehicles per minute
  const flowRate = congestionScore > 85
    ? Math.max(0.5, 2 + Math.random() * 2)  // Standstill = very low flow
    : Math.max(1, totalVehicles / 5 * (1 - congestionScore / 150) + Math.random() * 3);

  return {
    locationId,
    timestamp: date,
    source: 'fused',
    vehicleCount: totalVehicles,
    vehicleDensity: Math.round((totalVehicles / 10) * 100) / 100,
    flowRate: Math.round(flowRate * 100) / 100,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    congestionLevel: level,
    congestionScore,
    anomaly: generateAnomaly(congestionScore),
    prediction: { isPredicted: false, horizonMinutes: 0, predictedLevel: '', predictedScore: 0, confidence: 0 },
    rawData: {
      cameraVehicles: vehicles,
      mapsSpeed: Math.round(avgSpeed * (0.95 + Math.random() * 0.1) * 10) / 10,
      mapsFlowCategory: scoreToFlowCategory(congestionScore)
    }
  };
}

/**
 * Seed locations into DB
 */
async function seedLocations() {
  const { useInMemory } = getDBStatus();

  if (useInMemory) {
    const db = getInMemoryDB();
    db.locations = SEED_LOCATIONS.map((loc, i) => ({
      _id: `loc_${i}`,
      ...loc,
      isActive: true,
      city: 'Bengaluru',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    console.log(`📍 Seeded ${db.locations.length} locations (in-memory)`);
    return db.locations;
  }

  // MongoDB: upsert locations
  const locations = [];
  for (const loc of SEED_LOCATIONS) {
    const existing = await Location.findOneAndUpdate(
      { cameraId: loc.cameraId },
      { ...loc, isActive: true, city: 'Bengaluru' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    locations.push(existing);
  }
  console.log(`📍 Seeded ${locations.length} locations`);
  return locations;
}

/**
 * Seed 24 hours of historical data for all locations
 */
async function seedHistoricalData(locations) {
  const { useInMemory } = getDBStatus();
  const now = Date.now();
  const readings = [];

  // Generate data every 5 minutes for past 24 hours
  for (const loc of locations) {
    const locId = useInMemory ? loc._id : loc._id;
    for (let minsAgo = 24 * 60; minsAgo >= 0; minsAgo -= 5) {
      const timestamp = now - minsAgo * 60 * 1000;
      readings.push(generateReading(locId, loc.type, timestamp));
    }
  }

  if (useInMemory) {
    const db = getInMemoryDB();
    db.trafficData = readings.map((r, i) => ({ _id: `td_${i}`, ...r }));
    console.log(`📊 Seeded ${readings.length} historical readings (in-memory)`);
  } else {
    // Clear old mock data and insert fresh
    await TrafficData.deleteMany({});
    // Insert in batches of 500
    for (let i = 0; i < readings.length; i += 500) {
      await TrafficData.insertMany(readings.slice(i, i + 500));
    }
    console.log(`📊 Seeded ${readings.length} historical readings`);
  }

  return readings.length;
}

/**
 * Generate a new batch of readings (called every 5 mins by cron)
 */
async function generateNewReadings(locations) {
  const { useInMemory } = getDBStatus();
  const now = new Date();
  const newReadings = [];

  for (const loc of locations) {
    const locId = useInMemory ? loc._id : loc._id;
    const reading = generateReading(locId, loc.type, now);
    newReadings.push(reading);
  }

  if (useInMemory) {
    const db = getInMemoryDB();
    const startId = db.trafficData.length;
    newReadings.forEach((r, i) => {
      db.trafficData.push({ _id: `td_${startId + i}`, ...r });
    });
    // Keep only last 24 hours in memory
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    db.trafficData = db.trafficData.filter(d => new Date(d.timestamp).getTime() > cutoff);
  } else {
    await TrafficData.insertMany(newReadings);
    // Clean up data older than 48 hours
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await TrafficData.deleteMany({ timestamp: { $lt: cutoff } });
  }

  return newReadings;
}

/**
 * Full seed pipeline
 */
async function seedAll() {
  console.log('🌱 Starting data seeding...');
  const locations = await seedLocations();
  const count = await seedHistoricalData(locations);
  console.log(`✅ Seeding complete. ${count} readings across ${locations.length} locations.`);
  return locations;
}

module.exports = {
  seedAll,
  seedLocations,
  seedHistoricalData,
  generateNewReadings,
  generateReading,
  generateCongestionScore,
  scoreToLevel,
  SEED_LOCATIONS
};
