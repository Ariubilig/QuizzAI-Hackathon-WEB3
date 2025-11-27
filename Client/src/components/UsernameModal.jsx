import { useState } from "react";
import { supabase } from "../supabaseClient";
import "../App.css";

export default function UsernameModal({ onSave }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      alert("Please enter a username");
      return;
    }

    setLoading(true);

    try {
      // Generate or get device ID
      let deviceId = localStorage.getItem("quiz_device_id");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("quiz_device_id", deviceId);
      }

      // Save to Supabase users table
      const { data, error } = await supabase
        .from("users")
        .upsert({
          device_id: deviceId,
          username: trimmed,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "device_id"
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving username:", error);
        // Still save locally even if Supabase fails
      }

      // Save to localStorage
      localStorage.setItem("quiz_username", trimmed);
      if (data?.id) {
        localStorage.setItem("quiz_user_id", data.id);
      }

      onSave(trimmed);
    } catch (error) {
      console.error("Error:", error);
      // Save locally anyway
      localStorage.setItem("quiz_username", trimmed);
      onSave(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <div className="username-modal-overlay">
      <div className="username-modal">
        <h2>Welcome to DanDar Quizz</h2>
        <p className="username-subtitle">What should we call you?</p>
        
        <input
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyPress={handleKeyPress}
          className="username-input-field"
          maxLength={20}
          autoFocus
        />
        
        <button 
          onClick={handleSave}
          disabled={loading || !username.trim()}
          className="btn-save-username"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
