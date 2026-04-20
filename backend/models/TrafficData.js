const mongoose = require('mongoose');

const trafficDataSchema = new mongoose.Schema({
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    enum: ['camera', 'maps', 'fused'],
    default: 'fused'
  },
  vehicleCount: {
    type: Number,
    default: 0,
    min: 0
  },
  vehicleDensity: {
    type: Number,
    default: 0,
    min: 0
  },
  flowRate: {
    type: Number,
    default: 0,
    min: 0
  },
  avgSpeed: {
    type: Number,
    default: 0,
    min: 0
  },
  congestionLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'standstill'],
    default: 'low'
  },
  congestionScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  anomaly: {
    detected: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['none', 'accident', 'stalled', 'unusual_congestion', 'road_work'],
      default: 'none'
    },
    confidence: { type: Number, default: 0, min: 0, max: 1 }
  },
  prediction: {
    isPredicted: { type: Boolean, default: false },
    horizonMinutes: { type: Number, default: 0 },
    predictedLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'standstill', ''],
      default: ''
    },
    predictedScore: { type: Number, default: 0 },
    confidence: { type: Number, default: 0, min: 0, max: 1 }
  },
  rawData: {
    cameraVehicles: {
      car: { type: Number, default: 0 },
      truck: { type: Number, default: 0 },
      bus: { type: Number, default: 0 },
      motorcycle: { type: Number, default: 0 },
      bicycle: { type: Number, default: 0 }
    },
    mapsSpeed: { type: Number, default: 0 },
    mapsFlowCategory: {
      type: String,
      enum: ['free_flow', 'moderate', 'heavy', 'stop_and_go', ''],
      default: ''
    }
  }
}, {
  timestamps: true
});

// Compound index for efficient time-range queries per location
trafficDataSchema.index({ locationId: 1, timestamp: -1 });
trafficDataSchema.index({ timestamp: -1 });

// Static method: get latest reading for each location
trafficDataSchema.statics.getLatestForAllLocations = async function (locationIds) {
  const results = await this.aggregate([
    {
      $match: {
        locationId: { $in: locationIds },
        'prediction.isPredicted': false
      }
    },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$locationId',
        doc: { $first: '$$ROOT' }
      }
    },
    { $replaceRoot: { newRoot: '$doc' } }
  ]);
  return results;
};

// Static method: get history for a location
trafficDataSchema.statics.getHistory = async function (locationId, hours = 6) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    locationId,
    timestamp: { $gte: since },
    'prediction.isPredicted': false
  }).sort({ timestamp: 1 });
};

module.exports = mongoose.model('TrafficData', trafficDataSchema);
