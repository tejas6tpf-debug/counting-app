import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export const exportStockSummary = async () => {
    try {
        // 1. Fetch ALL Scans first (this is the core of the Final Sheet)
        // Using new helper to bypass 1000 row limit
        const { fetchAllRecords } = await import('../lib/supabase');
        const scans = await fetchAllRecords('scans', '*, locations(name)', null, 'created_at', false);

        if (!scans || scans.length === 0) throw new Error('No scan data found');

        // 2. Identify unique parts needed for enrichment
        const uniquePNs = [...new Set(scans.map(s => s.part_number))];

        // 3. Fetch Master data specifically for these parts (Chunked)
        // Using fetchByPartNumbers helper
        const baseMaster = await import('../lib/supabase').then(mod => mod.fetchByPartNumbers('base_part_master', uniquePNs));

        // Fetch Average Counts (Dedicated Table)
        const avgMasters = await import('../lib/supabase').then(mod => mod.fetchByPartNumbers('average_counts', uniquePNs, 'part_number', 'part_number, average_count'));

        if (!baseMaster) throw new Error('Failed to fetch master data');

        const masterMap = {};
        baseMaster.forEach(m => {
            const key = String(m.part_number || '').trim().toUpperCase();
            masterMap[key] = { ...m, average_count: 0 };
        });

        avgMasters?.forEach(am => {
            const key = String(am.part_number || '').trim().toUpperCase();
            if (masterMap[key]) {
                masterMap[key].average_count = am.average_count;
            } else {
                masterMap[key] = { part_number: am.part_number, average_count: am.average_count };
            }
        });

        // 4. Process Only Scanned Items
        const fullAuditList = [];
        scans?.forEach((scan, idx) => {
            const scanKey = String(scan.part_number || '').trim().toUpperCase();
            const master = masterMap[scanKey] || {};
            const ddl = master.purchase_price || 0;
            const diff = (scan.physical_qty || 0) - (scan.system_stock || 0);

            fullAuditList.push({
                'SR NO': idx + 1,
                'PART NUM': scan.part_number,
                'PART DESCRIPTION': master.description || scan.description || '---',
                'BIN LOCATION': master.default_bin || scan.actual_bin || '---',
                'CURRENT STOCK': scan.system_stock,
                'PHY. QTY': scan.physical_qty,
                'AVG COUNT': master.average_count || 0, // NEW
                'DIFF. QTY': diff,
                'DDL': ddl,
                'DIFF VALUE': diff * ddl,
                'STOCK VALUE': (scan.system_stock || 0) * ddl,
                'REMARK (Dmg/Intchg)': scan.remark_type ? `${scan.remark_type}${scan.damage_qty > 0 ? ` (${scan.damage_qty} Qty)` : ''}` : '',
                'REMARK 1 (NN)': scan.remark_detail || '',
                'NN CARTON NO': scan.nn_carton_no || '', // NEW
                'NEW LOC': scan.new_bin_location || '',
                'WAREHOUSE': scan.locations?.name || '---',
                'DATE': new Date(scan.created_at).toLocaleDateString('en-IN'),
                'USER': scan.scanned_by
            });
        });

        // 4. Create Workbook with Single Sheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(fullAuditList);
        XLSX.utils.book_append_sheet(wb, ws, 'Final Audit Sheet');

        // 5. Build and Save
        const fileName = `FINAL_AUDIT_REPORT_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        return true;
    } catch (error) {
        console.error('Export Error:', error);
        return false;
    }
};

export const exportFilteredReport = (data, reportName = 'REPORT') => {
    try {
        if (!data || data.length === 0) {
            alert('No data to export!');
            return;
        }

        const exportData = data.map((item, idx) => {
            const row = {
                'SR NO': idx + 1,
                'PART NUM': item.part_number,
                'PART DESCRIPTION': item.description || '---',
                'BIN LOCATION': item.master_loc || '---',
                'CURRENT STOCK': item.system_stock || 0,
            };

            // Add columns based on availability (Scanned vs Non-Scanned)
            if (item.physical_qty !== undefined) {
                row['PHY. QTY'] = item.physical_qty;
                row['CAT'] = item.category || '---';
                row['AVG COUNT'] = item.avg_count || 0;
                row['DIFF. QTY'] = item.diff || 0;
                row['DDL'] = item.ddl || 0;
                row['DIFF VALUE'] = item.diff_value || 0;
                row['REMARK'] = item.remark_type ? `${item.remark_type}${item.damage_qty > 0 ? ` (${item.damage_qty} Qty)` : ''}` : '';
                row['NN REMARK'] = item.remark_detail || '';
                row['CARTON NO'] = item.nn_carton_no || '';
                row['W\'HOUSE'] = item.warehouse_loc || '---';
            } else {
                // Non-counted specific columns
                row['AVG COUNT'] = item.avg_count || 0;
                row['CAT'] = item.category || '---'; // NEW
                row['DDL'] = item.ddl || 0;
                row['STOCK VALUE'] = item.stock_value || 0;
            }

            return row;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, reportName);

        const fileName = `${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        return true;
    } catch (error) {
        console.error('Export Error:', error);
        alert('Export failed: ' + error.message);
        return false;
    }
};
