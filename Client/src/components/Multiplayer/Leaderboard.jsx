import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";

export default function Leaderboard() {
  const { roomCode } = useParams();
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
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
    const { data } = await supabase
      .from("players")
      .select("name, score, time_taken, status")
      .eq("room_code", roomCode)
      .order("score", { ascending: false })
      .order("time_taken", { ascending: true });

    setBoard(data || []);
    setLoading(false);
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

  if (loading) return <div className="loading-text">Loading results...</div>;

  return (
    <div className="leaderboard-container">
      <h2 className="leaderboard-title">Match Results</h2>
      
      <div className="leaderboard-table">
        <div className="leaderboard-header">
            <div className="col-rank">#</div>
            <div className="col-player">Player</div>
            <div className="col-status">Status</div>
            <div className="col-score">Score</div>
            <div className="col-time">Time</div>
        </div>
        
        {board.map((p, i) => (
            <div key={i} className={`leaderboard-row ${i === 0 ? 'first-place' : ''}`}>
                <div className="col-rank">{i + 1}</div>
                <div className="col-player">
                    {i === 0 && <span className="host-badge">#1</span>}
                    {p.name}
                </div>
                <div className="col-status">
                    <span className={`status-badge ${
                        p.status === 'finished' ? 'status-finished' : 'status-playing'
                    }`}>
                        {p.status === 'finished' ? 'Finished' : 'Playing'}
                    </span>
                </div>
                <div className="col-score">{p.score}</div>
                <div className="col-time">
                    {p.time_taken ? `${(p.time_taken / 1000).toFixed(1)}s` : '-'}
                </div>
            </div>
        ))}
      </div>

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