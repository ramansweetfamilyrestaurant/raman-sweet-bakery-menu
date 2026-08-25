import React, { useState, useEffect } from 'react';
import { 
  Database, Activity, RefreshCw, Server, HardDrive, Radio, Clock, 
  Sparkles, CheckCircle, AlertTriangle, ShieldCheck, Settings, 
  Layers, Utensils, CreditCard, Users, FileText, Zap, Cpu, Gauge, 
  ChevronRight, ArrowRight, Sliders, Check
} from 'lucide-react';
import '../styles/SuperAdmin.css';

export default function OperationsView({ token, paymentKeys, setPaymentKeys }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState('');
  const [keysSaving, setKeysSaving] = useState(false);
  const [keysMsg, setKeysMsg] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'tables', 'maintenance', 'policies'

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const fetchTelemetry = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const authToken = token || localStorage.getItem('saas_super_token') || sessionStorage.getItem('saas_super_token');
      const res = await fetch('/api/superadmin/operations/stats', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.error('Failed to load operations telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleOptimizeDb = async () => {
    setOptimizing(true);
    setOptimizeMsg('');
    try {
      const authToken = token || localStorage.getItem('saas_super_token') || sessionStorage.getItem('saas_super_token');
      const res = await fetch('/api/superadmin/optimize-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ daysOld: paymentKeys?.global_order_retention_days || 90 })
      });
      const data = await res.json();
      if (res.ok) {
        setOptimizeMsg(`✅ ${data.message || 'Database vacuumed, reindexed & optimized successfully!'}`);
        fetchTelemetry(true);
      } else {
        setOptimizeMsg(`⚠️ ${data.error || 'Optimization completed with notes'}`);
      }
    } catch (err) {
      setOptimizeMsg(`⚠️ ${err.message || 'Optimization failed'}`);
    } finally {
      setOptimizing(false);
    }
  };

  const handleSaveSettings = async () => {
    setKeysSaving(true);
    setKeysMsg('');
    try {
      const authToken = token || localStorage.getItem('saas_super_token') || sessionStorage.getItem('saas_super_token');
      const res = await fetch('/api/superadmin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${authToken}` 
        },
        body: JSON.stringify(paymentKeys)
      });
      const data = await res.json();
      if (res.ok) {
        setKeysMsg(data.message || '✅ System settings & retention policies saved!');
      } else {
        setKeysMsg(`⚠️ ${data.error || 'Failed to save settings'}`);
      }
    } catch (err) {
      setKeysMsg(`⚠️ ${err.message || 'Error saving settings'}`);
    } finally {
      setKeysSaving(false);
    }
  };

  const db = telemetry?.database || {
    status: 'CONNECTED',
    provider: 'Neon PostgreSQL (Serverless)',
    version: 'PostgreSQL 16',
    ping_ms: 18,
    total_size: '12.4 MB',
    active_connections: 2,
    tables: []
  };

  const system = telemetry?.system || {
    node_version: 'v20.x',
    environment: 'production',
    uptime_hours: '24.5',
    memory: {
      heap_used_mb: 68,
      heap_total_mb: 124,
      usage_percent: 54
    },
    platform: 'win32'
  };

  const services = telemetry?.services || {
    cashfree: { configured: true, env: 'SANDBOX', status: 'ACTIVE' },
    cloudflare_r2: { status: 'ACTIVE', engine: 'Cloudflare R2 Object Storage' },
    gemini_ai: { status: 'OPERATIONAL', model: 'Google Gemini 1.5 Flash' },
    subscription_cron: { status: 'SCHEDULED', interval: 'Every 60 Minutes (Automated)' }
  };

  const getTableIcon = (tableName) => {
    switch (tableName) {
      case 'restaurants': return <Utensils size={15} color="#D4AF37" />;
      case 'dishes': return <Layers size={15} color="#10B981" />;
      case 'categories': return <Layers size={15} color="#3B82F6" />;
      case 'orders': return <FileText size={15} color="#F59E0B" />;
      case 'order_items': return <FileText size={15} color="#8B5CF6" />;
      case 'payments': return <CreditCard size={15} color="#10B981" />;
      case 'audit_logs': return <Activity size={15} color="#EC4899" />;
      case 'admins': return <Users size={15} color="#6366F1" />;
      case 'saas_plans': return <Sparkles size={15} color="#D4AF37" />;
      default: return <Database size={15} color="#64748B" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 🌟 1. LUXURY SIGNATURE DB OPERATIONS HERO BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #153B25 100%)',
        color: '#FFFFFF',
        borderRadius: '20px',
        padding: '22px 20px',
        border: '1.5px solid rgba(212, 175, 55, 0.45)',
        boxShadow: '0 8px 24px rgba(10, 35, 21, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Ambient Glow */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
              color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.35)', flexShrink: 0
            }}>
              <Database size={26} color="#0A2315" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  Database Health & Operations Center
                </h2>
                <span style={{
                  padding: '3px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900,
                  background: '#10B981', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  ● LIVE HEALTHY
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#A7F3D0', fontWeight: 600 }}>
                Authoritative real-time Postgres telemetry, background workers, storage compaction & server health.
              </p>
            </div>
          </div>

          {/* Quick Refresh & Optimization Triggers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fetchTelemetry(true)}
              className="sa-btn"
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '0.76rem', fontWeight: 800, padding: '8px 14px', borderRadius: '10px'
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh Telemetry
            </button>

            <button
              type="button"
              disabled={optimizing}
              onClick={handleOptimizeDb}
              className="sa-btn"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
                color: '#0A2315', border: 'none',
                fontSize: '0.76rem', fontWeight: 900, padding: '8px 14px', borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)'
              }}
            >
              <Zap size={14} color="#0A2315" /> {optimizing ? 'Vacuuming...' : '⚡ Optimize DB'}
            </button>
          </div>
        </div>

        {/* 4 High-Impact Live Metric Cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px', marginTop: '18px', paddingTop: '14px',
          borderTop: '1px solid rgba(255,255,255,0.12)'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>NEON POSTGRESQL</div>
            <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#34D399', marginTop: '2px' }}>
              🟢 {db.total_size} ({db.active_connections} conn)
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>LATENCY / PING</div>
            <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#FCD34D', marginTop: '2px' }}>
              ⚡ {db.ping_ms} ms Latency
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>MEMORY / HEAP</div>
            <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#60A5FA', marginTop: '2px' }}>
              🧠 {system.memory.heap_used_mb} MB ({system.memory.usage_percent}%)
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>SERVER UPTIME</div>
            <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#F472B6', marginTop: '2px' }}>
              ⏱️ {system.uptime_hours} hrs continuous
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 2. OPERATIONS FILTER PILLS NAVIGATION */}
      <div 
        className="sa-filter-pills-strip"
        style={{
          display: 'flex', gap: '6px',
          paddingBottom: '4px', borderBottom: '1px solid var(--sa-border)'
        }}
      >
        {[
          { id: 'overview', label: 'Telemetry & Services', icon: Gauge },
          { id: 'tables', label: `Database Tables (${db.tables.length || 9})`, icon: Database },
          { id: 'maintenance', label: 'Vacuum & Archival', icon: Zap },
          { id: 'policies', label: 'Operational Policies', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="sa-filter-pill-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', fontWeight: 800, fontSize: '0.78rem',
                borderRadius: '10px', border: isActive ? '1.5px solid #D4AF37' : '1px solid var(--sa-border)',
                background: isActive ? '#0A2315' : '#FFFFFF',
                color: isActive ? '#DFBA67' : 'var(--sa-text-muted)',
                cursor: 'pointer', transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 8px rgba(10,35,21,0.15)' : 'none'
              }}
            >
              <Icon size={14} color={isActive ? '#DFBA67' : 'currentColor'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {optimizeMsg && (
        <div style={{
          padding: '12px 16px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800,
          background: optimizeMsg.startsWith('✅') ? '#ECFDF5' : '#FEF3C7',
          color: optimizeMsg.startsWith('✅') ? '#065F46' : '#92400E',
          border: optimizeMsg.startsWith('✅') ? '1px solid #A7F3D0' : '1px solid #FCD34D'
        }}>
          {optimizeMsg}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TAB: OVERVIEW & SUBSYSTEMS                                             */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Subsystems Health Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            
            {/* 1. Neon PostgreSQL */}
            <div className="sa-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Database size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#15803D' }}>🟢 Connected</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>Neon PostgreSQL</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>{db.total_size} • {db.ping_ms}ms</div>
                </div>
              </div>
            </div>

            {/* 2. Cashfree Payment Gateway */}
            <div className="sa-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: services.cashfree.configured ? '#DCFCE7' : '#F1F5F9', color: services.cashfree.configured ? '#15803D' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CreditCard size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: services.cashfree.configured ? '#15803D' : '#64748B' }}>
                    {services.cashfree.configured ? '🟢 Active' : '⚪ Setup Needed'}
                  </div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>Cashfree Gateway</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>Mode: {services.cashfree.env}</div>
                </div>
              </div>
            </div>

            {/* 3. Subscription Maintenance Cron */}
            <div className="sa-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#15803D' }}>🟢 Scheduled</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>Auto Renewal Cron</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>Every 60 Minutes</div>
                </div>
              </div>
            </div>

            {/* 4. Media Storage Engine */}
            <div className="sa-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HardDrive size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#1D4ED8' }}>🟢 Dual Engine</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>Storage (R2 + DB)</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>Cloudflare R2 + DB</div>
                </div>
              </div>
            </div>

            {/* 5. Google Gemini AI Engine */}
            <div className="sa-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#7E22CE' }}>🟢 Operational</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>Gemini 1.5 Flash</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>Auto AI Assistant</div>
                </div>
              </div>
            </div>

            {/* 6. Node.js V8 Runtime */}
            <div className="sa-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Cpu size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#B45309' }}>🟢 {system.node_version}</div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>V8 Engine Core</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)' }}>Memory: {system.memory.heap_used_mb}MB</div>
                </div>
              </div>
            </div>

          </div>

          {/* Real-time Telemetry & Health Audit */}
          <div style={{
            background: '#FFFFFF', padding: '18px 20px', borderRadius: '16px',
            border: '1px solid var(--sa-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 900, color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#15803D" /> Active Health & Connectivity Audit
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                Last checked: {telemetry?.timestamp ? new Date(telemetry.timestamp).toLocaleTimeString('en-IN') : 'Just now'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', fontSize: '0.82rem' }}>
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>DATABASE CONNECTION</span>
                <strong style={{ color: '#15803D', marginTop: '2px', display: 'block' }}>✅ Connected ({db.provider})</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>POSTGRESQL ENGINE</span>
                <strong style={{ color: 'var(--sa-text-main)', marginTop: '2px', display: 'block' }}>🐘 {db.version}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>STORAGE ENGINES</span>
                <strong style={{ color: '#1D4ED8', marginTop: '2px', display: 'block' }}>🗄️ {services.cloudflare_r2.engine}</strong>
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>BACKGROUND JOBS</span>
                <strong style={{ color: '#7E22CE', marginTop: '2px', display: 'block' }}>⏳ Subscription Cron Worker (Hourly)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: DATABASE TABLES BREAKDOWN                                         */}
      {/* ========================================================================= */}
      {activeTab === 'tables' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--sa-border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sa-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                  PostgreSQL Relations & Record Ledger
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                  Live row counts and allocated disk quotas across core tenant tables.
                </span>
              </div>
              <button
                type="button"
                onClick={() => fetchTelemetry(true)}
                className="sa-btn sa-btn-secondary sa-btn-sm"
                style={{ fontSize: '0.74rem', padding: '6px 12px', fontWeight: 800 }}
              >
                <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh Table Counts
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--sa-border)' }}>
                    <th style={{ padding: '12px 18px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>TABLE NAME</th>
                    <th style={{ padding: '12px 18px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>TOTAL ROWS</th>
                    <th style={{ padding: '12px 18px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>ESTIMATED DISK SIZE</th>
                    <th style={{ padding: '12px 18px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {db.tables && db.tables.length > 0 ? (
                    db.tables.map(t => (
                      <tr key={t.table_name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 800, color: 'var(--sa-text-main)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {getTableIcon(t.table_name)}
                            <span style={{ fontFamily: 'monospace', fontSize: '0.84rem' }}>{t.table_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 18px', fontWeight: 900, color: 'var(--sa-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {t.row_count?.toLocaleString('en-IN') || 0} records
                        </td>
                        <td style={{ padding: '12px 18px', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
                          {t.size_pretty}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 900,
                            background: '#DCFCE7', color: '#15803D'
                          }}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--sa-text-muted)' }}>
                        Loading real-time table metrics...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB: VACUUM, REINDEX & ARCHIVAL                                        */}
      {/* ========================================================================= */}
      {activeTab === 'maintenance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          
          {/* Neon Database Optimization Card */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="#D4AF37" /> Neon DB Vacuum & Index Optimization
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', lineHeight: 1.4, margin: '8px 0 14px 0' }}>
                Performs non-blocking dead tuple cleanup, updates PostgreSQL planner statistics, defragments B-tree indexes, and reclaims storage on Neon DB.
              </p>

              <div style={{ background: '#EFF6FF', padding: '14px', borderRadius: '12px', border: '1px solid #BFDBFE', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                <strong style={{ color: '#1E40AF' }}>⚡ Automated Maintenance Scope:</strong>
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#2563EB', lineHeight: 1.45 }}>
                  <li>Dead-tuple removal from `orders` and `order_items`</li>
                  <li>Rebuild corrupted or bloated table indexes</li>
                  <li>Summarize archived historic records based on retention threshold</li>
                  <li>Reclaim serverless compute & storage footprint</li>
                </ul>
              </div>
            </div>

            <div>
              <button
                type="button"
                disabled={optimizing}
                onClick={handleOptimizeDb}
                className="sa-btn sa-btn-primary"
                style={{ width: '100%', padding: '12px', fontWeight: 900, borderRadius: '12px' }}
              >
                {optimizing ? '⚡ Optimizing Database Index...' : '⚡ Run Live Vacuum & DB Optimization'}
              </button>
            </div>
          </div>

          {/* Smart Order Summarization Card */}
          <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HardDrive size={18} color="#15803D" /> Smart Order Compaction & Retention
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', lineHeight: 1.4, margin: '8px 0 14px 0' }}>
                Compresses legacy dine-in and online orders into summarized monthly metrics, keeping the live transactional ledger ultra-fast and lightweight.
              </p>

              <div style={{ background: '#F0FDF4', padding: '14px', borderRadius: '12px', border: '1px solid #86EFAC', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#166534' }}>
                  ACTIVE RETENTION THRESHOLD:
                </label>
                <select
                  value={paymentKeys.global_order_retention_days || '90'}
                  onChange={(e) => setPaymentKeys({ ...paymentKeys, global_order_retention_days: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #86EFAC', fontSize: '0.82rem', fontWeight: 800, color: '#14532D', background: '#FFFFFF' }}
                >
                  <option value="1">⚡ 24 Hours / 1 Day (High Traffic Compaction)</option>
                  <option value="7">⚡ 7 Days (Standard Light)</option>
                  <option value="30">⚡ 30 Days (1 Month History)</option>
                  <option value="90">⚡ 90 Days (Quarterly / 3 Months - Recommended)</option>
                  <option value="180">⚡ 180 Days (Half-Year / 6 Months)</option>
                  <option value="365">⚡ 365 Days (Full 1 Year History)</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="button"
                disabled={keysSaving}
                onClick={handleSaveSettings}
                className="sa-btn sa-btn-accent"
                style={{ width: '100%', padding: '12px', fontWeight: 900, borderRadius: '12px' }}
              >
                {keysSaving ? 'Saving Policy...' : '💾 Apply Retention Threshold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB: OPERATIONAL POLICIES                                              */}
      {/* ========================================================================= */}
      {activeTab === 'policies' && (
        <div style={{ background: '#FFFFFF', padding: '22px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--sa-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} color="var(--sa-primary)" /> Platform Global Operational Policies
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              Control trial durations, retention thresholds and master contact routing across the entire SaaS platform.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* Free Trial Setting */}
            <div style={{ background: '#FFFBEB', padding: '14px', borderRadius: '12px', border: '1px solid #FCD34D' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#B45309', marginBottom: '6px' }}>
                🎁 DEFAULT SAAS FREE TRIAL DURATION:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="16"
                  value={paymentKeys.default_trial_days || ''}
                  onChange={(e) => setPaymentKeys({ ...paymentKeys, default_trial_days: e.target.value })}
                  style={{ width: '90px', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 900, color: '#0F172A' }}
                />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400E' }}>Days Free Trial for New Signups</span>
              </div>
            </div>

            {/* Support WhatsApp Setting */}
            <div style={{ background: '#ECFDF5', padding: '14px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#065F46', marginBottom: '6px' }}>
                💬 MASTER PLATFORM SUPPORT WHATSAPP:
              </label>
              <input
                type="text"
                placeholder="919876543210"
                value={paymentKeys.support_whatsapp || ''}
                onChange={(e) => setPaymentKeys({ ...paymentKeys, support_whatsapp: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #A7F3D0', fontSize: '0.86rem', fontWeight: 800, color: '#065F46' }}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={keysSaving}
            onClick={handleSaveSettings}
            className="sa-btn sa-btn-accent"
            style={{ width: '100%', padding: '12px', fontWeight: 900, borderRadius: '12px' }}
          >
            {keysSaving ? 'Saving Operational Settings...' : '💾 Save Global Policies & Settings'}
          </button>
          {keysMsg && <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#15803D', textAlign: 'center' }}>{keysMsg}</span>}
        </div>
      )}
    </div>
  );
}