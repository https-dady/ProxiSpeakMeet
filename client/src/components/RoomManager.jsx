import React, { useState } from 'react';

export default function RoomManager({ username, onJoinRoom, onLogout }) {
  const [roomId, setRoomId] = useState('');

  const createNewRoom = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/room/create', { method: 'POST' });
      const data = await res.json();
      if (data.roomId) {
        onJoinRoom(data.roomId);
      }
    } catch (error) {
      alert('Failed to create room. Please check your connection.');
    }
  };

  const joinExistingRoom = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      onJoinRoom(roomId);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif', padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '600px', backgroundColor: '#1e293b',
        borderRadius: '12px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        border: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
          <div>
            <h2 style={{ color: '#f8fafc', margin: 0 }}>Welcome, {username}</h2>
            <p style={{ color: '#94a3b8', margin: '5px 0 0 0', fontSize: '14px' }}>Where would you like to go today?</p>
          </div>
          <button 
            onClick={onLogout}
            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Logout
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '8px', border: '1px solid #334155', textAlign: 'center' }}>
            <h3 style={{ color: '#f8fafc', marginTop: 0 }}>Start a New Meeting</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Generate a unique virtual space and invite your team.</p>
            <button 
              onClick={createNewRoom}
              style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
            >
              + Create Unique Room
            </button>
          </div>

          <div style={{ textAlign: 'center', color: '#64748b', fontWeight: 'bold' }}>OR</div>

          <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '8px', border: '1px solid #334155', textAlign: 'center' }}>
            <h3 style={{ color: '#f8fafc', marginTop: 0 }}>Join Existing Room</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Enter the Room ID provided by your host.</p>
            <form onSubmit={joinExistingRoom} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Enter Room ID..."
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                style={{ flex: 1, padding: '12px 15px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', outline: 'none' }}
                required
              />
              <button 
                type="submit"
                style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '0 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}