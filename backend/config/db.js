const mongoose = require('mongoose');

let isConnected = false;
let useInMemory = false;

// In-memory storage fallback
const inMemoryDB = {
  locations: [],
  trafficData: []
};

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic-congestion';
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn('⚠️  MongoDB connection failed. Using in-memory storage.');
    console.warn(`   Reason: ${error.message}`);
    useInMemory = true;
    return false;
  }
};

const getDBStatus = () => ({
  isConnected,
  useInMemory,
  type: isConnected ? 'MongoDB' : 'In-Memory'
});

const getInMemoryDB = () => inMemoryDB;

module.exports = { connectDB, getDBStatus, getInMemoryDB };
