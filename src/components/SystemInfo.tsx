import React, { useEffect, useState } from 'react';
import { Laptop, Cpu, Battery, Box } from 'lucide-react';

const SystemInfo: React.FC = () => {
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadInfo = async () => {
            try {
                const data = await window.ipcRenderer.getSystemDetails();
                setInfo(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadInfo();
    }, []);

    if (loading) return <div style={{ padding: 40, color: 'white' }}>Loading System Info...</div>;
    if (!info) return <div style={{ padding: 40, color: 'white' }}>Failed to load info.</div>;

    const InfoCard = ({ title, icon: Icon, children }: any) => (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '24px',
            marginBottom: '24px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                    <Icon size={20} color="var(--accent-color)" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{title}</h3>
            </div>
            <div>{children}</div>
        </div>
    );

    const Row = ({ label, value }: any) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
        </div>
    );

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', marginBottom: '32px' }}>System Information</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>

                <InfoCard title="Operating System" icon={Laptop}>
                    <Row label="Platform" value={info.osInfo.platform} />
                    <Row label="Distro" value={info.osInfo.distro} />
                    <Row label="Release" value={info.osInfo.release} />
                    <Row label="Kernel" value={info.osInfo.kernel} />
                    <Row label="Arch" value={info.osInfo.arch} />
                </InfoCard>

                <InfoCard title="Hardware" icon={Cpu}>
                    <Row label="Model" value={info.system.model} />
                    <Row label="Manufacturer" value={info.system.manufacturer} />
                    <Row label="Serial" value={info.system.serial === 'unknown' ? 'Hidden' : info.system.serial} />
                    <Row label="UUID" value={info.system.uuid === 'unknown' ? 'Hidden' : info.system.uuid} />
                </InfoCard>

                <InfoCard title="Graphics" icon={Box}>
                    {info.graphics.controllers.map((gpu: any, i: number) => (
                        <div key={i} style={{ marginBottom: 16 }}>
                            <Row label="Model" value={gpu.model} />
                            <Row label="VRAM" value={`${gpu.vram} MB`} />
                            <Row label="Vendor" value={gpu.vendor} />
                        </div>
                    ))}
                    <Row label="Displays" value={`${info.graphics.displays.length} Connected`} />
                </InfoCard>

                {info.battery.hasBattery && (
                    <InfoCard title="Battery" icon={Battery}>
                        <Row label="Manufacturer" value={info.battery.manufacturer} />
                        <Row label="Cycle Count" value={info.battery.cycleCount} />
                        <Row label="Designed Capacity" value={`${info.battery.designedCapacity} mWh`} />
                        <Row label="Max Capacity" value={`${info.battery.maxCapacity} mWh`} />
                    </InfoCard>
                )}

            </div>
        </div>
    );
};

export default SystemInfo;
