import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { exportStockSummary } from '../utils/excel-export';
import {
    ClipboardList,
    Download,
    Filter,
    TrendingDown,
    TrendingUp,
    AlertTriangle,
    RefreshCw,
    Search,
    Edit3,
    CheckCircle2,
    XCircle,
    FileText,
    User,
    Save,
    X
} from 'lucide-react';

const Reports = () => {
    const [activeTab, setActiveTab] = useState('short'); // short, excess, non-counted
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Edit Modal State (Synced with Final Sheet)
    const [editingItem, setEditingItem] = useState(null);
    const [editData, setEditData] = useState({ physical_qty: '', remark_type: '', remark_detail: '', damage_qty: 0 });

    useEffect(() => {
        fetchData();

        // Modal Dismissal with Escape Key
        const handleEsc = (e) => {
            if (e.key === 'Escape') setEditingItem(null);
        };
        window.addEventListener('keydown', handleEsc);

        // Polling-based live feed for multi-user updates (every 5 seconds)
        const pollingInterval = setInterval(() => {
            fetchData();
        }, 5000);

        return () => {
            window.removeEventListener('keydown', handleEsc);
            clearInterval(pollingInterval);
        };
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch ALL Scans for the basic list
            const { data: scans, error: scanErr } = await supabase
                .from('scans')
                .select('*, locations(name)');

            if (scanErr) throw scanErr;

            // 2. Identify parts needed for enrichment
            const uniquePNs = [...new Set(scans?.map(s => s.part_number) || [])];

            // 3. Fetch Master data specifically for these parts
            const { data: bMaster, error: bErr } = await supabase
                .from('base_part_master')
                .select('*')
                .in('part_number', uniquePNs);

            if (bErr) console.error('Base Master Error:', bErr);

            const { data: dailyMaster } = await supabase
                .from('daily_part_master')
                .select('*')
                .in('part_number', uniquePNs);

            const masterMap = {};
            bMaster?.forEach(m => {
                const key = String(m.part_number || '').trim().toUpperCase();
                masterMap[key] = m;
            });

            const latestDaily = {};
            dailyMaster?.forEach(d => {
                const key = String(d.part_number || '').trim().toUpperCase();
                if (!latestDaily[key] || new Date(d.upload_date) > new Date(latestDaily[key].upload_date)) {
                    latestDaily[key] = d;
                }
            });

            const results = [];
            if (activeTab === 'non-counted') {
                // For non-counted, we actually DO need more master data (parts not in scans)
                // But we limit it to 2000 for performance, usually enough for a shift
                const { data: nonCountedMaster } = await supabase
                    .from('base_part_master')
                    .select('*')
                    .limit(2000);

                const scanMap = {};
                scans?.forEach(s => {
                    const key = String(s.part_number || '').trim().toUpperCase();
                    scanMap[key] = s;
                });

                nonCountedMaster?.forEach(base => {
                    const key = String(base.part_number || '').trim().toUpperCase();
                    const scan = scanMap[key];
                    const daily = latestDaily[key];
                    const currentSystemStock = daily?.latest_stock || base.base_stock || 0;

                    if (!scan && currentSystemStock > 0) {
                        results.push({
                            part_number: base.part_number,
                            description: base.description,
                            master_loc: daily?.latest_bin || base.default_bin || '---',
                            system_stock: currentSystemStock,
                            ddl: base.purchase_price || 0,
                            stock_value: currentSystemStock * (base.purchase_price || 0)
                        });
                    }
                });
            } else {
                scans?.forEach(scan => {
                    const scanKey = String(scan.part_number || '').trim().toUpperCase();
                    const bInfo = masterMap[scanKey] || {};
                    const ddl = bInfo.purchase_price || 0;
                    const diff = scan.physical_qty - scan.system_stock;

                    const item = {
                        ...scan,
                        diff,
                        ddl,
                        description: scan.description || bInfo.description || 'No Master Info',
                        master_loc: bInfo.default_bin || '---',
                        diff_value: diff * ddl,
                        stock_value: scan.system_stock * ddl,
                        warehouse_loc: scan.locations?.name || '---'
                    };

                    if (activeTab === 'short' && diff < 0) results.push(item);
                    else if (activeTab === 'excess' && diff > 0) results.push(item);
                });
            }

            setData(results);
        } catch (err) {
            console.error('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (item) => {
        if (activeTab === 'non-counted') return; // Cannot edit non-scans here
        setEditingItem(item);
        setEditData({
            physical_qty: item.physical_qty.toString(),
            remark_type: item.remark_type || '',
            remark_detail: item.remark_detail || '',
            damage_qty: item.damage_qty || 0
        });
    };

    const handleSaveEdit = async () => {
        if (!editingItem) return;
        const newPhyQty = parseFloat(editData.physical_qty) || 0;
        const newDiff = newPhyQty - editingItem.system_stock;

        const { error } = await supabase.from('scans').update({
            physical_qty: newPhyQty,
            difference: newDiff,
            remark_type: editData.remark_type,
            remark_detail: editData.remark_detail,
            damage_qty: parseFloat(editData.damage_qty) || 0
        }).eq('id', editingItem.id);

        if (error) {
            alert('Error updating: ' + error.message);
        } else {
            setEditingItem(null);
            fetchData();
        }
    };

    const filteredData = data.filter(item =>
        item.part_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="reports-container">
            <div className="reports-header">
                <div className="header-left">
                    <div className="icon-badge">
                        <ClipboardList size={24} color="#3b82f6" />
                    </div>
                    <div>
                        <h1>Live Stock Analysis</h1>
                        <p>Real-time Variance & Inventory Tracking</p>
                    </div>
                </div>

                <div className="header-actions">
                    <div className="search-bar">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search part..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="icon-btn" onClick={fetchData} title="Manual Refresh">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn-excel" onClick={exportStockSummary}>
                        <Download size={16} />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            <div className="tab-navigation">
                <button className={`tab-btn ${activeTab === 'short' ? 'active' : ''}`} onClick={() => setActiveTab('short')}>
                    <TrendingDown size={16} />
                    <span>Shortage ({activeTab === 'short' ? filteredData.length : '...'})</span>
                </button>
                <button className={`tab-btn ${activeTab === 'excess' ? 'active' : ''}`} onClick={() => setActiveTab('excess')}>
                    <TrendingUp size={16} />
                    <span>Excess ({activeTab === 'excess' ? filteredData.length : '...'})</span>
                </button>
                <button className={`tab-btn ${activeTab === 'non-counted' ? 'active' : ''}`} onClick={() => setActiveTab('non-counted')}>
                    <AlertTriangle size={16} />
                    <span>Not Scanned ({activeTab === 'non-counted' ? filteredData.length : '...'})</span>
                </button>
            </div>

            <div className="spreadsheet-card">
                <div className="table-wrapper">
                    <table className="excel-table">
                        <thead>
                            <tr>
                                <th style={{ width: '130px' }}>PART NUM</th>
                                <th style={{ width: '220px' }}>PART DESCRIPTION</th>
                                <th style={{ width: '100px' }} className="text-center">BIN LOCATION</th>
                                <th className="text-right">SYSTEM</th>
                                {activeTab !== 'non-counted' && (
                                    <>
                                        <th className="text-right">PHYSICAL</th>
                                        <th className="text-right">DIFF</th>
                                        <th className="text-right">DDL</th>
                                        <th className="text-right">DIFF VALUE</th>
                                        <th style={{ width: '120px' }}>REMARK</th>
                                        <th style={{ width: '120px' }}>W'HOUSE</th>
                                        <th style={{ width: '45px' }}>ACTION</th>
                                    </>
                                )}
                                {activeTab === 'non-counted' && (
                                    <>
                                        <th className="text-right">DDL</th>
                                        <th className="text-right">VALUE</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && data.length === 0 ? (
                                <tr><td colSpan="12" className="empty-state">Fetching live data...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="12" className="empty-state">No records found.</td></tr>
                            ) : filteredData.map((item, idx) => (
                                <tr key={idx}>
                                    <td>
                                        {activeTab === 'non-counted' ? (
                                            <span className="part-no">{item.part_number}</span>
                                        ) : (
                                            <span
                                                className="part-no clickable"
                                                onClick={() => handleEditClick(item)}
                                                title="Click to edit record"
                                            >
                                                {item.part_number}
                                            </span>
                                        )}
                                    </td>
                                    <td><span className="description" title={item.description}>{item.description}</span></td>
                                    <td className="text-center text-dim">{item.master_loc}</td>
                                    <td className="text-right bold">{item.system_stock}</td>
                                    {activeTab !== 'non-counted' && (
                                        <>
                                            <td className="text-right bold white">{item.physical_qty}</td>
                                            <td className={`text-right bold ${item.diff < 0 ? 'text-red' : 'text-green'}`}>
                                                {item.diff > 0 ? `+${item.diff}` : item.diff}
                                            </td>
                                            <td className="text-right text-dim">{item.ddl.toFixed(2)}</td>
                                            <td className={`text-right bold ${item.diff_value < 0 ? 'text-red' : 'text-green'}`}>
                                                {item.diff_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td>
                                                <div className="remark-group">
                                                    {item.remark_type && <span className={`rmk-badge ${item.remark_type.toLowerCase()}`}>{item.remark_type}</span>}
                                                    {item.damage_qty > 0 && <span className="dmg-pill">{item.damage_qty}</span>}
                                                </div>
                                            </td>
                                            <td><div className="loc-tag">{item.warehouse_loc}</div></td>
                                            <td className="text-center">
                                                <button className="edit-btn" onClick={() => handleEditClick(item)}>
                                                    <Edit3 size={12} />
                                                </button>
                                            </td>
                                        </>
                                    )}
                                    {activeTab === 'non-counted' && (
                                        <>
                                            <td className="text-right text-dim">{item.ddl.toFixed(2)}</td>
                                            <td className="text-right bold">
                                                {item.stock_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Syncing the Edit Modal from Final Sheet */}
            {editingItem && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <div className="modal-header">
                            <div>
                                <h2>Correct Variance</h2>
                                <p>{editingItem.part_number} - {editingItem.description}</p>
                            </div>
                            <button className="close-x" onClick={() => setEditingItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="stats-strip">
                                <div className="stat">
                                    <span className="lab">System</span>
                                    <span className="val">{editingItem.system_stock}</span>
                                </div>
                                <div className="stat">
                                    <span className="lab">Scanned</span>
                                    <span className="val">{editingItem.physical_qty}</span>
                                </div>
                            </div>
                            <div className="edit-grid">
                                <div className="input-group">
                                    <label>Correct Physical Qty</label>
                                    <input type="number" value={editData.physical_qty} onChange={(e) => setEditData({ ...editData, physical_qty: e.target.value })} />
                                </div>
                                <div className="input-group">
                                    <label>Damage Qty</label>
                                    <input type="number" value={editData.damage_qty} onChange={(e) => setEditData({ ...editData, damage_qty: e.target.value })} />
                                </div>
                                <div className="input-group">
                                    <label>Remark Type</label>
                                    <select value={editData.remark_type} onChange={(e) => setEditData({ ...editData, remark_type: e.target.value })}>
                                        <option value="">None</option>
                                        <option value="Damage">Damage</option>
                                        <option value="Interchange">Interchange</option>
                                        <option value="Manual">Manual Override</option>
                                    </select>
                                </div>
                                <div className="input-group full">
                                    <label>NN Remark Detail</label>
                                    <input type="text" value={editData.remark_detail} onChange={(e) => setEditData({ ...editData, remark_detail: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setEditingItem(null)}>Cancel</button>
                            <button className="btn-save" onClick={handleSaveEdit}><Save size={16} /> Save Correction</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .reports-container { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; background: #0f172a; min-height: 100vh; color: #f8fafc; }
                
                .reports-header { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 0.75rem 1.25rem; border-radius: 0.75rem; border: 1px solid #334155; }
                .header-left { display: flex; align-items: center; gap: 0.75rem; }
                .icon-badge { background: rgba(59, 130, 246, 0.1); padding: 0.5rem; border-radius: 0.5rem; border: 1px solid rgba(59, 130, 246, 0.2); }
                .header-left h1 { margin: 0; font-size: 1.1rem; font-weight: 800; }
                .header-left p { margin: 0; font-size: 0.75rem; color: #94a3b8; }

                .header-actions { display: flex; gap: 0.5rem; align-items: center; }
                .search-bar { position: relative; display: flex; align-items: center; }
                .search-bar svg { position: absolute; left: 0.6rem; color: #64748b; }
                .search-bar input { background: #0f172a; border: 1px solid #334155; color: white; padding: 0.4rem 0.6rem 0.4rem 1.75rem; border-radius: 0.4rem; outline: none; width: 220px; font-size: 0.8rem; transition: border-color 0.2s; }
                .search-bar input:focus { border-color: #3b82f6; }

                .icon-btn { background: #0f172a; border: 1px solid #334155; color: #94a3b8; padding: 0.4rem; border-radius: 0.4rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .btn-excel { background: #059669; color: white; border: none; padding: 0.4rem 0.75rem; border-radius: 0.4rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-weight: 700; font-size: 0.8rem; }

                .tab-navigation { display: flex; gap: 0.25rem; border-bottom: 1px solid #1e293b; padding: 0 0.5rem; }
                .tab-btn { background: transparent; border: none; color: #64748b; display: flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; cursor: pointer; font-size: 0.75rem; font-weight: 700; transition: all 0.2s; border-bottom: 2px solid transparent; }
                .tab-btn:hover { color: #94a3b8; }
                .tab-btn.active { color: #3b82f6; border-bottom-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }

                .spreadsheet-card { background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
                .table-wrapper { width: 100%; overflow: auto; max-height: calc(100vh - 180px); }
                
                .excel-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; min-width: 1400px; }
                .excel-table th { background: #0f172a; padding: 0.75rem 0.6rem; text-align: left; color: #64748b; font-weight: 800; font-size: 0.7rem; text-transform: uppercase; border-bottom: 2px solid #334155; position: sticky; top: 0; z-index: 10; border-right: 1px solid rgba(255,255,255,0.05); white-space: nowrap; }
                .excel-table td { padding: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.03); vertical-align: middle; white-space: nowrap; }
                .excel-table tr:hover { background: rgba(255,255,255,0.02); }

                .part-no { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #3b82f6; font-weight: 600; }
                .part-no.clickable { cursor: pointer; transition: all 0.2s; }
                .part-no.clickable:hover { color: #60a5fa; text-decoration: underline; background: rgba(59, 130, 246, 0.1); padding: 2px 4px; border-radius: 4px; margin: -2px -4px; }
                .description { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; display: block; font-weight: 500; }
                
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .bold { font-weight: 800; }
                .white { color: #fff; }
                .text-dim { color: #64748b; }
                .text-red { color: #f87171; }
                .text-green { color: #4ade80; }

                .remark-group { display: flex; align-items: center; gap: 0.4rem; }
                .rmk-badge { padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.6rem; font-weight: 800; background: #334155; color: #94a3b8; white-space: nowrap; }
                .rmk-badge.damage { background: rgba(239, 68, 68, 0.2); color: #f87171; }
                .rmk-badge.interchange { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
                .dmg-pill { background: #f59e0b; color: #000; padding: 0.1rem 0.3rem; border-radius: 1rem; font-size: 0.6rem; font-weight: 900; }

                .loc-tag { display: inline-flex; align-items: center; gap: 0.3rem; background: #0f172a; color: #94a3b8; padding: 0.15rem 0.4rem; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 700; }
                
                .edit-btn { background: #334155; border: none; color: white; width: 22px; height: 22px; border-radius: 0.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .edit-btn:hover { background: #3b82f6; }

                .empty-state { text-align: center; padding: 3rem; color: #64748b; font-style: italic; }

                .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
                .modal-content { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden; }
                .modal-header { padding: 1rem 1.25rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: flex-start; }
                .modal-header h2 { margin: 0; font-size: 1rem; color: white; }
                .modal-header p { margin: 0.2rem 0 0; font-size: 0.75rem; color: #3b82f6; font-weight: 700; }
                
                .modal-body { padding: 1.25rem; }
                .stats-strip { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
                .stat { flex: 1; background: #0f172a; padding: 0.6rem; border-radius: 0.5rem; display: flex; flex-direction: column; gap: 0.1rem; }
                .stat .lab { font-size: 0.6rem; color: #64748b; text-transform: uppercase; font-weight: 700; }
                .stat .val { font-size: 1.1rem; color: white; font-weight: 900; }

                .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
                .input-group { display: flex; flex-direction: column; gap: 0.3rem; }
                .input-group.full { grid-column: span 2; }
                .input-group label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
                .input-group input, .input-group select { background: #0f172a; border: 1px solid #334155; border-radius: 0.4rem; padding: 0.5rem; color: white; font-size: 0.9rem; }

                .modal-footer { padding: 1rem 1.25rem; background: #0f172a; display: flex; justify-content: flex-end; gap: 0.75rem; }
                .btn-cancel { background: transparent; border: none; color: #64748b; cursor: pointer; font-weight: 700; font-size: 0.8rem; }
                .btn-save { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.4rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-weight: 800; font-size: 0.8rem; }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .close-x { background: transparent; border: none; color: #64748b; cursor: pointer; }
            `}</style>
        </div>
    );
};

export default Reports;
