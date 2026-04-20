const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true
  },
  lat: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: -90,
    max: 90
  },
  lng: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: -180,
    max: 180
  },
  cameraId: {
    type: String,
    unique: true,
    default: function () {
      return 'CAM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  },
  type: {
    type: String,
    enum: ['intersection', 'highway', 'arterial', 'residential'],
    default: 'intersection'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  city: {
    type: String,
    default: 'Bengaluru'
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

locationSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model('Location', locationSchema);
