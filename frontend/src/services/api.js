import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Locations
export const getLocations = () => api.get('/locations').then(r => r.data);

// Traffic data
export const getLatestTraffic = () => api.get('/traffic/latest').then(r => r.data);
export const getLocationTraffic = (id, hours = 6) => api.get(`/traffic/location/${id}?hours=${hours}`).then(r => r.data);
export const getLocationHistory = (id, hours = 24) => api.get(`/traffic/location/${id}/history?hours=${hours}`).then(r => r.data);
export const uploadDetection = (data) => api.post('/traffic/upload', data).then(r => r.data);

// Predictions
export const getPredictions = (locationId) => api.get(`/predictions/${locationId}`).then(r => r.data);
export const generateAllPredictions = () => api.post('/predictions/generate').then(r => r.data);

// Health
export const getHealth = () => api.get('/health').then(r => r.data);

export default api;
