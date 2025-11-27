import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import QuizGame from './components/QuizGame';
import MultiplayerMenu from './components/Multiplayer/MultiplayerMenu';
import JoinRoom from './components/Multiplayer/JoinRoom';
import Lobby from './components/Multiplayer/Lobby';
import MultiplayerGame from './components/Multiplayer/MultiplayerGame';
import Leaderboard from './components/Multiplayer/Leaderboard';
import UsernameModal from './components/UsernameModal';

function App() {
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  useEffect(() => {
    // Check for existing username
    const storedUsername = localStorage.getItem('quiz_username');
    if (!storedUsername) {
      setShowUsernameModal(true);
    }
  }, []);

  const handleUsernameSave = (newUsername) => {
    setShowUsernameModal(false);
  };

  return (
    <Router>
      {showUsernameModal && <UsernameModal onSave={handleUsernameSave} />}
      <div className="app-container">
        <Routes>
          <Route path="/" element={<QuizGame />} />
          <Route path="/multiplayer" element={<MultiplayerMenu />} />
          <Route path="/join-room" element={<JoinRoom />} />
          <Route path="/lobby/:roomCode" element={<Lobby />} />
          <Route path="/game/:roomCode" element={<MultiplayerGame />} />
          <Route path="/leaderboard/:roomCode" element={<Leaderboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
