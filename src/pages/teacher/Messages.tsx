import React from 'react';
import ChatPanel from '../../components/ChatPanel';

export default function TeacherMessages() {
  return (
    <div>
      <div className="page-header">
        <h1>💬 Messages</h1>
        <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Chat with admin and parents of your class students</p>
      </div>
      <ChatPanel />
    </div>
  );
}
