import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Plus, Edit2, Check, X } from 'lucide-react';

const Locations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ name: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('locations').select('*').order('created_at', { ascending: false });
    if (error) console.error('Error fetching locations:', error);
    else setLocations(data);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isEditing) {
      const { error } = await supabase.from('locations').update({ name: currentLocation.name, updated_at: new Date() }).eq('id', currentLocation.id);
      if (error) console.error('Error updating location:', error);
    } else {
      const { error } = await supabase.from('locations').insert([{ name: currentLocation.name }]);
      if (error) console.error('Error adding location:', error);
    }
    setIsModalOpen(false); setCurrentLocation({ name: '' }); setIsEditing(false); fetchLocations();
  };

  const toggleStatus = async (location) => {
    const { error } = await supabase.from('locations').update({ is_active: !location.is_active, updated_at: new Date() }).eq('id', location.id);
    if (error) console.error('Error toggling status:', error);
    else fetchLocations();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-info">
          <MapPin size={32} className="header-icon" />
          <div>
            <h1>Location Management</h1>
            <p>Define and manage physical counting areas</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setIsEditing(false); setCurrentLocation({ name: '' }); setIsModalOpen(true); }}>
          <Plus size={20} />
          <span>New Location</span>
        </button>
      </div>

      <div className="grid-cards">
        {loading ? (<p>Loading locations...</p>) : locations.length === 0 ? (<p>No locations found.</p>) : (
          locations.map((loc) => (
            <div key={loc.id} className={`card ${!loc.is_active ? 'disabled' : ''}`} style={{ opacity: loc.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>{loc.name}</h3>
                <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: loc.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: loc.is_active ? '#22c55e' : '#ef4444' }}>
                  {loc.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-primary" style={{ padding: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8' }} onClick={() => { setIsEditing(true); setCurrentLocation(loc); setIsModalOpen(true); }}><Edit2 size={16} /></button>
                <button className="btn-primary" style={{ padding: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', color: loc.is_active ? '#ef4444' : '#22c55e' }} onClick={() => toggleStatus(loc)}>{loc.is_active ? <X size={16} /> : <Check size={16} />}</button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{isEditing ? 'Edit Location' : 'Add Location'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Location Name</label>
                <input type="text" value={currentLocation.name} onChange={(e) => setCurrentLocation({ ...currentLocation, name: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locations;
