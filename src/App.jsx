import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Scanning from './pages/Scanning';
import Locations from './pages/Locations';
import PartMasters from './pages/PartMasters';
import Users from './pages/Users';
import Reports from './pages/Reports';
import FinalSheet from './pages/FinalSheet';

function App() {
  const { user, profile, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

  if (loading) {
    return (
      <div className="loading-screen" style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255, 255, 255, 0.1)', borderRadius: '50%', borderTopColor: '#3b82f6', animation: 'spin 1s ease-in-out infinite' }}></div>
        <p>Loading Pegasus Spare...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'scanning': return <Scanning />;
      case 'locations': return <Locations />;
      case 'masters': return <PartMasters />;
      case 'users': return <Users />;
      case 'reports': return <Reports />;
      case 'final-sheet': return <FinalSheet />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="main-layout">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
