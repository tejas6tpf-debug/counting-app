import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, TrendingDown, Package, DollarSign, Activity } from 'lucide-react';

const Dashboard = () => {
    const [metrics, setMetrics] = useState({
        totalPartCount: 0,
        totalValue: 0,
        totalShortQty: 0,
        totalShortValue: 0,
        totalExcessQty: 0,
        totalExcessValue: 0,
        netImpact: 0,
        netImpactPercent: 0,
        scannedCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        calculateMetrics();
        const subscription = supabase.channel('dashboard_metrics').on('postgres_changes', { event: '*', schema: 'public', table: 'scans' }, () => {
            calculateMetrics();
        }).subscribe();
        return () => { supabase.removeChannel(subscription); };
    }, []);

    const calculateMetrics = async () => {
        const { data: scans } = await supabase.from('scans').select('*');
        const { data: baseMaster } = await supabase.from('base_part_master').select('part_number, purchase_price, base_stock');
        if (!scans || !baseMaster) { setLoading(false); return; }

        let totalShortQty = 0, totalShortValue = 0, totalExcessQty = 0, totalExcessValue = 0, scannedValue = 0;
        scans.forEach(scan => {
            const diff = scan.physical_qty - scan.system_stock;
            const partValue = (baseMaster.find(b => b.part_number === scan.part_number)?.purchase_price || 0);
            if (diff < 0) { totalShortQty += Math.abs(diff); totalShortValue += Math.abs(diff) * partValue; }
            else if (diff > 0) { totalExcessQty += diff; totalExcessValue += diff * partValue; }
            scannedValue += scan.physical_qty * partValue;
        });

        const netImpact = totalExcessValue - totalShortValue;
        const totalBaseValue = baseMaster.reduce((acc, curr) => acc + (curr.base_stock * curr.purchase_price), 0);
        const netImpactPercent = totalBaseValue ? (netImpact / totalBaseValue) * 100 : 0;

        setMetrics({ totalPartCount: baseMaster.length, totalValue: totalBaseValue, totalShortQty, totalShortValue, totalExcessQty, totalExcessValue, netImpact, netImpactPercent, scannedCount: scans.length });
        setLoading(false);
    };

    const MetricCard = ({ title, value, subValue, icon: Icon, colorClass, isCurrency }) => (
        <div className={`metric-card`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className={`icon-box ${colorClass}`} style={{ padding: '0.5rem', borderRadius: '0.5rem' }}><Icon size={20} /></div>
                <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{title}</span>
            </div>
            <h2 className="metric-value">
                {isCurrency ? `₹${value.toLocaleString()}` : value.toLocaleString()}
            </h2>
            {subValue && <div style={{ color: '#64748b', fontSize: '0.8125rem' }}>{subValue}</div>}
        </div>
    );

    return (
        <div className="dashboard-container">
            <div className="page-header">
                <div className="header-info">
                    <BarChart3 size={32} className="header-icon" />
                    <div>
                        <h1>Counting Summary Dashboard</h1>
                        <p>Live metrics for Physical Stock Taking – FY 2024-25</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>Calculating live data...</div>
            ) : (
                <div className="dashboard-grid">
                    <MetricCard title="Counting Progress" value={metrics.scannedCount} subValue={`of ${metrics.totalPartCount} total parts`} icon={Package} colorClass="blue" />
                    <MetricCard title="Total Stock Value" value={metrics.totalValue} icon={DollarSign} colorClass="indigo" isCurrency={true} />
                    <MetricCard title="Total Shortage" value={metrics.totalShortValue} subValue={`${metrics.totalShortQty} parts short`} icon={TrendingDown} colorClass="red" isCurrency={true} />
                    <MetricCard title="Total Excess" value={metrics.totalExcessValue} subValue={`${metrics.totalExcessQty} parts excess`} icon={TrendingUp} colorClass="green" isCurrency={true} />

                    <div className="card" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#3b82f6', marginBottom: '1.5rem' }}>
                            <Activity size={24} />
                            <h3 style={{ margin: 0, color: 'white' }}>Net Impact</h3>
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <span style={{ fontSize: '3rem', fontWeight: 800, color: metrics.netImpact >= 0 ? '#22c55e' : '#ef4444' }}>
                                {metrics.netImpact >= 0 ? '+' : ''}{metrics.netImpact.toLocaleString()}
                            </span>
                            <div style={{ color: '#94a3b8', marginTop: '0.5rem' }}>{metrics.netImpactPercent.toFixed(4)}% of Net Assets</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
