import { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";
import "../../App.css"; 

export default function MultiplayerGame() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // Map of questionId -> answer
  const [timeLeft, setTimeLeft] = useState(45);
  const [endTime, setEndTime] = useState(null); // New: for robust timer
  const [loading, setLoading] = useState(true);
  const [playerFinished, setPlayerFinished] = useState(false); // Track if player completed all questions
  const timerRef = useRef(null);

  // Load state from localStorage on mount or roomCode change
  useEffect(() => {
    if (!roomCode) return;

    // For multiplayer, always load fresh from database
    // Don't restore from localStorage as it may be stale
    console.log('MultiplayerGame: Loading fresh game state');
    loadGame();

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomCode]);

  // Don't save multiplayer game state to localStorage
  // We always load fresh from database


  // Shuffle array function (Fisher-Yates algorithm)
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  async function loadGame() {
    const { data: room, error } = await supabase
      .from("rooms")
      .select("questions, game_start_time")
      .eq("code", roomCode)
      .single();

    if (error || !room) {
      alert("Error loading game");
      return;
    }

    // Shuffle questions for this player
    const shuffledQuestions = shuffleArray(room.questions);
    setQuestions(shuffledQuestions);
    setLoading(false);
    
    // Calculate remaining time based on global game start time
    if (room.game_start_time) {
      // game_start_time is stored as milliseconds timestamp
      const gameStartTime = Number(room.game_start_time);
      const gameEndTime = gameStartTime + 45000; // 45 seconds total
      const now = Date.now();
      const remainingMs = Math.max(0, gameEndTime - now);
      const remainingSec = Math.ceil(remainingMs / 1000);
      
      console.log('Game Timer Debug:', {
        game_start_time: room.game_start_time,
        gameStartTime,
        gameEndTime,
        now,
        diff: now - gameStartTime,
        diffSeconds: (now - gameStartTime) / 1000,
        remainingMs,
        remainingSec
      });
      
      setEndTime(gameEndTime);
      setTimeLeft(remainingSec);
      
      if (remainingSec > 0) {
        startTimer();
      } else {
        // Game already ended - navigate directly to leaderboard
        console.log('Game already ended, navigating to leaderboard');
        navigate(`/leaderboard/${roomCode}`);
        return;
      }
    } else {
      // Fallback: no global start time (shouldn't happen)
      console.warn('No game_start_time found, using local timer');
      const calculatedEndTime = Date.now() + 45000;
      setEndTime(calculatedEndTime);
      setTimeLeft(45);
      startTimer();
    }
  }

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                clearInterval(timerRef.current);
                // Game over - navigate to leaderboard
                navigate(`/leaderboard/${roomCode}`);
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
  };

  const handleAnswer = (questionId, answerLetter) => {
    // Save answer
    const newSelectedAnswers = {
        ...selectedAnswers,
        [questionId]: answerLetter
    };
    setSelectedAnswers(newSelectedAnswers);

    // Auto advance
    if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
    } else {
        finishGame(newSelectedAnswers);
    }
  };

  async function finishGame(finalAnswersMap = selectedAnswers) {
    // Don't clear timer - let it continue
    setPlayerFinished(true); // Mark player as finished
    
    // Calculate score
    let finalScore = 0;
    questions.forEach(q => {
        if (finalAnswersMap[q.id] === q.correct_answer) {
            finalScore += 1;
        }
    });

    // Calculate time taken based on global timer
    const timeTaken = endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : timeLeft;
    const actualTimeTaken = 45 - timeTaken;
    
    const playerId = localStorage.getItem("quiz_player_id");

    if (playerId) {
        await supabase
          .from("players")
          .update({ 
              score: finalScore, 
              time_taken: actualTimeTaken * 1000,
              status: "finished" 
          })
          .eq("id", playerId);
    }
    
    // Clear localStorage for this game
    localStorage.removeItem(`multiplayerGame_${roomCode}`);
    
    // DON'T navigate yet - let the timer run out or realtime subscription handle it
    // Timer will continue and navigate when it hits 0
  }

  if (loading) return <div className="loading-container">Loading game...</div>;

  // Show waiting screen if player finished AND actually answered questions
  if (playerFinished && Object.keys(selectedAnswers).length > 0) {
    return (
      <div className="game-container" style={{ textAlign: 'center' }}>
        <h2>All Questions Completed! ✓</h2>
        <p style={{ fontSize: '1.2rem', margin: '2rem 0' }}>
          Waiting for other players to finish...
        </p>
        <div className="timer" style={{ fontSize: '3rem', color: timeLeft < 10 ? 'red' : 'var(--accent-color)' }}>
          {timeLeft}s
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: '1rem' }}>
          Game will end when time runs out or all players finish
        </p>
      </div>
    );
  }

  const question = questions[currentIndex];
  // Guard clause in case questions are empty or index out of bounds
  if (!question) return <div className="error-container">Error: Question not found</div>;

  const options = question.options; 

  return (
    <div className="game-container">
        <div className="game-header">
            <div className="timer" style={{ color: timeLeft < 10 ? 'red' : 'inherit' }}>
                Time: {timeLeft}s
            </div>
            <div className="progress">
                Question {currentIndex + 1} / {questions.length}
            </div>
        </div>

        <div className="question-card">
            <div className="category-badge">{question.category} - {question.difficulty}</div>
            <h2 className="question-text">{question.question}</h2>
            
            <div className="options-grid">
                {options.map((opt, idx) => {
                    const letter = ['A', 'B', 'C', 'D'][idx];
                    const isSelected = selectedAnswers[question.id] === letter;
                    
                    return (
                        <button
                            key={letter}
                            onClick={() => handleAnswer(question.id, letter)}
                            className={`option-btn ${isSelected ? 'selected' : ''}`}
                        >
                            <span className="option-letter">{letter}</span>
                            <span className="option-text">{opt}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    </div>
  );
}



