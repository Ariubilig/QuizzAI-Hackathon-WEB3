import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import SelectCategory from './SelectCategory';
import StartScreen from './StartScreen';
import Profile from './Profile';

const QuizGame = () => {
    // Generate random username as fallback
    const generateRandomUsername = () => {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `Player${randomNum}`;
    };

    const [loading, setLoading] = useState(false);
    const [quizData, setQuizData] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(45);
    const [gameOver, setGameOver] = useState(false);
    const [error, setError] = useState(null);
    const timerRef = useRef(null);

    const [endTime, setEndTime] = useState(null);

    // Profile State - use stored username or generate random
    const getInitialUsername = () => {
        const storedProfile = localStorage.getItem('userProfile');
        if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            return profile.username || generateRandomUsername();
        }
        return generateRandomUsername();
    };

    const [userProfile, setUserProfile] = useState({
        username: getInitialUsername(),
        balance: 1000,
        history: [],
        stats: {
            totalGames: 0,
            wins: 0,
            losses: 0,
            winRate: 0
        }
    });

    const [selectedCategory, setSelectedCategory] = useState('Mixed');
    const [selectedDifficulty, setSelectedDifficulty] = useState('Mixed');
    const [view, setView] = useState('home'); // home, category, profile, playing, result

    const categories = ['Mixed', 'Өв Соёл', 'Спорт', 'Anime', 'eSports', 'Монголын Түүх', 'Поп Соёл', 'Монгол Хоол', 'Шинжлэх ухаан', 'Технологи', 'Математик', 'Ерөнхий мэдлэг'];
    const difficulties = ['Mixed', 'Easy', 'Medium', 'Hard'];

    // Load state from localStorage on mount
    useEffect(() => {
        const savedState = localStorage.getItem('quizState');
        const savedProfile = localStorage.getItem('userProfile');

        if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            setUserProfile(profile);
        } else {
            // Initialize profile if not exists
            const initialProfile = {
                username: getInitialUsername(),
                balance: 1000,
                history: [],
                stats: {
                    totalGames: 0,
                    wins: 0,
                    losses: 0,
                    winRate: 0
                }
            };
            setUserProfile(initialProfile);
            localStorage.setItem('userProfile', JSON.stringify(initialProfile));
        }

        if (savedState) {
            const parsed = JSON.parse(savedState);

            // Calculate remaining time based on stored endTime
            let remainingTime = 0;
            if (parsed.endTime && !parsed.gameOver) {
                const now = Date.now();
                remainingTime = Math.max(0, Math.ceil((parsed.endTime - now) / 1000));
            } else {
                remainingTime = parsed.timeLeft;
            }

            setQuizData(parsed.quizData);
            setCurrentQuestionIndex(parsed.currentQuestionIndex);
            setSelectedAnswers(parsed.selectedAnswers);
            setScore(parsed.score);
            setTimeLeft(remainingTime);
            setEndTime(parsed.endTime);
            setGameOver(parsed.gameOver);

            if (parsed.selectedCategory) {
                setSelectedCategory(parsed.selectedCategory);
            }
            if (parsed.selectedDifficulty) {
                setSelectedDifficulty(parsed.selectedDifficulty);
            }

            // Restore view state if possible, otherwise infer
            if (parsed.quizData && !parsed.gameOver) {
                setView('playing');
                if (remainingTime > 0) {
                    startTimer();
                } else {
                    setGameOver(true);
                    setTimeLeft(0);
                    setView('result');
                }
            } else if (parsed.gameOver) {
                setView('result');
            }
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (quizData) {
            localStorage.setItem('quizState', JSON.stringify({
                quizData,
                currentQuestionIndex,
                selectedAnswers,
                score,
                timeLeft,
                endTime,
                gameOver,
                selectedCategory,
                selectedDifficulty
            }));
        }
    }, [quizData, currentQuestionIndex, selectedAnswers, score, timeLeft, endTime, gameOver, selectedCategory, selectedDifficulty]);

    const fetchQuiz = async () => {
        setLoading(true);
        setError(null);
        setGameOver(false);
        setScore(0);
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setTimeLeft(45);
        setEndTime(null);

        // Clear previous state
        localStorage.removeItem('quizState');

        try {
            const { data, error } = await supabase.functions.invoke('generate-quiz', {
                body: {
                    category: selectedCategory,
                    difficulty: selectedDifficulty
                }
            });

            if (error) {
                throw new Error(error.message || 'Failed to fetch quiz');
            }

            if (!data || !data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
                throw new Error('Invalid quiz data received from server');
            }

            setQuizData(data);
            setView('playing');

            // Set end time 45 seconds from now
            const calculatedEndTime = Date.now() + 45000;
            setEndTime(calculatedEndTime);

            startTimer();
        } catch (err) {
            console.error("Fetch error:", err);
            setError(err.message || 'Failed to load quiz');
            setLoading(false);
        } finally {
            setLoading(false);
        }
    };

    const handleStartGame = () => {
        if (userProfile.balance < 50) {
            alert("Not enough coins! You need 50 coins to play.");
            return;
        }

        // Deduct entry fee
        setUserProfile(prev => {
            const newProfile = {
                ...prev,
                balance: prev.balance - 50
            };
            localStorage.setItem('userProfile', JSON.stringify(newProfile));
            return newProfile;
        });

        fetchQuiz();
    };

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    endGame();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const endGame = () => {
        clearInterval(timerRef.current);
        setGameOver(true);
        setView('result');
    };

    const calculateScore = () => {
        if (!quizData) return;
        let newScore = 0;
        quizData.questions.forEach((q) => {
            if (selectedAnswers[q.id] === q.correct_answer) {
                newScore += 1;
            }
        });
        setScore(newScore);

        // Determine Win/Loss
        const isWin = newScore >= 7; // 70% win rate required
        const reward = isWin ? 100 : 0;
        const coinChange = isWin ? 50 : -50; // Net change (Reward - Entry Fee)

        const newHistoryItem = {
            id: quizData.quiz_id || Date.now(),
            date: new Date().toLocaleString(),
            score: newScore,
            total: quizData.questions.length,
            category: selectedCategory,
            result: isWin ? 'Win' : 'Loss',
            coinChange: coinChange
        };

        setUserProfile(prev => {
            const newHistory = [newHistoryItem, ...prev.history].slice(0, 20);
            const newStats = {
                totalGames: prev.stats.totalGames + 1,
                wins: prev.stats.wins + (isWin ? 1 : 0),
                losses: prev.stats.losses + (isWin ? 0 : 1),
                winRate: 0
            };
            newStats.winRate = Math.round((newStats.wins / newStats.totalGames) * 100);

            const newProfile = {
                balance: prev.balance + reward,
                history: newHistory,
                stats: newStats
            };

            localStorage.setItem('userProfile', JSON.stringify(newProfile));
            return newProfile;
        });
    };

    const handleAnswerSelect = (questionId, option) => {
        if (gameOver) return;
        setSelectedAnswers((prev) => ({
            ...prev,
            [questionId]: option
        }));
    };

    const handleNext = () => {
        if (currentQuestionIndex < quizData.questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
        } else {
            endGame();
        }
    };

    const handleHome = () => {
        setQuizData(null);
        setGameOver(false);
        setScore(0);
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setTimeLeft(45);
        setEndTime(null);
        localStorage.removeItem('quizState');
        setView('home');
    };

    const handlePlayAgain = () => {
        setView('category');
    };

    const handleUsernameChange = (newUsername) => {
        setUserProfile(prev => {
            const newProfile = {
                ...prev,
                username: newUsername
            };
            localStorage.setItem('userProfile', JSON.stringify(newProfile));
            return newProfile;
        });
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    useEffect(() => {
        if (gameOver) {
            calculateScore();
        }
    }, [gameOver]);

    if (loading) {
        return (
            <div className="loading-container">Generating {selectedCategory} Quiz...</div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <p>Error: {error}</p>
                <button onClick={() => setView('home')} className="btn-primary">Go Home</button>
            </div>
        );
    }

    // View Routing
    if (view === 'home') {
        return (
            <StartScreen
                onStart={() => setView('category')}
                onProfile={() => setView('profile')}
                history={userProfile.history}
                balance={userProfile.balance}
                username={userProfile.username}
            />
        );
    }

    if (view === 'profile') {
        return (
            <Profile
                onBack={() => setView('home')}
                history={userProfile.history}
                balance={userProfile.balance}
                stats={userProfile.stats}
                username={userProfile.username}
                onUsernameChange={handleUsernameChange}
            />
        );
    }

    if (view === 'category') {
        return (
            <SelectCategory
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                difficulties={difficulties}
                selectedDifficulty={selectedDifficulty}
                onSelectDifficulty={setSelectedDifficulty}
                onStart={handleStartGame}
                onBack={() => setView('home')}
            />
        );
    }

    if (view === 'result') {
        return (
            <div className="results-screen">
                <h2>Game Over</h2>
                <div className="score-display">
                    <span className="score-value">{score}</span>
                    <span className="score-total">/ {quizData?.questions?.length || 10}</span>
                </div>
                <p>Time Remaining: {timeLeft}s</p>
                <div className="action-buttons">
                    <button onClick={handlePlayAgain} className="btn-primary">Play Again</button>
                    <button onClick={handleHome} className="btn-secondary">Home</button>
                </div>

                <div className="answers-review">
                    <h3>Review</h3>
                    {quizData?.questions.map((q, index) => (
                        <div key={q.id} className={`review-item ${selectedAnswers[q.id] === q.correct_answer ? 'correct' : 'incorrect'}`}>
                            <p><strong>Q{index + 1}:</strong> {q.question}</p>
                            <p>Your Answer: {selectedAnswers[q.id] || 'Skipped'}</p>
                            <p>Correct Answer: {q.correct_answer}</p>
                            <p className="explanation">{q.explanation}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Playing View
    const currentQuestion = quizData?.questions?.[currentQuestionIndex];

    if (!currentQuestion) {
        return <div className="error-container">Error: Question not found</div>;
    }

    return (
        <div className="game-container">
            <div className="game-header">
                <div className="timer" style={{ color: timeLeft < 10 ? 'red' : 'inherit' }}>
                    Time: {timeLeft}s
                </div>
                <div className="progress">
                    Question {currentQuestionIndex + 1} / {quizData.questions.length}
                </div>
            </div>

            <div className="question-card">
                <div className="category-badge">{currentQuestion.category} - {currentQuestion.difficulty}</div>
                <h2 className="question-text">{currentQuestion.question}</h2>

                <div className="options-grid">
                    {currentQuestion.options.map((opt, idx) => {
                        const letter = ['A', 'B', 'C', 'D'][idx];
                        const isSelected = selectedAnswers[currentQuestion.id] === letter;
                        return (
                            <button
                                key={letter}
                                className={`option-btn ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                    handleAnswerSelect(currentQuestion.id, letter);
                                    handleNext()
                                }}
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
};

export default QuizGame;
