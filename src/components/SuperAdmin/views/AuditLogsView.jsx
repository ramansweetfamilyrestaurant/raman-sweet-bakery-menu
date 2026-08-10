import React, { useState } from 'react';
import { History, Shield, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export default function AuditLogsView({ auditLogs, loading, onRefresh }) {
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const filteredLogs = auditLogs.filter(log => {
    if (filterCategory === 'superadmin') return (log.action || '').toLowerCase().includes('admin') || log.role === 'superadmin';
    if (filterCategory === 'payment') return (log.action || '').toLowerCase().includes('payment') || (log.action || '').toLowerCase().includes('subscription');
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <History size={22} color="var(--sa-primary)" /> Security & Operational Audit Log Trail
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Immutable audit record of all Super Admin actions, grant/revoke changes, and subscription security events.
          </span>
        </div>

        <button onClick={onRefresh} className="sa-btn sa-btn-secondary">
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Trail
        </button>
      </div>

      {/* Activity Stream Table */}
      <div className="sa-table-container">
        <table className="sa-table">
          <thead>
            <tr>
              <th>ACTOR / ROLE</th>
              <th>ACTION</th>
              <th>DESCRIPTION / EVENT DETAILS</th>
              <th>TIMESTAMP</th>
              <th style={{ textAlign: 'right' }}>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--sa-text-muted)' }}>
                  No audit log entries recorded yet.
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => {
                const isExpanded = expandedId === log.id;

                return (
                  <React.Fragment key={log.id}>
                    <tr>
                      <td>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--sa-primary)' }}>{log.role || 'superadmin'}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block' }}>Resto ID #{log.restaurant_id || 'System'}</span>
                      </td>
                      <td>
                        <span className="sa-badge sa-badge-purple">{log.action || 'EVENT'}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--sa-text-main)' }}>
                        {log.details || 'Operational event'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)' }}>
                        {new Date(log.created_at || Date.now()).toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Details
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} style={{ background: 'var(--sa-surface-subtle)', padding: '14px 20px' }}>
                          <pre style={{ margin: 0, fontSize: '0.75rem', color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#FFFFFF', padding: '12px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
                            {JSON.stringify(log, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
