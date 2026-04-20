const express = require('express');
const router = express.Router();
const { generatePredictions } = require('../services/predictionEngine');
const { getDBStatus, getInMemoryDB } = require('../config/db');
const Location = require('../models/Location');

// GET /api/predictions/:locationId - Get predictions for a location
router.get('/:locationId', async (req, res, next) => {
  try {
    const predictions = await generatePredictions(req.params.locationId);
    res.json({ success: true, data: predictions, locationId: req.params.locationId });
  } catch (err) { next(err); }
});

// POST /api/predictions/generate - Generate predictions for all locations
router.post('/generate', async (req, res, next) => {
  try {
    const { useInMemory } = getDBStatus();
    let locations;

    if (useInMemory) {
      locations = getInMemoryDB().locations;
    } else {
      locations = await Location.find({ isActive: true });
    }

    const allPredictions = {};
    for (const loc of locations) {
      const locId = useInMemory ? loc._id : loc._id.toString();
      allPredictions[locId] = await generatePredictions(locId);
    }

    res.json({
      success: true,
      data: allPredictions,
      count: Object.keys(allPredictions).length,
      generatedAt: new Date()
    });
  } catch (err) { next(err); }
});

module.exports = router;
