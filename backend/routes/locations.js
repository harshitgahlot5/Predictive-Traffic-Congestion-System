const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const { getDBStatus, getInMemoryDB } = require('../config/db');

// GET /api/locations - Get all locations
router.get('/', async (req, res, next) => {
  try {
    const { useInMemory } = getDBStatus();
    if (useInMemory) {
      return res.json({ success: true, data: getInMemoryDB().locations });
    }
    const locations = await Location.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: locations });
  } catch (err) { next(err); }
});

// GET /api/locations/:id - Get single location
router.get('/:id', async (req, res, next) => {
  try {
    const { useInMemory } = getDBStatus();
    if (useInMemory) {
      const loc = getInMemoryDB().locations.find(l => l._id === req.params.id);
      if (!loc) return res.status(404).json({ success: false, error: 'Location not found' });
      return res.json({ success: true, data: loc });
    }
    const location = await Location.findById(req.params.id);
    if (!location) return res.status(404).json({ success: false, error: 'Location not found' });
    res.json({ success: true, data: location });
  } catch (err) { next(err); }
});

// POST /api/locations - Add location
router.post('/', async (req, res, next) => {
  try {
    const { useInMemory } = getDBStatus();
    if (useInMemory) {
      const db = getInMemoryDB();
      const loc = { _id: `loc_${db.locations.length}`, ...req.body, isActive: true, createdAt: new Date() };
      db.locations.push(loc);
      return res.status(201).json({ success: true, data: loc });
    }
    const location = await Location.create(req.body);
    res.status(201).json({ success: true, data: location });
  } catch (err) { next(err); }
});

module.exports = router;
