import { useState, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function JoinRoom() {
  const [code, setCode] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputs = useRef([]);

  const processInput = (e, slot) => {
    const char = e.target.value.toUpperCase();
    if (char.length > 1) return; // Only allow single character
    
    const newCode = [...code];
    newCode[slot] = char;
    setCode(newCode);
    
    if (char && slot !== 3) {
      inputs.current[slot + 1]?.focus();
    }
    
    // Auto-submit when all 4 digits are filled
    if (newCode.every(c => c !== "")) {
      joinRoom(newCode.join(""));
    }
  };

  const onKeyUp = (e, slot) => {
    if (e.keyCode === 8 && !code[slot] && slot !== 0) {
      const newCode = [...code];
      newCode[slot - 1] = "";
      setCode(newCode);
      inputs.current[slot - 1]?.focus();
    }
  };

  async function joinRoom(roomCode = code.join("")) {
    // Get username from localStorage
    const username = localStorage.getItem("quiz_username");
    
    if (!roomCode || roomCode.length !== 4) {
      return;
    }

    if (!username) {
      alert("Please set your username first");
      navigate("/");
      return;
    }

    setLoading(true);
    const upperCode = roomCode.toUpperCase();

    try {
      // Check if room exists and is waiting
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", upperCode)
        .single();

      if (roomError || !room) {
        alert("Room not found");
        setLoading(false);
        setCode(["", "", "", ""]);
        inputs.current[0]?.focus();
        return;
      }

      if (room.status !== "waiting") {
        alert("Game already started or finished");
        setLoading(false);
        setCode(["", "", "", ""]);
        inputs.current[0]?.focus();
        return;
      }

      // Check player count
      const { count } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("room_code", upperCode);

      if (count >= 5) {
        alert("Room is full");
        setLoading(false);
        setCode(["", "", "", ""]);
        inputs.current[0]?.focus();
        return;
      }

      const { data: playerData, error: joinError } = await supabase
        .from("players")
        .insert({
          room_code: upperCode,
          name: username,
          status: "joined"
        })
        .select()
        .single();

      if (joinError) {
        console.error("Error joining room:", joinError);
        alert("Failed to join room");
        setLoading(false);
        return;
      }

      localStorage.setItem("quiz_player_id", playerData.id);
      navigate(`/lobby/${upperCode}`);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to join room");
      setLoading(false);
    }
  }

  return (
    <div className="join-room-card">
      <h2 className="join-room-title">Join a Room</h2>
      
      <div className="code-input">
        <label className="code-label">Enter Room Code</label>
        <div className="code-inputs">
          {code.map((char, idx) => (
            <input
              key={idx}
              type="text"
              inputMode="text"
              maxLength={1}
              value={char}
              autoFocus={idx === 0}
              disabled={loading}
              onChange={e => processInput(e, idx)}
              onKeyUp={e => onKeyUp(e, idx)}
              ref={ref => {
                if (ref && !inputs.current.includes(ref)) {
                  inputs.current[idx] = ref;
                }
              }}
              className="code-input-box"
            />
          ))}
        </div>
      </div>

      <button 
        onClick={() => joinRoom()}
        disabled={loading || code.some(c => !c)}
        className="btn-join-action"
      >
        {loading ? "Joining..." : "Join Game"}
      </button>
      
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