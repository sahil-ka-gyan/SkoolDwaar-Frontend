import React from 'react';
import ChatPanel from '../../components/ChatPanel';

export default function Messages() {
  return (
    <div>
      <div className="page-header">
        <h1>💬 Messages</h1>
        <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Chat with teachers and parents</p>
      </div>
      <ChatPanel />
    </div>
  );
}
