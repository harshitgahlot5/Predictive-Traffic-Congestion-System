# Predictive Traffic Congestion Modeling — Architecture

## System Overview

TrafficSense AI is a full-stack web application that uses computer vision and time-series analysis to predict traffic congestion levels 15–45 minutes ahead. It fuses camera-based vehicle detection with map-based traffic data for improved accuracy.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Dashboard │  │ VideoDetector│  │  Analytics  │  │  Header  │ │
│  │ (Leaflet) │  │ (Canvas/COCO)│  │ (Chart.js) │  │          │ │
│  └─────┬─────┘  └──────┬───────┘  └─────┬──────┘  └──────────┘ │
│        │               │                │                       │
│        └───────────┬────┴────────────────┘                      │
│                    │ Axios HTTP                                  │
└────────────────────┼────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js + Express)                  │
│                                                                │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│  │  REST API  │  │  Cron Jobs   │  │   Middleware          │    │
│  │  Routes    │  │  (2-min gen) │  │   (CORS, Auth, Err)  │    │
│  └─────┬──────┘  └──────┬──────┘  └──────────────────────┘    │
│        │                │                                      │
│        ▼                ▼                                      │
│  ┌─────────────────────────────────────────────┐               │
│  │              SERVICE LAYER                   │               │
│  │                                              │               │
│  │  ┌────────────┐  ┌──────────────────────┐   │               │
│  │  │   Data     │  │  Prediction Engine   │   │               │
│  │  │   Fusion   │  │  (Weighted Regression)│   │               │
│  │  └────────────┘  └──────────────────────┘   │               │
│  │  ┌────────────┐  ┌──────────────────────┐   │               │
│  │  │  Anomaly   │  │  Mock Data Generator │   │               │
│  │  │  Detector  │  │  (Sinusoidal Patterns)│   │               │
│  │  └────────────┘  └──────────────────────┘   │               │
│  └──────────────────────┬──────────────────────┘               │
│                         │                                      │
└─────────────────────────┼──────────────────────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    MongoDB      │
                 │  (or In-Memory) │
                 │                 │
                 │  • Locations    │
                 │  • TrafficData  │
                 └─────────────────┘
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 18 + Vite | UI framework with fast HMR |
| Map | Leaflet + react-leaflet | Interactive traffic map |
| Charts | Chart.js + react-chartjs-2 | Analytics visualizations |
| Detection | Canvas simulation (TF.js ready) | Vehicle detection demo |
| Backend | Node.js + Express | REST API server |
| Database | MongoDB / In-Memory | Data persistence |
| Scheduling | node-cron | Periodic data generation |

## Data Flow

1. **Mock Data Generation**: On startup, 24 hours of historical data is generated using sinusoidal rush-hour patterns with Gaussian noise.
2. **Continuous Updates**: Every 2 minutes, new readings are generated for all 8 monitored locations.
3. **Data Fusion**: Camera-based density (60% weight) is combined with maps-based speed data (40% weight).
4. **Anomaly Detection**: Z-score analysis, speed-drop detection, and density-flow mismatch rules identify incidents.
5. **Prediction**: Weighted regression with EWMA, trend analysis, and time-of-day seasonality forecasts 15/30/45 min ahead.
6. **Dashboard**: Frontend polls every 30 seconds, rendering color-coded markers on the map.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health check |
| GET | `/api/locations` | All monitored locations |
| GET | `/api/locations/:id` | Single location details |
| POST | `/api/locations` | Add new location |
| GET | `/api/traffic/latest` | Latest reading per location |
| GET | `/api/traffic/location/:id` | Historical data (query: hours) |
| GET | `/api/traffic/location/:id/history` | Hourly aggregated history |
| POST | `/api/traffic/upload` | Upload detection results |
| GET | `/api/predictions/:locationId` | Predictions for location |
| POST | `/api/predictions/generate` | Generate all predictions |

## Setup & Run

### Prerequisites
- Node.js 18+
- MongoDB (optional — falls back to in-memory)

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Access
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api

## Key Design Decisions

1. **In-memory fallback**: If MongoDB isn't available, the app works fully with in-memory storage — no setup friction.
2. **Browser-side detection**: Vehicle detection runs on canvas simulation in the browser, keeping the backend lightweight.
3. **Weighted regression over LSTM**: A simpler prediction model that's transparent, fast, and avoids heavy ML dependencies.
4. **Sinusoidal mock data**: Realistic traffic patterns with rush-hour peaks, making the demo immediately impressive.
