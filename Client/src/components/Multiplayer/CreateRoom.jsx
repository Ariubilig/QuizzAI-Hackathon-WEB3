import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { generateRoomCode } from "../../utils/generateRoomCode";
import { useNavigate } from "react-router-dom";

export default function CreateRoom() {
  const [roomCode, setRoomCode] = useState(null);
  const navigate = useNavigate();

  async function createRoom() {
    const code = generateRoomCode();
    const hostId = crypto.randomUUID();

    const { error } = await supabase
      .from("rooms")
      .insert({
        code,
        host_id: hostId,
        status: "waiting",
        category: "mix", // Default for now, could be selectable
        difficulty: "easy" // Default for now
      });

    if (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room");
      return;
    }

    // Get username from QuizGame profile or generate random
    const storedProfile = localStorage.getItem("userProfile");
    let username = "Player";
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      username = profile.username || "Host";
    } else {
      // Generate random username
      username = `Player${Math.floor(1000 + Math.random() * 9000)}`;
    }
    
    const { data: playerData, error: playerError} = await supabase
      .from("players")
      .insert({
        room_code: code,
        name: username,
        status: "joined"
      })
      .select()
      .single();
      
    if (playerError) {
        console.error("Error joining as host:", playerError);
    } else {
        localStorage.setItem("quiz_player_id", playerData.id);
    }

    setRoomCode(code);
    navigate(`/lobby/${code}`);
  }

  return (
    <div className="create-room-card">
      <h2 className="create-room-title">Create a Room</h2>
      <button 
        onClick={createRoom}
        className="btn-create-action"
      >
        Create New Room
      </button>
      {roomCode && <p className="room-code-text">Your room code: <span className="room-code-highlight">{roomCode}</span></p>}
      
      <button 
        onClick={() => navigate('/multiplayer')}
        className="btn-back-menu"
        style={{ marginTop: '1rem' }}
      >
        ← Back
      </button>
    </div>
  );
}