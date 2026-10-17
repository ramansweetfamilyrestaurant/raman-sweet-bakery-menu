import React, { useState, useEffect } from 'react';
import { 
  Archive, Shield, Key, Download, RefreshCw, Search, Check, Copy, 
  AlertTriangle, Database, Clock, ChevronLeft, ChevronRight, X 
} from 'lucide-react';

export default function AuditArchivesView({ 
  onBackToLive, 
  apiBaseUrl = '/api/superadmin/audit-logs/archives' 
}) {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [copiedKey, setCopiedKey] = useState(null);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState(null);

  const fetchArchives = async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('sa_token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}?page=${targetPage}&limit=15`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to load archives (Status ${res.status})`);
      }
      const data = await res.json();
      setArchives(data.archives || []);
      setPagination(data.pagination || { page: targetPage, total: 0, totalPages: 1 });
      setPage(targetPage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives(1);
  }, []);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenSearch = (archive) => {
    setSelectedArchive(archive);
    setSearchQuery('');
    setSearchResults(null);
    setRestoreMessage(null);
    setSearchModalOpen(true);
  };

  const handleExecuteSearch = async () => {
    if (!selectedArchive) return;
    setSearchLoading(true);
    try {
      const token = localStorage.getItem('sa_token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/${selectedArchive.id}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: searchQuery, limit: 50 })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Archive search failed');
      }
      const data = await res.json();
      setSearchResults(data.matches || []);
    } catch (err) {
      alert(`Search error: ${err.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRestoreToStaging = async () => {
    if (!selectedArchive) return;
    const confirmed = window.confirm(
      `Restore Archive #${selectedArchive.id} (${selectedArchive.total_records} records) into staging table 'audit_logs_archive_staging'?\n\nThis will NOT modify or overwrite the primary live audit_logs table.`
    );
    if (!confirmed) return;

    setRestoreLoading(true);
    setRestoreMessage(null);
    try {
      const token = localStorage.getItem('sa_token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/${selectedArchive.id}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Restore failed');
      }
      const data = await res.json();
      setRestoreMessage(data.message || `Restored ${data.restored_count} records into staging table.`);
    } catch (err) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="sa-audit-archives-view" style={{ padding: '4px 0' }}>
      
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: '16px',
        padding: '20px 24px',
        color: '#FFFFFF',
        marginBottom: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Archive size={22} color="#D4AF37" />
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
              Cold Storage Audit Archives Vault
            </h3>
            <span style={{
              background: '#047857', color: '#D1FAE5', fontSize: '0.68rem', fontWeight: 900,
              padding: '2px 8px', borderRadius: '6px'
            }}>
              R2 ENCRYPTED WORM
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: '#94A3B8', maxWidth: '750px' }}>
            Historical operational logs older than 180 days are durably stored in isolated Cloudflare R2 storage with full cryptographic checksums. Live security & billing logs remain in the hot PostgreSQL stream.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onBackToLive}
            className="sa-btn"
            style={{
              background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)',
              fontSize: '0.76rem', fontWeight: 800, padding: '8px 14px', borderRadius: '10px', cursor: 'pointer'
            }}
          >
            ← Back to Live Stream
          </button>
          <button
            type="button"
            onClick={() => fetchArchives(page)}
            disabled={loading}
            className="sa-btn"
            style={{
              background: '#D4AF37', color: '#0A2315', border: 'none',
              fontSize: '0.76rem', fontWeight: 900, padding: '8px 14px', borderRadius: '10px', cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh Vault
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '12px', background: '#FEF2F2',
          border: '1px solid #FCA5A5', color: '#991B1B', marginBottom: '16px', fontSize: '0.82rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Archives Table */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--sa-border, #E2E8F0)',
        overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 800 }}>
              <th style={{ padding: '12px 16px' }}>CHUNKS & TRACK</th>
              <th style={{ padding: '12px 16px' }}>DATE RANGE (UTC)</th>
              <th style={{ padding: '12px 16px' }}>RECORDS & PRUNED</th>
              <th style={{ padding: '12px 16px' }}>SIZE & CHECKSUM</th>
              <th style={{ padding: '12px 16px' }}>STATUS</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && archives.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  Loading archive vault catalog...
                </td>
              </tr>
            ) : archives.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  📦 No cold archives exist yet. Operational records older than 180 days will appear here once archived.
                </td>
              </tr>
            ) : (
              archives.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800, color: '#0F172A' }}>#{a.id} • {a.track?.toUpperCase()}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>
                      {a.archive_uid?.substring(0, 8)}...
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div>{new Date(a.start_date).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>to {new Date(a.end_date).toLocaleDateString()}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800 }}>{Number(a.total_records).toLocaleString()} total</div>
                    <div style={{ fontSize: '0.7rem', color: Number(a.pruned_records) === Number(a.total_records) ? '#059669' : '#D97706' }}>
                      {Number(a.pruned_records).toLocaleString()} pruned
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div>{(Number(a.file_size_bytes) / 1024).toFixed(1)} KB</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: 'monospace', color: '#64748B' }}>
                      <span>{a.file_sha256?.substring(0, 10)}...</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(a.file_sha256, a.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        title="Copy SHA-256"
                      >
                        {copiedKey === a.id ? <Check size={11} color="#059669" /> : <Copy size={11} color="#94A3B8" />}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900,
                      background: a.status === 'COMPLETED' ? '#ECFDF5' : a.status === 'VERIFIED' ? '#EFF6FF' : '#FFFBEB',
                      color: a.status === 'COMPLETED' ? '#065F46' : a.status === 'VERIFIED' ? '#1E40AF' : '#92400E',
                      border: `1px solid ${a.status === 'COMPLETED' ? '#A7F3D0' : '#BFDBFE'}`
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenSearch(a)}
                      className="sa-btn"
                      style={{
                        padding: '6px 12px', fontSize: '0.74rem', fontWeight: 800,
                        background: '#0F172A', color: '#FFFFFF', borderRadius: '8px', border: 'none', cursor: 'pointer'
                      }}
                    >
                      <Search size={11} /> Search / Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Search / Inspect Modal */}
      {searchModalOpen && selectedArchive && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '850px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px', background: '#0F172A', color: '#FFFFFF',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>
                  Inspect Archive #{selectedArchive.id} ({selectedArchive.total_records} records)
                </h4>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px', fontFamily: 'monospace' }}>
                  {selectedArchive.archive_key}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
              
              {/* Search Bar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Filter by action, details, restaurant ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch()}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #CBD5E1', fontSize: '0.82rem'
                  }}
                />
                <button
                  type="button"
                  onClick={handleExecuteSearch}
                  disabled={searchLoading}
                  style={{
                    padding: '10px 18px', borderRadius: '10px', background: '#D4AF37',
                    color: '#0A2315', fontWeight: 900, border: 'none', cursor: 'pointer'
                  }}
                >
                  {searchLoading ? 'Streaming...' : 'Stream Search'}
                </button>
              </div>

              {/* Restore Button */}
              <div style={{
                background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px',
                border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#1E293B' }}>
                    Rehydrate into Isolated Staging Table
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                    Loads records into <code>audit_logs_archive_staging</code> for forensic SQL exploration.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreToStaging}
                  disabled={restoreLoading}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', background: '#1E40AF',
                    color: '#FFFFFF', fontWeight: 800, fontSize: '0.74rem', border: 'none', cursor: 'pointer'
                  }}
                >
                  {restoreLoading ? 'Rehydrating...' : 'Restore to Staging'}
                </button>
              </div>

              {restoreMessage && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', background: '#ECFDF5',
                  border: '1px solid #A7F3D0', color: '#065F46', marginBottom: '16px', fontSize: '0.78rem'
                }}>
                  ✅ {restoreMessage}
                </div>
              )}

              {/* Results */}
              {searchResults && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>
                    Found {searchResults.length} matching records:
                  </div>
                  <div style={{
                    maxHeight: '300px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px'
                  }}>
                    {searchResults.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>
                        No records matched your search query in this archive.
                      </div>
                    ) : (
                      searchResults.map((r, i) => (
                        <div key={i} style={{
                          padding: '10px 14px', borderBottom: '1px solid #F1F5F9', fontSize: '0.76rem',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <div>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>#{r.id} {r.action}</span>
                            <span style={{ color: '#64748B', marginLeft: '8px' }}>Resto #{r.restaurant_id || 'Global'}</span>
                            <div style={{ color: '#475569', marginTop: '2px' }}>{r.details}</div>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                            {new Date(r.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
