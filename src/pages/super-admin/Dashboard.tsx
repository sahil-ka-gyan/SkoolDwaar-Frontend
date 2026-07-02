import React, { useState, useEffect } from 'react';
import { FiGrid, FiUsers, FiUser, FiTrendingUp } from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import { getGreeting, formatNumber } from '../../utils/helpers';
import client from '../../api/client';

export default function SuperAdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/dashboard')
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <h2>{getGreeting()}, {user?.first_name}! 🚀</h2>
        <p>Here's an overview of your entire platform</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiGrid /></div>
          <div className="stat-info">
            <span className="label">Total Schools</span>
            <span className="value">{formatNumber(stats?.total_schools || 0)}</span>
            <span className="change up">↑ Active platform</span>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><FiGrid /></div>
          <div className="stat-info">
            <span className="label">Active Schools</span>
            <span className="value">{formatNumber(stats?.active_schools || 0)}</span>
            <span className="change up">↑ Running</span>
          </div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber"><FiUsers /></div>
          <div className="stat-info">
            <span className="label">Total Students</span>
            <span className="value">{formatNumber(stats?.total_students || 0)}</span>
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple"><FiUser /></div>
          <div className="stat-info">
            <span className="label">Total Teachers</span>
            <span className="value">{formatNumber(stats?.total_teachers || 0)}</span>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="dashboard-grid cols-2">
        <div className="card">
          <div className="card-header">
            <h3>📊 Platform Overview</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Schools Onboarded</span>
                <span className="font-bold">{stats?.total_schools || 0}</span>
              </div>
              <div className="progress-bar-wrapper">
                <div className="progress-bar-fill blue" style={{ width: `${Math.min((stats?.active_schools / Math.max(stats?.total_schools, 1)) * 100, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Active Rate</span>
                <span className="font-bold">{stats?.total_schools ? Math.round((stats.active_schools / stats.total_schools) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>⚡ Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="quick-grid">
              <a className="quick-card" href="/super-admin/schools">
                <div className="qc-icon" style={{ background: 'var(--primary-50)', color: 'var(--primary-600)' }}><FiGrid /></div>
                <span className="qc-label">Manage Schools</span>
              </a>
              <a className="quick-card" href="/super-admin/schools">
                <div className="qc-icon" style={{ background: 'var(--success-50)', color: 'var(--success-600)' }}><FiTrendingUp /></div>
                <span className="qc-label">View Analytics</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
