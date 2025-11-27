import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MultiplayerMenu() {
  const navigate = useNavigate();

  return (
    <div className="multiplayer-menu">
      <h1 className="multiplayer-title">
        Multiplayer Mode
      </h1>
      
      <div className="multiplayer-actions">
        <button 
          onClick={() => navigate('/create-room')}
          className="btn-create-room"
        >
          Create Room
        </button>
        
        <button 
          onClick={() => navigate('/join-room')}
          className="btn-join-room"
        >
          Join Room
        </button>
      </div>

      <button 
        onClick={() => navigate('/')}
        className="btn-back-menu"
      >
        ← Back to Main Menu
      </button>
    </div>
  );
}
