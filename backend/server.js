require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cron = require('node-cron');

const { connectDB, getDBStatus } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { seedAll, generateNewReadings } = require('./services/mockDataGenerator');

// Route imports
const locationRoutes = require('./routes/locations');
const trafficRoutes = require('./routes/traffic');
const predictionRoutes = require('./routes/predictions');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API Routes
app.use('/api/locations', locationRoutes);
app.use('/api/traffic', trafficRoutes);
app.use('/api/predictions', predictionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const dbStatus = getDBStatus();
  res.json({
    status: 'ok',
    timestamp: new Date(),
    database: dbStatus,
    uptime: process.uptime()
  });
});

// Error handler
app.use(errorHandler);

// Cached locations for cron job
let cachedLocations = [];

// Start server
async function start() {
  // Connect to database
  await connectDB();

  // Seed data
  console.log('\n🚀 Initializing Predictive Traffic Congestion Modeling System...\n');
  cachedLocations = await seedAll();

  // Schedule new data generation every 2 minutes (faster for demo)
  cron.schedule('*/2 * * * *', async () => {
    try {
      const newReadings = await generateNewReadings(cachedLocations);
      console.log(`🔄 Generated ${newReadings.length} new readings at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('Cron error:', err.message);
    }
  });

  app.listen(PORT, () => {
    const dbStatus = getDBStatus();
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📦 Database: ${dbStatus.type}`);
    console.log(`📍 Monitoring ${cachedLocations.length} locations`);
    console.log(`⏰ New data generated every 2 minutes\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
