import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  Scan,
  Database,
  MapPin,
  Users as UsersIcon,
  LogOut,
  ChevronRight,
  ClipboardList,
  FileText
} from 'lucide-react';

const Sidebar = ({ activePage, setActivePage }) => {
  const { profile, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN', 'USER'] },
    { id: 'scanning', label: 'Stock Scan', icon: Scan, roles: ['SUPER_ADMIN', 'ADMIN', 'USER'] },
    { id: 'final-sheet', label: 'Final Sheet', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'reports', label: 'Reports', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'USER'] },
    { id: 'locations', label: 'Locations', icon: MapPin, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'masters', label: 'Part Masters', icon: Database, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'users', label: 'User Mgmt', icon: UsersIcon, roles: ['SUPER_ADMIN', 'ADMIN'] },
  ];

  const filteredMenu = menuItems.filter(item =>
    item.roles.includes(profile?.role)
  );

  return (
    <div className="sidebar">
      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', fontWeight: 700, fontSize: '1.25rem', color: '#f8fafc' }}>
        <div style={{ background: '#3b82f6', width: '32px', height: '32px', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>P</div>
        <span>Pegasus Spare</span>
      </div>

      <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.75rem', marginBottom: '2rem' }}>
        <div style={{ width: '40px', height: '40px', background: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1.125rem' }}>
          {profile?.username?.charAt(0).toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>{profile?.username}</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{profile?.role}</span>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {filteredMenu.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
            {activePage === item.id && <ChevronRight style={{ marginLeft: 'auto' }} size={16} />}
          </button>
        ))}
      </nav>

      <button onClick={logout} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </div>
  );
};

export default Sidebar;
