import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate, useParams } from "react-router-dom";

export default function Lobby() {
  const { roomCode } = useParams();
  const [players, setPlayers] = useState([]);
  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomCode) return;

    // Load initial data
    loadRoom();
    loadPlayers();

    // Subscribe to players with unique channel name
    const playersChannel = supabase
      .channel(`room:${roomCode}:players`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "players", 
          filter: `room_code=eq.${roomCode}` 
        },
        (payload) => {
          console.log('Player change:', payload);
          loadPlayers();
        }
      )
      .subscribe((status) => {
        console.log('Players subscription status:', status);
      });

    // Subscribe to room status with unique channel name
    const roomChannel = supabase
      .channel(`room:${roomCode}:status`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "rooms", 
          filter: `code=eq.${roomCode}` 
        },
        (payload) => {
          console.log('Room change:', payload);
          if (payload.new.status === "playing") {
            navigate(`/game/${roomCode}`);
          }
        }
      )
      .subscribe((status) => {
        console.log('Room subscription status:', status);
      });

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [roomCode]);

  async function loadRoom() {
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .single();
    
    if (data) {
      setRoom(data);
      
      // Check if current user is the host
      const playerId = localStorage.getItem("quiz_player_id");
      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("id", playerId)
        .single();
      
      if (playerData && playerData.room_code === roomCode) {
        // Check if this player was the first to join (the host)
        const { data: allPlayers } = await supabase
          .from("players")
          .select("id")
          .eq("room_code", roomCode)
          .order("joined_at");
        
        setIsHost(allPlayers && allPlayers[0]?.id === playerId);
      }
      
      // If already playing, redirect
      if (data.status === 'playing') {
        navigate(`/game/${roomCode}`);
      }
    }
  }

  async function loadPlayers() {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode)
      .order("joined_at");

    console.log('Loaded players:', data);
    setPlayers(data || []);
  }

  async function hostStart() {
    if (!room) return;

    // Fetch questions from Server API
    try {
        const response = await fetch('http://localhost:3000/api/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                category: room.category, 
                difficulty: room.difficulty 
            })
        });
        
        if (!response.ok) throw new Error("Failed to fetch questions");
        
        const quizData = await response.json();
        
        // Update room with questions, status, and global start time (in milliseconds)
        await supabase
          .from("rooms")
          .update({ 
              status: "playing", 
              questions: quizData.questions,
              game_start_time: Date.now().toString() // Store as string of milliseconds
          })
          .eq("code", roomCode);
          
    } catch (error) {
        console.error("Error starting game:", error);
        alert("Failed to start game");
    }
  }

  async function handleCancel() {
    // Host cancels - delete the room (cascade will delete players)
    await supabase
      .from("rooms")
      .delete()
      .eq("code", roomCode);
    
    localStorage.removeItem("quiz_player_id");
    navigate("/multiplayer");
  }

  async function handleLeave() {
    // Joiner leaves - just remove their player entry
    const playerId = localStorage.getItem("quiz_player_id");
    
    await supabase
      .from("players")
      .delete()
      .eq("id", playerId);
    
    localStorage.removeItem("quiz_player_id");
    navigate("/multiplayer");
  }

  return (
    <div className="lobby-container">
      <h2 className="lobby-title">Lobby</h2>
      <div className="lobby-card">
        <p className="lobby-code-label">Room Code:</p>
        <p className="lobby-code-value">{roomCode}</p>
        
        <div className="lobby-players-section">
            <h3 className="lobby-players-header">
              Players ({players.length}/5) {isHost && <span className="host-badge">• You are Host</span>}
            </h3>
            {players.map((p, idx) => (
                <div key={p.id} className="lobby-player-item">
                    <div className="player-status-dot"></div>
                    <p className="player-name">{p.name} {idx === 0 && <span className="host-badge">HOST</span>}</p>
                </div>
            ))}
            {players.length === 0 && <p className="waiting-text">Waiting for players...</p>}
        </div>

        <div className="lobby-actions">
            {isHost ? (
              <>
                <button 
                    onClick={handleCancel}
                    className="btn-cancel-lobby"
                >
                    Cancel
                </button>
                <button 
                    onClick={hostStart}
                    disabled={players.length === 0}
                    className="btn-start-game"
                >
                    Start Game
                </button>
              </>
            ) : (
              <button 
                  onClick={handleLeave}
                  className="btn-leave-lobby"
              >
                  Leave Room
              </button>
            )}
        </div>
      </div>
    </div>
  );
}