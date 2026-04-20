const express = require('express');
const router = express.Router();
const TrafficData = require('../models/TrafficData');
const Location = require('../models/Location');
const { getDBStatus, getInMemoryDB } = require('../config/db');
const { fuseData } = require('../services/dataFusion');
const { detectAnomalies } = require('../services/anomalyDetector');

// GET /api/traffic/latest - Latest reading for all locations
router.get('/latest', async (req, res, next) => {
  try {
    const { useInMemory } = getDBStatus();

    if (useInMemory) {
      const db = getInMemoryDB();
      const latestMap = {};
      db.trafficData
        .filter(d => !(d.prediction && d.prediction.isPredicted))
        .forEach(d => {
          if (!latestMap[d.locationId] || new Date(d.timestamp) > new Date(latestMap[d.locationId].timestamp)) {
            latestMap[d.locationId] = d;
          }
        });
      const latest = Object.values(latestMap);
      // Attach location info
      const result = latest.map(td => {
        const loc = db.locations.find(l => l._id === td.locationId);
        return { ...td, location: loc || null };
      });
      return res.json({ success: true, data: result, count: result.length });
    }

    const locations = await Location.find({ isActive: true });
    const locationIds = locations.map(l => l._id);
    const latest = await TrafficData.getLatestForAllLocations(locationIds);

    const result = latest.map(td => {
      const loc = locations.find(l => l._id.toString() === td.locationId.toString());
      return { ...td, location: loc ? loc.toObject() : null };
    });

    res.json({ success: true, data: result, count: result.length });
  } catch (err) { next(err); }
});

// GET /api/traffic/location/:id - Recent data for a location
router.get('/location/:id', async (req, res, next) => {
  try {
    const { useInMemory } = getDBStatus();
    const hours = parseInt(req.query.hours) || 6;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (useInMemory) {
      const db = getInMemoryDB();
      const data = db.trafficData
        .filter(d => d.locationId === req.params.id && new Date(d.timestamp) >= since && !(d.prediction && d.prediction.isPredicted))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return res.json({ success: true, data, count: data.length });
    }

    const data = await TrafficData.find({
      locationId: req.params.id,
      timestamp: { $gte: since },
      'prediction.isPredicted': false
    }).sort({ timestamp: 1 });

    res.json({ success: true, data, count: data.length });
  } catch (err) { next(err); }
});

// GET /api/traffic/location/:id/history - Aggregated history
router.get('/location/:id/history', async (req, res, next) => {
  try {
    const { useInMemory } = getDBStatus();
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (useInMemory) {
      const db = getInMemoryDB();
      const data = db.trafficData
        .filter(d => d.locationId === req.params.id && new Date(d.timestamp) >= since && !(d.prediction && d.prediction.isPredicted))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Aggregate by hour
      const hourly = {};
      data.forEach(d => {
        const h = new Date(d.timestamp).getHours();
        if (!hourly[h]) hourly[h] = { scores: [], speeds: [], counts: [] };
        hourly[h].scores.push(d.congestionScore);
        hourly[h].speeds.push(d.avgSpeed);
        hourly[h].counts.push(d.vehicleCount);
      });

      const aggregated = Object.entries(hourly).map(([hour, vals]) => ({
        hour: parseInt(hour),
        avgScore: Math.round(vals.scores.reduce((a, b) => a + b, 0) / vals.scores.length * 10) / 10,
        avgSpeed: Math.round(vals.speeds.reduce((a, b) => a + b, 0) / vals.speeds.length * 10) / 10,
        avgCount: Math.round(vals.counts.reduce((a, b) => a + b, 0) / vals.counts.length),
        readings: vals.scores.length
      })).sort((a, b) => a.hour - b.hour);

      return res.json({ success: true, data: aggregated });
    }

    const data = await TrafficData.find({
      locationId: req.params.id,
      timestamp: { $gte: since },
      'prediction.isPredicted': false
    }).sort({ timestamp: 1 }).lean();

    const hourly = {};
    data.forEach(d => {
      const h = new Date(d.timestamp).getHours();
      if (!hourly[h]) hourly[h] = { scores: [], speeds: [], counts: [] };
      hourly[h].scores.push(d.congestionScore);
      hourly[h].speeds.push(d.avgSpeed);
      hourly[h].counts.push(d.vehicleCount);
    });

    const aggregated = Object.entries(hourly).map(([hour, vals]) => ({
      hour: parseInt(hour),
      avgScore: Math.round(vals.scores.reduce((a, b) => a + b, 0) / vals.scores.length * 10) / 10,
      avgSpeed: Math.round(vals.speeds.reduce((a, b) => a + b, 0) / vals.speeds.length * 10) / 10,
      avgCount: Math.round(vals.counts.reduce((a, b) => a + b, 0) / vals.counts.length),
      readings: vals.scores.length
    })).sort((a, b) => a.hour - b.hour);

    res.json({ success: true, data: aggregated });
  } catch (err) { next(err); }
});

// POST /api/traffic/upload - Upload camera detection results
router.post('/upload', async (req, res, next) => {
  try {
    const { locationId, vehicles, density, flowRate } = req.body;
    if (!locationId) return res.status(400).json({ success: false, error: 'locationId required' });

    const cameraData = {
      vehicleCount: Object.values(vehicles || {}).reduce((a, b) => a + b, 0),
      vehicleDensity: density || 0,
      flowRate: flowRate || 0,
      vehicles: vehicles || {}
    };

    const mapsData = { avgSpeed: req.body.avgSpeed || 30, flowCategory: req.body.flowCategory || 'moderate' };
    const fused = fuseData(cameraData, mapsData, req.body.roadType || 'arterial');
    const anomaly = await detectAnomalies({ ...fused, locationId, timestamp: new Date() });

    const record = {
      locationId,
      timestamp: new Date(),
      source: 'fused',
      vehicleCount: fused.vehicleCount,
      vehicleDensity: fused.vehicleDensity,
      flowRate: fused.flowRate,
      avgSpeed: fused.avgSpeed,
      congestionLevel: fused.congestionLevel,
      congestionScore: fused.congestionScore,
      anomaly,
      prediction: { isPredicted: false },
      rawData: fused.rawData
    };

    const { useInMemory } = getDBStatus();
    if (useInMemory) {
      const db = getInMemoryDB();
      record._id = `td_${db.trafficData.length}`;
      db.trafficData.push(record);
    } else {
      await TrafficData.create(record);
    }

    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

module.exports = router;
