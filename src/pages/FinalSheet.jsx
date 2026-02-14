import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { exportStockSummary } from '../utils/excel-export';
import {
    FileText,
    Download,
    RefreshCw,
    Search,
    Edit3,
    CheckCircle2,
    XCircle,
    User,
    Save,
    X,
    TrendingUp,
    MapPin,
    Calendar
} from 'lucide-react';

const FinalSheet = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Edit Modal State
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
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch ALL Scans first to know which parts we need
            // Using new helper to bypass 1000 row limit
            const { fetchAllRecords } = await import('../lib/supabase');
            const scans = await fetchAllRecords('scans', '*, locations(name)', null, 'created_at', false);

            if (!scans || scans.length === 0) {
                setData([]);
                return;
            }

            // 2. Identify unique part numbers from scans
            const uniquePNs = [...new Set(scans.map(s => s.part_number))];

            // 3. Fetch Master data ONLY for these parts (Chunked)
            const { fetchByPartNumbers } = await import('../lib/supabase');

            const baseMaster = await fetchByPartNumbers('base_part_master', uniquePNs, 'part_number', 'part_number, description, category, purchase_price, default_bin');

            // New: Fetch Daily Master metadata too for parts not in base
            const dailyMaster = await fetchByPartNumbers('daily_part_master', uniquePNs, 'part_number', 'part_number, description, category, purchase_price, latest_bin');

            // Fetch Average Counts (Dedicated Table - Chunked)
            const avgMasters = await fetchByPartNumbers('average_counts', uniquePNs, 'part_number', 'part_number, average_count');

            const masterMap = {};
            baseMaster?.forEach(m => {
                const key = String(m.part_number || '').trim().toUpperCase();
                masterMap[key] = { ...m, average_count: 0 };
            });

            // Merge Daily Master (fills gaps for parts not in base)
            dailyMaster?.forEach(d => {
                const key = String(d.part_number || '').trim().toUpperCase();
                if (!masterMap[key]) {
                    masterMap[key] = {
                        part_number: d.part_number,
                        description: d.description || '',
                        category: d.category || '',
                        default_bin: d.latest_bin || '',
                        purchase_price: d.purchase_price || 0,
                        average_count: 0
                    };
                } else {
                    // Enrich existing base info if meta is missing
                    masterMap[key].description = masterMap[key].description || d.description;
                    masterMap[key].category = masterMap[key].category || d.category;
                    masterMap[key].default_bin = masterMap[key].default_bin || d.latest_bin;
                }
            });

            avgMasters?.forEach(am => {
                const key = String(am.part_number || '').trim().toUpperCase();
                if (masterMap[key]) {
                    masterMap[key].average_count = am.average_count;
                } else {
                    masterMap[key] = { part_number: am.part_number, average_count: am.average_count, purchase_price: 0, default_bin: '---' };
                }
            });

            // 4. Enrich data
            const enrichedData = scans.map(scan => {
                const scanKey = String(scan.part_number || '').trim().toUpperCase();
                const master = masterMap[scanKey] || {};
                const ddl = master.purchase_price || 0;

                // Fallback to scan record's own data if master info is missing
                // This happens for parts added via Daily Upload that aren't in Base Master
                const binLocation = master.default_bin || scan.actual_bin || '---';

                const diff = scan.physical_qty - scan.system_stock;

                return {
                    ...scan,
                    master_loc: binLocation,
                    avg_count: master.average_count || 0,
                    ddl,
                    diff_value: diff * ddl,
                    stock_value: scan.system_stock * ddl,
                    warehouse_loc: scan.locations?.name || '---'
                };
            });

            // Sort by Bin Location (A-Z)
            enrichedData.sort((a, b) => {
                const binA = String(a.master_loc || '').trim().toUpperCase();
                const binB = String(b.master_loc || '').trim().toUpperCase();
                return binA.localeCompare(binB);
            });

            setData(enrichedData);
        } catch (err) {
            console.error('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (item) => {
        setEditingItem(item);
        setEditData({
            physical_qty: item.physical_qty.toString(),
            remark_type: item.remark_type || '',
            remark_detail: item.remark_detail || '',
            damage_qty: item.damage_qty || 0,
            nn_carton_no: item.nn_carton_no || '' // NEW
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
            damage_qty: parseFloat(editData.damage_qty) || 0,
            nn_carton_no: editData.nn_carton_no // NEW
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
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.scanned_by?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = React.useMemo(() => {
        const uniqueParts = new Set(filteredData.map(i => i.part_number)).size;
        let shortVal = 0;
        let excessVal = 0;
        let stockVal = 0;

        filteredData.forEach(item => {
            if (item.diff_value < 0) shortVal += Math.abs(item.diff_value);
            else if (item.diff_value > 0) excessVal += item.diff_value;
            stockVal += (item.stock_value || 0);
        });

        return { uniqueParts, shortVal, excessVal, stockVal };
    }, [filteredData]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '---';
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
    };

    return (
        <div className="final-sheet-container">
            <div className="page-header">
                <div className="header-left">
                    <div className="icon-badge">
                        <FileText size={20} color="#3b82f6" />
                    </div>
                    <div>
                        <h1>Final Audit Sheet</h1>
                        <p>Spreadsheet format matching standard physical counting reports</p>
                    </div>
                </div>

                <div className="header-actions">
                    <div className="search-bar">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search part or user..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="icon-btn" onClick={fetchData} title="Refresh Data">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn-excel" onClick={exportStockSummary}>
                        <Download size={16} />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            <div className="stats-strip-audit">
                <div className="audit-stat-card">
                    <span className="stat-label">TOTAL PARTS SCAN</span>
                    <span className="stat-value">{stats.uniqueParts}</span>
                </div>
                <div className="audit-stat-card short">
                    <span className="stat-label">TOTAL SHORT VALUE</span>
                    <span className="stat-value">₹ {stats.shortVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="audit-stat-card excess">
                    <span className="stat-label">TOTAL EXCESS VALUE</span>
                    <span className="stat-value">₹ {stats.excessVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="audit-stat-card stock">
                    <span className="stat-label">TOTAL STOCK VALUE</span>
                    <span className="stat-value">₹ {stats.stockVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            <div className="spreadsheet-card">
                <div className="table-wrapper">
                    <table className="excel-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>SR NO.</th>
                                <th style={{ width: '130px' }}>PART NUM</th>
                                <th style={{ width: '220px' }}>PART DESCRIPTION</th>
                                <th style={{ width: '100px' }} className="text-center">BIN LOCATION</th>
                                <th className="text-right">CURRENT STOCK</th>
                                <th className="text-right">PHY. QTY</th>
                                <th className="text-right">AVG COUNT</th>
                                <th className="text-right">DIFF. QTY</th>
                                <th className="text-right">DDL</th>
                                <th className="text-right">DIFF VALUE</th>
                                <th className="text-right">STOCK VALUE</th>
                                <th style={{ width: '150px' }}>REMARK (Dmg/Intchg)</th>
                                <th style={{ width: '150px' }}>REMARK 1 (NN)</th>
                                <th style={{ width: '100px' }}>CARTON NO</th>
                                <th style={{ width: '100px' }}>NEW LOC</th>
                                <th style={{ width: '110px' }}>WAREHOUSE</th>
                                <th style={{ width: '100px' }}>DATE</th>
                                <th>USER</th>
                                <th style={{ width: '45px' }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && data.length === 0 ? (
                                <tr><td colSpan="18" className="empty-state">Loading audit data...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="18" className="empty-state">No scan records found.</td></tr>
                            ) : filteredData.map((item, idx) => {
                                const hasVariance = item.difference !== 0;
                                return (
                                    <tr key={item.id} className={hasVariance ? 'variance-row' : ''}>
                                        <td className="text-center text-dim">{idx + 1}</td>
                                        <td>
                                            <span
                                                className="part-no clickable"
                                                onClick={() => handleEditClick(item)}
                                                title="Click to edit record"
                                            >
                                                {item.part_number}
                                            </span>
                                        </td>
                                        <td><span className="description" title={item.description}>{item.description}</span></td>
                                        <td className="text-center font-mono text-orange">{item.master_loc}</td>
                                        <td className="text-right">{item.system_stock}</td>
                                        <td className="text-right font-bold">{item.physical_qty}</td>
                                        <td className="text-right" style={{ color: '#a855f7' }}>{item.avg_count || 0}</td>
                                        <td className={`text-right font-bold ${item.difference < 0 ? 'text-red' : item.difference > 0 ? 'text-green' : 'text-dim'}`}>
                                            {item.difference > 0 ? `+${item.difference}` : item.difference}
                                        </td>
                                        <td className="text-right text-dim">{item.ddl.toFixed(2)}</td>
                                        <td className={`text-right bold ${item.diff_value < 0 ? 'text-red' : item.diff_value > 0 ? 'text-green' : ''}`}>
                                            {item.diff_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="text-right">
                                            {item.stock_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td>
                                            {item.remark_type ? (
                                                <div className="remark-group">
                                                    <span className={`rmk-badge ${item.remark_type.toLowerCase()}`}>{item.remark_type}</span>
                                                    {item.damage_qty > 0 && <span className="dmg-pill">{item.damage_qty}</span>}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td><span className="remark-detail">{item.remark_detail || '-'}</span></td>
                                        <td className="bold" style={{ color: '#ec4899' }}>{item.nn_carton_no || '-'}</td>
                                        <td><span className="bin-tag">{item.new_bin_location || '-'}</span></td>
                                        <td><div className="loc-tag">{item.warehouse_loc}</div></td>
                                        <td className="text-dim" style={{ fontSize: '0.7rem' }}>{formatDate(item.created_at)}</td>
                                        <td><div className="user-tag">{item.scanned_by}</div></td>
                                        <td className="text-center">
                                            <button className="edit-btn" onClick={() => handleEditClick(item)}>
                                                <Edit3 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* In-Place Edit Modal */}
            {editingItem && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <div className="modal-header">
                            <div>
                                <h2>Correct Scan Record</h2>
                                <p>{editingItem.part_number} - {editingItem.description}</p>
                            </div>
                            <button className="close-x" onClick={() => setEditingItem(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="stats-strip">
                                <div className="stat">
                                    <span className="lab">System Stock</span>
                                    <span className="val">{editingItem.system_stock}</span>
                                </div>
                                <div className="stat">
                                    <span className="lab">Current Physical</span>
                                    <span className="val">{editingItem.physical_qty}</span>
                                </div>
                            </div>

                            <div className="edit-grid">
                                <div className="input-group">
                                    <label>New Physical Quantity</label>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={editData.physical_qty}
                                        onChange={(e) => setEditData({ ...editData, physical_qty: e.target.value })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Damage Quantity</label>
                                    <input
                                        type="number"
                                        value={editData.damage_qty}
                                        onChange={(e) => setEditData({ ...editData, damage_qty: e.target.value })}
                                    />
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
                                    <label>Remark Detail (nn)</label>
                                    <input
                                        type="text"
                                        placeholder="Reason for change..."
                                        value={editData.remark_detail}
                                        onChange={(e) => setEditData({ ...editData, remark_detail: e.target.value })}
                                    />
                                </div>
                                <div className="input-group full">
                                    <label>Carton No (NN)</label>
                                    <input
                                        type="text"
                                        placeholder="Box/Carton No..."
                                        value={editData.nn_carton_no}
                                        onChange={(e) => setEditData({ ...editData, nn_carton_no: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setEditingItem(null)}>Cancel</button>
                            <button className="btn-save" onClick={handleSaveEdit}>
                                <Save size={18} /> Update Final Record
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .final-sheet-container { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; background: #0f172a; min-height: 100vh; color: #f8fafc; }
                
                .page-header { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 0.75rem 1.25rem; border-radius: 0.75rem; border: 1px solid #334155; }
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

                .spreadsheet-card { background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
                .table-wrapper { width: 100%; overflow: auto; max-height: calc(100vh - 140px); }
                
                .excel-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; min-width: 1500px; }
                .excel-table th { background: #0f172a; padding: 0.75rem 0.6rem; text-align: left; color: #64748b; font-weight: 800; font-size: 0.7rem; text-transform: uppercase; border-bottom: 2px solid #334155; position: sticky; top: 0; z-index: 10; border-right: 1px solid rgba(255,255,255,0.05); white-space: nowrap; }
                .excel-table td { padding: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.03); vertical-align: middle; white-space: nowrap; }
                .excel-table tr:hover { background: rgba(255,255,255,0.02); }
                .excel-table tr.variance-row { background: rgba(16, 185, 129, 0.03); }

                .part-no { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #3b82f6; font-weight: 600; }
                .part-no.clickable { cursor: pointer; transition: all 0.2s; }
                .part-no.clickable:hover { color: #60a5fa; text-decoration: underline; background: rgba(59, 130, 246, 0.1); padding: 2px 4px; border-radius: 4px; margin: -2px -4px; }
                .description { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; display: block; font-weight: 500; }
                .remark-detail { color: #94a3b8; font-size: 0.7rem; display: block; overflow: hidden; text-overflow: ellipsis; }
                
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .bold { font-weight: 800; }
                .white { color: #fff; }
                .text-dim { color: #64748b; }
                .text-red { color: #f87171; }
                .text-green { color: #4ade80; }

                .stats-strip-audit { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 0.75rem; }
                .audit-stat-card { background: #1e293b; border: 1px solid #334155; padding: 0.75rem 1rem; border-radius: 0.5rem; display: flex; flex-direction: column; gap: 0.2rem; }
                .audit-stat-card.short { border-left: 4px solid #f87171; }
                .audit-stat-card.excess { border-left: 4px solid #4ade80; }
                .audit-stat-card.stock { border-left: 4px solid #3b82f6; }
                .stat-label { font-size: 0.6rem; color: #64748b; font-weight: 800; text-transform: uppercase; }
                .stat-value { font-size: 1.1rem; color: #fff; font-weight: 900; }
                .audit-stat-card.short .stat-value { color: #f87171; }
                .audit-stat-card.excess .stat-value { color: #4ade80; }

                .remark-group { display: flex; align-items: center; gap: 0.4rem; }
                .rmk-badge { padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.6rem; font-weight: 800; background: #334155; color: #94a3b8; white-space: nowrap; }
                .rmk-badge.damage { background: rgba(239, 68, 68, 0.2); color: #f87171; }
                .rmk-badge.interchange { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
                .dmg-pill { background: #f59e0b; color: #000; padding: 0.1rem 0.3rem; border-radius: 1rem; font-size: 0.6rem; font-weight: 900; }

                .loc-tag, .user-tag, .date-cell, .bin-tag { display: inline-flex; align-items: center; gap: 0.3rem; background: #0f172a; color: #94a3b8; padding: 0.15rem 0.4rem; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 700; }
                .bin-tag { color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
                
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
            `}</style>
        </div>
    );
};

export default FinalSheet;
