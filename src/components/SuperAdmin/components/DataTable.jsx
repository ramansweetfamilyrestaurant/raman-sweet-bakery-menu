import React from 'react';

export default function DataTable({ headers, children, isEmpty, emptyMessage = 'No records found.' }) {
  return (
    <div className="sa-table-container sa-responsive-table">
      <table className="sa-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={h.alignRight ? { textAlign: 'right' } : {}}>
                {h.label || h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length} style={{ textAlign: 'center', padding: '36px', color: 'var(--sa-text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
