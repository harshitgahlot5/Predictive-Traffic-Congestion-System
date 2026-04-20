import { useState, useEffect } from 'react';
import './Header.css';

export default function Header({ activeTab, onTabChange, isConnected, theme, toggleTheme }) {
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="app-header" id="app-header">
      <div className="header-left">
        <div className="header-logo">🚦</div>
        <div>
          <div className="header-title">TrafficSense AI</div>
          <div className="header-subtitle">Predictive Congestion Modeling</div>
        </div>
      </div>

      <nav className="header-nav">
        {['dashboard', 'detection', 'analytics'].map(tab => (
          <button
            key={tab}
            id={`nav-${tab}`}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => onTabChange(tab)}
          >
            {tab === 'dashboard' ? '🗺️ Dashboard' : tab === 'detection' ? '📹 Detection' : '📊 Analytics'}
          </button>
        ))}
      </nav>

      <div className="header-right">
        <button 
          className="theme-toggle" 
          onClick={toggleTheme} 
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', 
            fontSize: '1.2rem', padding: '0 8px', color: 'var(--text-muted)' 
          }}
        >
          {theme === 'dark' ? '🌞' : '🌙'}
        </button>
        <div className="header-clock">
          {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="header-status">
          <div className={`status-dot ${isConnected ? '' : 'disconnected'}`}></div>
          {isConnected ? 'Live' : 'Offline'}
        </div>
      </div>
    </header>
  );
}
