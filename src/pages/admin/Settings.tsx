import React from 'react';
import { FiSettings } from 'react-icons/fi';

export default function Settings() {
  return (
    <div>
      <div className="page-header"><h1>⚙️ Settings</h1></div>
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <FiSettings style={{ fontSize: '2.5rem', color: 'var(--gray-300)' }} />
            <h3>School Settings</h3>
            <p>Configure school profile, academic year, branding, and more. Coming soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
