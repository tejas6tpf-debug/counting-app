import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users as UsersIcon,
    UserPlus,
    Shield,
    Trash2,
    RefreshCw,
    Search,
    AlertCircle
} from 'lucide-react';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({ username: '', password: '', role: 'USER' });

    useEffect(() => {
        fetchUsers();

        // Real-time synchronization
        const channel = supabase.channel('profiles-sync').on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'profiles'
        }, () => {
            fetchUsers();
        }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('create_system_user', {
                uname: formData.username,
                pwd: formData.password,
                target_role: formData.role
            });

            if (data?.success === false) {
                throw new Error(data.error || 'User creation failed');
            }

            if (error) throw error;

            setFormData({ username: '', password: '', role: 'USER' });
            setIsModalOpen(false);
            // fetchUsers() will be called by real-time sync or manually
            alert(`✅ Shabaash! User "${formData.username}" ban gaya hai.`);
        } catch (err) {
            console.error('Create User Error:', err);
            alert('Error creating user: ' + (err.message || 'Check database connection'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Kya aap "${name}" ko delete karna chahte hain?`)) return;

        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) alert('Error deleting: ' + error.message);
        else fetchUsers();
    };

    const filteredUsers = users.filter(u =>
        u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="header-info">
                    <UsersIcon size={32} className="header-icon" />
                    <div>
                        <h1>User Management</h1>
                        <p>Total Users: {users.length}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="search-box-wrap">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="btn-secondary" onClick={fetchUsers} title="Refresh List">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                        <UserPlus size={20} />
                        <span>Add New User</span>
                    </button>
                </div>
            </div>

            <div className="grid-cards">
                {loading && users.length === 0 ? (
                    <div className="status-loading">Loading users list...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="status-empty">
                        <AlertCircle size={40} />
                        <p>No users found matching your search.</p>
                    </div>
                ) : filteredUsers.map(user => (
                    <div key={user.id} className="card user-card">
                        <div className="user-card-main">
                            <div className="user-avatar">
                                {user.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="user-info">
                                <h3 className="user-name">{user.username}</h3>
                                <div className={`user-role-badge ${user.role}`}>
                                    <Shield size={12} />
                                    <span>{user.role}</span>
                                </div>
                            </div>
                        </div>
                        <div className="user-card-footer">
                            <span className="join-date">Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                            {user.role !== 'SUPER_ADMIN' && (
                                <button className="delete-btn" onClick={() => handleDelete(user.id, user.username)}>
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal user-modal">
                        <div className="modal-header">
                            <h2>Create New System User</h2>
                            <p>This will create a new login for the staff.</p>
                        </div>
                        <form onSubmit={handleCreateUser}>
                            <div className="form-group">
                                <label>Username (used for login)</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                                    placeholder="e.g. manal"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Secure Password</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Enter password"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Access Role</label>
                                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                    <option value="USER">USER (Scanning only)</option>
                                    <option value="ADMIN">ADMIN (Reports + Locations)</option>
                                    <option value="SUPER_ADMIN">SUPER_ADMIN (Full Access)</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? 'Processing...' : 'Create User Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .search-box-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .search-box-wrap svg {
                    position: absolute;
                    left: 1rem;
                    color: #94a3b8;
                }
                .search-box-wrap input {
                    padding-left: 2.5rem;
                    min-width: 250px;
                }
                .btn-secondary {
                    background: #1e293b;
                    border: 1px solid #334155;
                    color: white;
                    padding: 0.75rem;
                    border-radius: 0.75rem;
                    cursor: pointer;
                }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .user-card {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .user-card-main {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .user-avatar {
                    width: 50px;
                    height: 50px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    font-weight: 700;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                .user-info { flex: 1; }
                .user-name { margin: 0; font-size: 1.1rem; }
                .user-role-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.3rem;
                    font-size: 0.7rem;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    margin-top: 0.25rem;
                    font-weight: 600;
                }
                .user-role-badge.USER { background: rgba(148, 163, 184, 0.1); color: #94a3b8; }
                .user-role-badge.ADMIN { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .user-role-badge.SUPER_ADMIN { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

                .user-card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    padding-top: 1rem;
                }
                .join-date { font-size: 0.75rem; color: #64748b; }
                .delete-btn { color: #ef4444; background: transparent; border: none; cursor: pointer; padding: 0.4rem; border-radius: 6px; }
                .delete-btn:hover { background: rgba(239, 68, 68, 0.1); }

                .status-empty { grid-column: 1 / -1; text-align: center; padding: 4rem; color: #64748b; }
                .status-loading { grid-column: 1 / -1; text-align: center; padding: 4rem; color: #94a3b8; }

                .user-modal { max-width: 450px !important; }
                .modal-header { margin-bottom: 2rem; }
                .modal-header h2 { margin-bottom: 0.5rem; }
                .modal-header p { color: #94a3b8; font-size: 0.85rem; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
                .btn-ghost { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 0.75rem 1rem; }
            `}</style>
        </div>
    );
};

export default Users;
