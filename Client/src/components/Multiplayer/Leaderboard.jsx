import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";

export default function Leaderboard() {
  const { roomCode } = useParams();
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rewardsCalculated, setRewardsCalculated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (roomCode) {
      loadBoard();
      
      // Subscribe to updates so we see when others finish
      const channel = supabase
        .channel(`leaderboard-${roomCode}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players", filter: `room_code=eq.${roomCode}` },
          loadBoard
        )
        .subscribe();
        
      return () => supabase.removeChannel(channel);
    }
  }, [roomCode]);

  async function loadBoard() {
    // 1. Get Players
    const { data: players } = await supabase
      .from("players")
      .select("name, score, time_taken, status")
      .eq("room_code", roomCode)
      .order("score", { ascending: false })
      .order("time_taken", { ascending: true });

    setBoard(players || []);
    setLoading(false);
    
    // 2. Get Room Info for Timeout Check
    const { data: room } = await supabase
      .from("rooms")
      .select("game_start_time")
      .eq("code", roomCode)
      .single();

    // Calculate rewards logic
    if (players && players.length > 0 && !rewardsCalculated) {
      const allFinished = players.every(p => p.status === 'finished');
      
      // Check for timeout (60 seconds after start)
      let isTimeout = false;
      if (room && room.game_start_time) {
        const startTime = Number(room.game_start_time);
        const now = Date.now();
        // Game is 45s, give 15s buffer = 60s total
        if (now - startTime > 60000) {
          isTimeout = true;
        }
      }

      // Award if everyone finished OR timeout occurred
      if (allFinished || isTimeout) {
        calculateRewards(players);
        setRewardsCalculated(true);
      }
    }
  }

  function calculateRewards(players) {
    if (!players || players.length === 0) return;
    
    // Get current user profile
    const storedProfile = localStorage.getItem('userProfile');
    if (!storedProfile) return;
    
    const profile = JSON.parse(storedProfile);
    const currentUsername = profile.username;
    
    // Check if we already processed this room
    const alreadyProcessed = profile.history && profile.history.some(h => h.id === roomCode);
    if (alreadyProcessed) {
      console.log("Rewards already processed for this room.");
      return;
    }
    
    // Find current player in the board
    const currentPlayerIndex = players.findIndex(p => p.name === currentUsername);
    if (currentPlayerIndex === -1) return; // Current player not in this game
    
    // Calculate prize pool: 50 coins per player
    const prizePool = players.length * 50;
    
    // Winner is the first player (already sorted by score desc, time asc)
    const isWinner = currentPlayerIndex === 0;
    
    // Update balance
    let coinChange = 0;
    if (isWinner) {
      // Winner gets the entire prize pool
      coinChange = prizePool;
    } else {
      // Losers get nothing (they already paid 50 to enter)
      coinChange = 0;
    }
    
    // Create history item
    const historyItem = {
        id: roomCode,
        date: new Date().toLocaleString(),
        score: players[currentPlayerIndex].score,
        total: players[currentPlayerIndex].score, // In multiplayer we might not know total questions easily here, using score as placeholder or could fetch
        category: "Multiplayer",
        result: isWinner ? 'Win' : 'Loss',
        coinChange: coinChange
    };

    // Update user profile with new balance and history
    const newProfile = {
      ...profile,
      balance: profile.balance + coinChange,
      history: [historyItem, ...(profile.history || [])].slice(0, 20)
    };
    
    localStorage.setItem('userProfile', JSON.stringify(newProfile));
    
    console.log(`Rewards calculated: ${isWinner ? 'WINNER' : 'LOSER'} - Prize Pool: ${prizePool}, Coin Change: ${coinChange}`);
  }

  async function handleRematch() {
      // Reset all players' stats for rematch
      await supabase
        .from("players")
        .update({ 
          score: 0, 
          time_taken: null, 
          status: "joined" 
        })
        .eq("room_code", roomCode);
        
      // Reset room status to waiting and clear game_start_time
      await supabase
        .from("rooms")
        .update({ 
          status: "waiting", 
          questions: null,
          game_start_time: null  // Clear the old start time
        })
        .eq("code", roomCode);
        
      // Navigate back to lobby
      navigate(`/lobby/${roomCode}`);
  }

  // Helper to generate confetti
  const renderConfetti = () => {
    const confettiCount = 30; // Reduced from 50 for better performance
    return (
      <div className="confetti-container">
        {[...Array(confettiCount)].map((_, i) => (
          <div
            key={i}
            className="confetti"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 3 + 2}s`,
              backgroundColor: `hsl(${Math.random() * 360}, 100%, 50%)`
            }}
          />
        ))}
      </div>
    );
  };

  if (loading) return <div className="loading-text">Loading results...</div>;

  // Separate top 3 and others
  const top3 = board.slice(0, 3);
  const others = board.slice(3);

  return (
    <div className="leaderboard-container">
      {/* Confetti for Winner */}
      {board.length > 0 && renderConfetti()}

      <h2 className="leaderboard-title">Match Results</h2>
      
      {/* Prize Pool Display */}
      {board.length > 0 && (
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2rem', 
          padding: '1rem 2rem',
          background: 'rgba(255, 215, 0, 0.1)',
          borderRadius: '16px',
          border: '2px solid rgba(255, 215, 0, 0.3)',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Prize Pool</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#FFD700', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>
            {board.length * 50} 💰
          </div>
          <div style={{ fontSize: '0.9rem', color: '#FFD700', marginTop: '0.5rem', fontWeight: 'bold' }}>
            Winner Takes All!
          </div>
        </div>
      )}
      
      {/* Podium Section */}
      <div className="podium-section">
        {/* 2nd Place */}
        {top3[1] && (
          <div className="podium-item rank-2">
            <div className="podium-player-info">
              <div className="podium-avatar">{top3[1].name?.charAt(0).toUpperCase()}</div>
              <div className="podium-name">{top3[1].name}</div>
              <div className="podium-score">{top3[1].score} pts</div>
            </div>
            <div className="podium-bar">
              <div className="podium-rank">2</div>
            </div>
          </div>
        )}

        {/* 1st Place */}
        {top3[0] && (
          <div className="podium-item rank-1">
            <div className="podium-player-info">
              <div className="podium-avatar" style={{ border: '3px solid #FFD700', color: '#FFD700' }}>👑</div>
              <div className="podium-name" style={{ fontSize: '1.4rem', color: '#FFD700' }}>{top3[0].name}</div>
              <div className="podium-score">{top3[0].score} pts</div>
            </div>
            <div className="podium-bar">
              <div className="podium-rank">1</div>
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {top3[2] && (
          <div className="podium-item rank-3">
            <div className="podium-player-info">
              <div className="podium-avatar">{top3[2].name?.charAt(0).toUpperCase()}</div>
              <div className="podium-name">{top3[2].name}</div>
              <div className="podium-score">{top3[2].score} pts</div>
            </div>
            <div className="podium-bar">
              <div className="podium-rank">3</div>
            </div>
          </div>
        )}
      </div>

      {/* List for Others */}
      {others.length > 0 && (
        <div className="leaderboard-list">
          {others.map((p, i) => (
            <div key={i + 3} className="list-item">
              <div className="list-rank">{i + 4}</div>
              <div className="list-info">
                <div className="player-name">{p.name}</div>
                <span className={`status-badge ${
                    p.status === 'finished' ? 'status-finished' : 'status-playing'
                }`}>
                    {p.status === 'finished' ? 'Finished' : 'Playing'}
                </span>
              </div>
              <div className="list-score">{p.score} pts</div>
            </div>
          ))}
        </div>
      )}

      <div className="leaderboard-actions">
        <button 
            onClick={() => navigate('/')}
            className="btn-main-menu"
        >
            Main Menu
        </button>
        <button 
            onClick={handleRematch}
            className="btn-rematch"
        >
            Rematch
        </button>
      </div>
    </div>
  );
}