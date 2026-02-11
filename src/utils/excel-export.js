import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export const exportStockSummary = async () => {
    try {
        // 1. Fetch ALL Scans first (this is the core of the Final Sheet)
        const { data: scans, error: scanErr } = await supabase
            .from('scans')
            .select('*, locations(name)')
            .order('created_at', { ascending: false });

        if (scanErr || !scans) throw new Error('Failed to fetch scans');

        // 2. Identify unique parts needed for enrichment
        const uniquePNs = [...new Set(scans.map(s => s.part_number))];

        // 3. Fetch Master data specifically for these parts (bypasses 1000-row limit)
        const { data: baseMaster } = await supabase
            .from('base_part_master')
            .select('*')
            .in('part_number', uniquePNs);

        if (!baseMaster) throw new Error('Failed to fetch master data');

        const masterMap = {};
        baseMaster.forEach(m => {
            const key = String(m.part_number || '').trim().toUpperCase();
            masterMap[key] = m;
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
                'PART DESCRIPTION': scan.description || master.description || '---',
                'BIN LOCATION': master.default_bin || '---',
                'CURRENT STOCK': scan.system_stock,
                'PHY. QTY': scan.physical_qty,
                'DIFF. QTY': diff,
                'DDL': ddl,
                'DIFF VALUE': diff * ddl,
                'STOCK VALUE': (scan.system_stock || 0) * ddl,
                'REMARK (Dmg/Intchg)': scan.remark_type ? `${scan.remark_type}${scan.damage_qty > 0 ? ` (${scan.damage_qty} Qty)` : ''}` : '',
                'REMARK 1 (NN)': scan.remark_detail || '',
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
