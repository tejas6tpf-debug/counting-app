import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { Database, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const PartMasters = () => {
    const [baseMasterExists, setBaseMasterExists] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState({ message: '', type: '' });

    useEffect(() => { checkBaseMaster(); }, []);

    const checkBaseMaster = async () => {
        const { count, error } = await supabase.from('base_part_master').select('*', { count: 'exact', head: true });
        if (error) console.error('Error checking base master:', error);
        else setBaseMasterExists(count > 0);
        setLoading(false);
    };

    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true); setUploadStatus({ message: 'Reading file...', type: 'info' });
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 'A' });
                const rows = data.slice(1);
                if (type === 'base') await uploadBaseMaster(rows);
                else await uploadDailyMaster(rows);
            } catch (err) { setUploadStatus({ message: 'Error processing file: ' + err.message, type: 'error' }); }
            finally { setUploading(false); e.target.value = null; }
        };
        reader.readAsBinaryString(file);
    };

    const uploadBaseMaster = async (rows) => {
        if (baseMasterExists) { setUploadStatus({ message: 'Base Part Master is already locked.', type: 'error' }); return; }
        const formattedData = rows.map(row => ({ part_number: String(row['B'] || '').toUpperCase().trim(), description: row['D'] || '', category: row['E'] || '', default_bin: row['F'] || '', purchase_price: parseFloat(row['G'] || 0), base_stock: parseFloat(row['L'] || 0) })).filter(item => item.part_number);
        const { error } = await supabase.from('base_part_master').insert(formattedData);
        if (error) setUploadStatus({ message: 'Upload failed: ' + error.message, type: 'error' });
        else { setUploadStatus({ message: 'Base Part Master uploaded successfully!', type: 'success' }); setBaseMasterExists(true); }
    };

    const handleDeleteMaster = async (type) => {
        const tableName = type === 'base' ? 'base_part_master' : 'daily_part_master';
        const label = type === 'base' ? 'Base Part Master' : 'Daily/Recent Master';

        if (!window.confirm(`⚠️ KYA AAP SURE HAIN? ⚠️\n\nYe "${label}" ka saara data permanent delete kar dega.`)) return;

        setLoading(true);
        try {
            const { error } = await supabase.from(tableName).delete().neq('part_number', 'EXTREME_DUMMY_VALUE_TO_DELETE_ALL');
            if (error) throw error;

            setUploadStatus({ message: `${label} cleared successfully!`, type: 'success' });
            if (type === 'base') setBaseMasterExists(false);
        } catch (err) {
            setUploadStatus({ message: 'Delete failed: ' + err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="header-info">
                    <Database size={32} className="header-icon" />
                    <div>
                        <h1>Part Master Management</h1>
                        <p>Upload base records and daily reference stock</p>
                    </div>
                </div>
            </div>

            <div className="master-sections" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className={`card ${baseMasterExists ? 'locked' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Base Part Master</h3>
                        {baseMasterExists ? <CheckCircle2 color="#22c55e" /> : <AlertCircle color="#f59e0b" />}
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Decides counting scope. <strong>Upload only once.</strong> Permanent and immutable.</p>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {baseMasterExists ? (
                            <>
                                <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '0.8rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, flex: 1 }}>
                                    <Info size={16} /><span>Base Master is Locked</span>
                                </div>
                                <button className="btn-ghost" onClick={() => handleDeleteMaster('base')} style={{ color: '#ef4444' }}>
                                    Delete Master
                                </button>
                            </>
                        ) : (
                            <label className="btn-primary" style={{ cursor: 'pointer', flex: 1 }}>
                                <Upload size={18} /><span>Upload Base Master</span>
                                <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'base')} hidden />
                            </label>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Daily / Recent Master</h3>
                        <FileSpreadsheet color="#3b82f6" />
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Reference for latest bin and system stock. Can be uploaded multiple times.</p>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <label className="btn-primary" style={{ cursor: 'pointer', background: '#6366f1', flex: 1 }}>
                            <Upload size={18} /><span>Upload Daily Master</span>
                            <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'daily')} hidden />
                        </label>
                        <button className="btn-ghost" onClick={() => handleDeleteMaster('daily')} title="Clear all daily master data">
                            Clear All
                        </button>
                    </div>
                </div>
            </div>

            {uploadStatus.message && (
                <div className={`status-box ${uploadStatus.type}`} style={{ position: 'fixed', bottom: '2rem', right: '2rem', marginBottom: 0, width: 'auto', boxShadow: '0 10px 15px rgba(0,0,0,0.5)' }}>
                    <span>{uploadStatus.message}</span>
                    <button onClick={() => setUploadStatus({ message: '', type: '' })} style={{ background: 'transparent', border: 'none', color: 'inherit', marginLeft: '1rem', cursor: 'pointer' }}>×</button>
                </div>
            )}

            {uploading && (
                <div className="modal-overlay"><div style={{ textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto 1rem' }}></div><p>Processing Spreadsheet...</p></div></div>
            )}
        </div>
    );
};

export default PartMasters;
