import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Scan,
    MapPin,
    Keyboard,
    AlertCircle,
    CheckCircle2,
    Search,
    History as HistoryIcon,
    Plus,
    Trash2,
    Save,
    Info,
    Edit2,
    ArrowRight,
    Zap,
    User as UserIcon
} from 'lucide-react';

const Scanning = () => {
    const { profile } = useAuth();
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(localStorage.getItem('lastLocation') || '');
    const [scanInput, setScanInput] = useState('');
    const [manualPartInput, setManualPartInput] = useState('');
    const [currentData, setCurrentData] = useState({
        id: null,
        partNumber: '',
        scanCode: '',
        description: '',
        binLocation: '',
        currentStock: 0,
        averageCount: 0, // NEW
        phyQty: '',
        difference: 0,
        remarkType: '',
        remarkDetail: '',
        damageQty: 0,
        newBin: '',
        nnCartonNo: '' // NEW
    });

    const [status, setStatus] = useState({ message: '', type: '' });
    const [allScans, setAllScans] = useState([]);
    const [avgCountMap, setAvgCountMap] = useState({}); // NEW
    const [loading, setLoading] = useState(false);

    // Duplicate Scan Modal State
    const [duplicateModal, setDuplicateModal] = useState({ show: false, existingScan: null });

    const scanInputRef = useRef(null);
    const phyQtyRef = useRef(null);
    const damageQtyRef = useRef(null);
    const remarkDetailRef = useRef(null);
    const newBinRef = useRef(null);

    useEffect(() => {
        fetchLocations();
        fetchAllScans();
        if (scanInputRef.current) scanInputRef.current.focus();

        // Polling-based live feed for multi-user scanning (every 5 seconds)
        const pollingInterval = setInterval(() => {
            fetchAllScans();
        }, 5000);

        return () => {
            clearInterval(pollingInterval);
        };
    }, []);

    const fetchLocations = async () => {
        const { data } = await supabase.from('locations').select('*').eq('is_active', true);
        if (data) setLocations(data);
    };

    const fetchAllScans = async () => {
        try {
            // Using new helper to bypass 1000 row limit
            const { fetchAllRecords } = await import('../lib/supabase');
            const data = await fetchAllRecords('scans', '*, locations(name)', null, 'scan_time', false);

            if (data) {
                setAllScans(data);

                // Fetch Average Counts for these parts
                const uniquePNs = [...new Set(data.map(s => s.part_number))];
                if (uniquePNs.length > 0) {
                    const { data: masters } = await supabase
                        .from('average_counts')
                        .select('part_number, average_count')
                        .in('part_number', uniquePNs);

                    if (masters) {
                        const map = {};
                        masters.forEach(m => map[m.part_number] = m.average_count || 0);
                        setAvgCountMap(map);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching scans:', error);
            setStatus({ message: 'Failed to load historical scans.', type: 'error' });
        }
    };

    const handleLocationChange = (val) => {
        setSelectedLocation(val);
        localStorage.setItem('lastLocation', val);
        if (scanInputRef.current) scanInputRef.current.focus();
    };

    const handleScan = async (e) => {
        if (e.key !== 'Enter') return;
        const code = scanInput.trim();
        if (!code) return;

        setLoading(true);
        setStatus({ message: 'Checking...', type: 'info' });

        const detectedPN = code.split(' ')[0].toUpperCase();
        await lookupPart(detectedPN, code);
        setLoading(false);
    };

    const lookupPart = async (pn, code = '') => {
        try {
            // 1. DUPLICATE CHECK
            const { data: existingScan } = await supabase
                .from('scans')
                .select('*, locations(name)')
                .eq('part_number', pn)
                .single();

            if (existingScan) {
                // Show duplicate modal with existing scan details
                setDuplicateModal({ show: true, existingScan });
                setScanInput('');
                setManualPartInput('');
                return;
            }

            // 2. Get Base Info
            const { data: baseInfo, error: baseError } = await supabase
                .from('base_part_master')
                .select('*')
                .eq('part_number', pn)
                .single();

            // 3. Get Daily/Latest Info
            const { data: dailyInfo } = await supabase
                .from('daily_part_master')
                .select('*')
                .eq('part_number', pn)
                .order('upload_date', { ascending: false })
                .limit(1)
                .single();

            // 4. Handle Missing Base Master (but might exist in Daily)
            if (!baseInfo && !dailyInfo) {
                setStatus({ message: `Part ${pn} Missing in BOTH Masters!`, type: 'error' });
                setCurrentData(prev => ({
                    id: null, partNumber: pn, scanCode: code, damageQty: 0,
                    description: '', binLocation: '', currentStock: 0, phyQty: '',
                    difference: 0, remarkType: '', remarkDetail: '', newBin: ''
                }));
                if (phyQtyRef.current) setTimeout(() => phyQtyRef.current.focus(), 50);
                return;
            }

            // 5. Get Average Count (Separate Table)
            const { data: avgData } = await supabase
                .from('average_counts')
                .select('average_count')
                .eq('part_number', pn)
                .single();

            const systemStock = dailyInfo?.latest_stock || baseInfo?.base_stock || 0;
            const systemBin = dailyInfo?.latest_bin || baseInfo?.default_bin || 'NO BIN';
            const description = baseInfo?.description || 'No Master Desc';
            const category = baseInfo?.category || 'Unknown';

            setCurrentData({
                id: null,
                partNumber: pn,
                scanCode: code,
                description: description,
                binLocation: systemBin,
                currentStock: systemStock,
                averageCount: avgData?.average_count || 0,
                phyQty: '',
                difference: -systemStock,
                remarkType: '',
                remarkDetail: '',
                nnCartonNo: '', // Reset NN Carton
                damageQty: 0,
                newBin: ''
            });

            setStatus({ message: `Part ${pn} ready.`, type: 'success' });
            if (phyQtyRef.current) setTimeout(() => phyQtyRef.current.focus(), 50);

        } catch (err) {
            console.error(err);
            setStatus({ message: 'Error fetching data.', type: 'error' });
        }
    };

    const handlePhyQtyChange = (val) => {
        const qty = parseFloat(val) || 0;
        setCurrentData(prev => ({
            ...prev,
            phyQty: val,
            difference: qty - prev.currentStock
        }));
    };

    const handlePhyQtyKeyDown = (e) => {
        if (e.key.toLowerCase() === 'd') {
            e.preventDefault();
            setCurrentData(prev => ({ ...prev, remarkType: 'Damage' }));
            if (damageQtyRef.current) setTimeout(() => damageQtyRef.current.focus(), 50);
        }
        else if (e.key.toLowerCase() === 'n') {
            e.preventDefault();
            setCurrentData(prev => ({ ...prev, remarkDetail: 'NN' }));
            // We'll focus the NN Carton No input next
            setTimeout(() => {
                const nnInput = document.getElementById('nn-carton-input');
                if (nnInput) nnInput.focus();
            }, 50);
        }
        else if (e.key === '`') {
            e.preventDefault();
            if (newBinRef.current) setTimeout(() => newBinRef.current.focus(), 50);
        }
        else if (e.key === 'Enter') {
            handleSave();
        }
    };

    const handleSave = async () => {
        if (!currentData.partNumber || !selectedLocation || currentData.phyQty === '') {
            setStatus({ message: 'Location & Qty is required!', type: 'error' });
            if (phyQtyRef.current) phyQtyRef.current.focus();
            return;
        }

        setLoading(true);
        try {
            const scanData = {
                part_number: currentData.partNumber,
                scan_code: currentData.scanCode,
                description: currentData.description,
                system_stock: currentData.currentStock,
                physical_qty: parseFloat(currentData.phyQty),
                difference: currentData.difference,
                actual_bin: currentData.binLocation,
                new_bin_location: currentData.newBin,
                remark_type: currentData.remarkType,
                remark_detail: currentData.remarkDetail,
                damage_qty: parseFloat(currentData.damageQty) || 0,
                nn_carton_no: currentData.nnCartonNo, // NEW
                scanned_by: profile?.username || 'Admin',
                location_id: selectedLocation,
                pc_name: 'PC-1'
            };

            const { error } = currentData.id
                ? await supabase.from('scans').update(scanData).eq('id', currentData.id)
                : await supabase.from('scans').insert([scanData]);

            if (error) throw error;

            setStatus({ message: `Part ${currentData.partNumber} Saved!`, type: 'success' });
            await fetchAllScans();

            // RESET & FOCUS SCAN
            setCurrentData({
                id: null, partNumber: '', scanCode: '', description: '', binLocation: '',
                currentStock: 0, phyQty: '', difference: 0, remarkType: '', remarkDetail: '',
                damageQty: 0, newBin: '',
                nnCartonNo: '' // RESET
            });
            setScanInput('');
            setManualPartInput('');
            if (scanInputRef.current) setTimeout(() => scanInputRef.current.focus(), 50);

        } catch (err) {
            setStatus({ message: 'Error: ' + err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (scan) => {
        setCurrentData({
            id: scan.id,
            partNumber: scan.part_number,
            scanCode: scan.scan_code || '',
            description: scan.description || '',
            binLocation: scan.actual_bin || '',
            currentStock: scan.system_stock || 0,
            phyQty: scan.physical_qty.toString(),
            difference: scan.difference || 0,
            remarkType: scan.remark_type || '',
            remarkDetail: scan.remark_detail || '',
            damageQty: scan.damage_qty || 0,
            newBin: scan.new_bin_location || '',
            nnCartonNo: scan.nn_carton_no || '' // EDIT LOAD
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (phyQtyRef.current) setTimeout(() => phyQtyRef.current.focus(), 300);
    };

    const handleDelete = async (scan, e) => {
        e.stopPropagation(); // Prevent triggering handleEdit

        const confirmDelete = window.confirm(
            `Delete scan entry for ${scan.part_number}?\n\nScanned by: ${scan.scanned_by}\nQty: ${scan.physical_qty}\n\nThis action cannot be undone.`
        );

        if (!confirmDelete) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('scans')
                .delete()
                .eq('id', scan.id);

            if (error) throw error;

            setStatus({ message: `Entry for ${scan.part_number} deleted successfully!`, type: 'success' });
            await fetchAllScans();
        } catch (err) {
            setStatus({ message: 'Error deleting entry: ' + err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAll = async () => {
        if (allScans.length === 0) {
            setStatus({ message: 'No scans to delete!', type: 'error' });
            return;
        }

        const confirmDelete = window.confirm(
            `⚠️ DELETE ALL SCANS?\n\nThis will permanently delete all ${allScans.length} scan entries.\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`
        );

        if (!confirmDelete) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('scans')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (error) throw error;

            setStatus({ message: `All ${allScans.length} entries deleted successfully!`, type: 'success' });
            await fetchAllScans();
        } catch (err) {
            setStatus({ message: 'Error deleting all entries: ' + err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fast-scan-container">
            {/* Minimal Header */}
            <div className="fast-header">
                <div className="loc-wrap">
                    <MapPin size={16} />
                    <select value={selectedLocation} onChange={(e) => handleLocationChange(e.target.value)}>
                        <option value="">-- Click to Select Location --</option>
                        {locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                    </select>
                </div>
                <div className="hints">
                    <span><UserIcon size={14} className="inline-icon" /> {profile?.username || 'Admin'}</span>
                    <span><kbd>Enter</kbd> Save</span>
                    <span><kbd>D</kbd> Damage</span>
                    <span><kbd>N</kbd> NN Remark</span>
                    <span><kbd>`</kbd> New Bin</span>
                </div>
                <button className="delete-all-btn" onClick={handleDeleteAll} title="Delete all scan entries">
                    <Trash2 size={16} />
                    Delete All ({allScans.length})
                </button>
            </div>

            {/* Top Scanning Pad */}
            <div className="scan-pad">
                <div className="pad-group">
                    <label>SCAN CODE</label>
                    <input
                        ref={scanInputRef} type="text"
                        value={scanInput} onChange={(e) => setScanInput(e.target.value)}
                        onKeyDown={handleScan} placeholder="Scan now..."
                        disabled={!selectedLocation}
                    />
                </div>
                <div className="pad-group">
                    <label>MANUAL PN</label>
                    <input
                        type="text" value={manualPartInput}
                        onChange={(e) => setManualPartInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && lookupPart(manualPartInput)}
                        placeholder="Type PN..." disabled={!selectedLocation}
                    />
                </div>
                {status.message && (
                    <div className={`pad-status ${status.type}`}>
                        {status.type === 'error' && <AlertCircle size={16} />}
                        {status.message}
                    </div>
                )}
            </div>

            {/* THE SPREADSHEET */}
            <div className="spreadsheet-wrapper">
                <div className="ss-table border-glow">
                    <div className="ss-header">
                        <div className="h-col pn">Part Number</div>
                        <div className="h-col sc">Scan Code</div>
                        <div className="h-col qty">Phy Qty</div>
                        <div className="h-col dsc">Description</div>
                        <div className="h-col bin">Old Bin</div>
                        <div className="h-col stk">Stk</div>
                        <div className="h-col avg">Avg</div>
                        <div className="h-col dif">Diff</div>
                        <div className="h-col dmq">Dmg Qty</div>
                        <div className="h-col rem">Remark</div>
                        <div className="h-col rmx">Remark Details</div>
                        <div className="h-col ctn">Carton No</div>
                        <div className="h-col nbl">New Bin</div>
                        <div className="h-col act">Action</div>
                    </div>

                    {/* ALWAYS VISIBLE ENTRY ROW */}
                    <div className={`ss-row entry-row ${currentData.id ? 'is-edit' : ''}`}>
                        <div className="h-col pn"><input readOnly value={currentData.partNumber} /></div>
                        <div className="h-col sc"><input readOnly value={currentData.scanCode} /></div>
                        <div className="h-col qty">
                            <input
                                ref={phyQtyRef} type="number"
                                value={currentData.phyQty} onChange={(e) => handlePhyQtyChange(e.target.value)}
                                onKeyDown={handlePhyQtyKeyDown}
                            />
                        </div>
                        <div className="h-col dsc"><input readOnly value={currentData.description} /></div>
                        <div className="h-col bin"><input readOnly value={currentData.binLocation} /></div>
                        <div className="h-col stk"><input readOnly value={currentData.currentStock} /></div>
                        <div className="h-col avg"><input readOnly value={currentData.averageCount || 0} style={{ color: '#a855f7' }} /></div>
                        <div className="h-col dif">
                            <input readOnly value={currentData.difference} className={currentData.difference < 0 ? 'minus' : currentData.difference > 0 ? 'plus' : ''} />
                        </div>
                        <div className="h-col dmq">
                            <input
                                ref={damageQtyRef} type="number"
                                value={currentData.damageQty} onChange={(e) => setCurrentData(prev => ({ ...prev, damageQty: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                className="dmg-input"
                            />
                        </div>
                        <div className="h-col rem">
                            <select value={currentData.remarkType} onChange={(e) => setCurrentData(prev => ({ ...prev, remarkType: e.target.value }))}>
                                <option value="">None</option>
                                <option value="Damage">Damage</option>
                                <option value="Interchange">Interchange</option>
                                <option value="Manual">Manual</option>
                            </select>
                        </div>
                        <div className="h-col rmx">
                            <input
                                ref={remarkDetailRef} type="text"
                                value={currentData.remarkDetail} onChange={(e) => setCurrentData(prev => ({ ...prev, remarkDetail: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                placeholder="Detail..."
                            />
                        </div>
                        <div className="h-col ctn">
                            <input
                                id="nn-carton-input"
                                type="text"
                                value={currentData.nnCartonNo} onChange={(e) => setCurrentData(prev => ({ ...prev, nnCartonNo: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                placeholder="Carton..."
                            />
                        </div>
                        <div className="h-col nbl">
                            <input
                                ref={newBinRef} type="text"
                                value={currentData.newBin} onChange={(e) => setCurrentData(prev => ({ ...prev, newBin: e.target.value.toUpperCase() }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                placeholder="New..."
                            />
                        </div>
                        <div className="h-col act">
                            <button className="save-btn" onClick={handleSave} disabled={loading || !currentData.partNumber}>
                                {currentData.id ? <ArrowRight size={14} /> : <Save size={14} />}
                                {currentData.id ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>

                    {/* HISTORY ROWS */}
                    <div className="history-pane">
                        {allScans.map((scan, i) => (
                            <div key={scan.id} className="ss-row hist-row" onClick={() => handleEdit(scan)}>
                                <div className="h-col pn">{scan.part_number}</div>
                                <div className="h-col sc truncate">{scan.scan_code}</div>
                                <div className="h-col qty bold">{scan.physical_qty}</div>
                                <div className="h-col dsc truncate">{scan.description}</div>
                                <div className="h-col bin">{scan.actual_bin || '---'}</div>
                                <div className="h-col stk">{scan.system_stock}</div>
                                <div className="h-col avg" style={{ color: '#a855f7' }}>{avgCountMap[scan.part_number] || 0}</div>
                                <div className={`h-col dif ${scan.difference < 0 ? 'minus' : scan.difference > 0 ? 'plus' : ''}`}>
                                    {scan.difference > 0 ? '+' + scan.difference : scan.difference}
                                </div>
                                <div className="h-col dmq bold text-orange">{scan.damage_qty || 0}</div>
                                <div className="h-col rem">{scan.remark_type}</div>
                                <div className="h-col rmx truncate">{scan.remark_detail}</div>
                                <div className="h-col ctn">{scan.nn_carton_no || '---'}</div>
                                <div className="h-col nbl">{scan.new_bin_location}</div>
                                <div className="h-col act">
                                    <div className="action-buttons">
                                        <div className="user-tag">{scan.scanned_by}</div>
                                        <button
                                            className="delete-btn"
                                            onClick={(e) => handleDelete(scan, e)}
                                            title="Delete this entry"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* DUPLICATE SCAN MODAL */}
            {
                duplicateModal.show && duplicateModal.existingScan && (
                    <div className="modal-overlay" onClick={() => setDuplicateModal({ show: false, existingScan: null })}>
                        <div className="duplicate-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <AlertCircle size={24} color="#f59e0b" />
                                <h3>Duplicate Part Detected</h3>
                            </div>
                            <div className="modal-body">
                                <div className="dup-info-row">
                                    <span className="dup-label">Part Number:</span>
                                    <span className="dup-value part-no">{duplicateModal.existingScan.part_number}</span>
                                </div>
                                <div className="dup-info-row">
                                    <span className="dup-label">Description:</span>
                                    <span className="dup-value">{duplicateModal.existingScan.description}</span>
                                </div>
                                <div className="dup-info-row">
                                    <span className="dup-label">Scanned By:</span>
                                    <span className="dup-value user-highlight">
                                        <UserIcon size={14} />
                                        {duplicateModal.existingScan.scanned_by}
                                    </span>
                                </div>
                                <div className="dup-info-row">
                                    <span className="dup-label">Scanned At:</span>
                                    <span className="dup-value">{new Date(duplicateModal.existingScan.created_at).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="dup-info-row">
                                    <span className="dup-label">Location:</span>
                                    <span className="dup-value">{duplicateModal.existingScan.locations?.name || 'Unknown'}</span>
                                </div>
                                <div className="dup-info-row">
                                    <span className="dup-label">Current Stock:</span>
                                    <span className="dup-value">{duplicateModal.existingScan.system_stock}</span>
                                </div>
                                <div className="dup-info-row">
                                    <span className="dup-label">Physical Qty:</span>
                                    <span className="dup-value qty-highlight">{duplicateModal.existingScan.physical_qty}</span>
                                </div>
                                <div className="dup-info-row">
                                    <span className="dup-label">Difference:</span>
                                    <span className={`dup-value ${duplicateModal.existingScan.difference < 0 ? 'diff-negative' : duplicateModal.existingScan.difference > 0 ? 'diff-positive' : ''}`}>
                                        {duplicateModal.existingScan.difference}
                                    </span>
                                </div>
                                <div className="modal-warning">
                                    <Info size={16} />
                                    <span>This part has already been scanned. You can edit the existing entry or cancel.</span>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button
                                    className="btn-edit"
                                    onClick={() => {
                                        handleEdit(duplicateModal.existingScan);
                                        setDuplicateModal({ show: false, existingScan: null });
                                    }}
                                >
                                    <Edit2 size={16} />
                                    Edit Existing Entry
                                </button>
                                <button
                                    className="btn-cancel"
                                    onClick={() => setDuplicateModal({ show: false, existingScan: null })}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style jsx="true">{`
                .fast-scan-container {
                    padding: 0;
                    background: #111;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    font-family: 'Inter', sans-serif;
                }

                .fast-header {
                    background: #222;
                    border-bottom: 1px solid #333;
                    padding: 0.5rem 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .loc-wrap select {
                    background: #000;
                    border: 1px solid #444;
                    color: white;
                    padding: 0.3rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.85rem;
                    outline: none;
                    min-width: 250px;
                }

                .hints { display: flex; gap: 1.5rem; font-size: 0.75rem; color: #666; }
                kbd { background: #444; color: #eee; padding: 1px 5px; border-radius: 3px; font-size: 0.7rem; margin-right: 3px; }
                .user-tag { background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }

                .action-buttons {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .delete-btn {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .delete-btn:hover {
                    background: rgba(239, 68, 68, 0.2);
                    border-color: #ef4444;
                    transform: scale(1.1);
                }

                .delete-all-btn {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    color: #ef4444;
                    padding: 6px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }

                .delete-all-btn:hover {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.25) 100%);
                    border-color: #ef4444;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                }

                .delete-all-btn:hover {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.25) 100%);
                    border-color: #ef4444;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                }
                .pad-group label { font-size: 0.7rem; font-weight: 700; color: #888; }
                .pad-group input { background: #000; border: 1px solid #333; color: #fff; padding: 0.6rem 1rem; border-radius: 6px; font-size: 1rem; outline: none; width: 300px; }
                .pad-group input:focus { border-color: #3b82f6; }

                .pad-status { font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: 4px; display: flex; align-items: center; gap: 0.5rem; }
                .pad-status.success { color: #22c55e; }
                .pad-status.error { color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); }
                .pad-status.info { color: #3b82f6; }

                .spreadsheet-wrapper { flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 0.5rem; }
                .ss-table { border: 1px solid #333; display: flex; flex-direction: column; height: 100%; background: #000; }
                .border-glow { box-shadow: 0 0 15px rgba(59, 130, 246, 0.05); }

                .ss-header, .ss-row {
                    display: grid;
                    grid-template-columns: 120px 140px 80px 1fr 100px 70px 70px 80px 80px 110px 140px 100px 100px 140px;
                    border-bottom: 1px solid #222;
                }

                .ss-header { background: #222; position: sticky; top: 0; z-index: 10; }
                .h-col { padding: 0.5rem; font-size: 0.75rem; color: #999; font-weight: 600; border-right: 1px solid #222; display: flex; align-items: center; overflow: hidden; white-space: nowrap; }
                .ss-header .h-col { text-transform: uppercase; color: #555; }
                .h-col.pn { color: #fff; font-weight: 600; }
                .h-col.sc { color: #888; font-size: 0.85rem; }
                .h-col.qty input { background: #333; border: 1px solid #444; color: #fff; width: 60px; padding: 4px; border-radius: 4px; text-align: right; }
                .h-col.qty input:focus { border-color: #3b82f6; background: #000; }
                .h-col.dsc { color: #aaa; font-size: 0.85rem; }
                .h-col.bin { color: #f59e0b; font-family: monospace; }
                .h-col.stk, .h-col.avg { color: #666; justify-content: flex-end; }

                .entry-row { background: #1e293b; height: 40px; }
                .entry-row input, .entry-row select { width: 100%; background: transparent; border: none; color: white; font-size: 0.9rem; outline: none; padding: 0.2rem; }
                .entry-row input:focus { background: #000; color: #3b82f6; }
                .dmg-input { background: rgba(245, 158, 11, 0.1) !important; color: #f59e0b !important; }

                .is-edit { border: 2px solid #f59e0b; background: #2d261a; }

                .history-pane { flex: 1; overflow-y: auto; }
                .hist-row { height: 32px; cursor: pointer; transition: background 0.1s; }
                .hist-row:hover { background: #111; }
                .hist-row .h-col { color: #ccc; font-size: 0.8rem; }
                
                .user-tag { font-size: 0.65rem; background: #333; padding: 2px 6px; border-radius: 4px; color: #888; }
                .text-orange { color: #f59e0b !important; }
                .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .bold { font-weight: 800; }
                .plus { color: #22c55e !important; }
                .minus { color: #ef4444 !important; }

                .save-btn { background: #3b82f6; color: white; border: none; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 3px; cursor: pointer; }
                .save-btn:hover { background: #2563eb; }

                @media (max-width: 1500px) {
                    .spreadsheet-wrapper { overflow-x: auto; }
                    .ss-header, .ss-row { width: 1500px; }
                }

                /* DUPLICATE SCAN MODAL */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    animation: fadeIn 0.2s ease;
                }

                .duplicate-modal {
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    border-radius: 12px;
                    padding: 0;
                    width: 90%;
                    max-width: 550px;
                    box-shadow: 0 20px 60px rgba(245, 158, 11, 0.2);
                    animation: slideUp 0.3s ease;
                }

                .modal-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 20px 24px;
                    border-bottom: 1px solid rgba(245, 158, 11, 0.2);
                    background: rgba(245, 158, 11, 0.05);
                }

                .modal-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    color: #f59e0b;
                    font-weight: 700;
                }

                .modal-body {
                    padding: 24px;
                }

                .dup-info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .dup-info-row:last-of-type {
                    border-bottom: none;
                }

                .dup-label {
                    color: #94a3b8;
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .dup-value {
                    color: #e2e8f0;
                    font-size: 0.95rem;
                    font-weight: 600;
                }

                .dup-value.part-no {
                    font-family: 'JetBrains Mono', monospace;
                    color: #60a5fa;
                    font-size: 1rem;
                }

                .dup-value.user-highlight {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #10b981;
                    background: rgba(16, 185, 129, 0.1);
                    padding: 4px 12px;
                    border-radius: 6px;
                }

                .dup-value.qty-highlight {
                    color: #fbbf24;
                    font-size: 1.1rem;
                }

                .dup-value.diff-negative {
                    color: #ef4444;
                    font-weight: 700;
                }

                .dup-value.diff-positive {
                    color: #10b981;
                    font-weight: 700;
                }

                .modal-warning {
                    margin-top: 20px;
                    padding: 12px 16px;
                    background: rgba(245, 158, 11, 0.1);
                    border-left: 3px solid #f59e0b;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #fbbf24;
                    font-size: 0.875rem;
                }

                .modal-actions {
                    padding: 20px 24px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                .modal-actions button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .btn-edit {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                }

                .btn-edit:hover {
                    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }

                .btn-cancel {
                    background: rgba(255, 255, 255, 0.05);
                    color: #cbd5e1;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .btn-cancel:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div >
    );
};

export default Scanning;
