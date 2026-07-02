import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ChatNotifier from '../components/ChatNotifier';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <div className="page-content page-enter">
          <Outlet />
        </div>
      </div>
      <ChatNotifier />
    </div>
  );
}
