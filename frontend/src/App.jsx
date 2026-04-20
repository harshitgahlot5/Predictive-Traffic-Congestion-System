import { useState, useEffect } from 'react';
import Header from './components/common/Header';
import Dashboard from './components/Dashboard/Dashboard';
import VideoDetector from './components/VideoFeed/VideoDetector';
import AnalyticsPage from './components/Analytics/AnalyticsPage';
import { getHealth } from './services/api';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('traffic-theme') || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('traffic-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await getHealth();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      <Header activeTab={activeTab} onTabChange={setActiveTab} isConnected={isConnected} theme={theme} toggleTheme={toggleTheme} />
      <main className="app-content">
        {activeTab === 'dashboard' && <Dashboard theme={theme} />}
        {activeTab === 'detection' && <VideoDetector theme={theme} />}
        {activeTab === 'analytics' && <AnalyticsPage theme={theme} />}
      </main>
    </div>
  );
}

export default App;
