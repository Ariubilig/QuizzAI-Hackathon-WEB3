import React, { useState, useEffect, useRef } from 'react';
import SelectCategory from './SelectCategory';
import StartScreen from './StartScreen';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const QuizGame = () => {
    const [haveamount, setHaveamount] = useState(true)
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
    const [quizHistory, setQuizHistory] = useState([]);

    const [selectedCategory, setSelectedCategory] = useState('Mixed');
    const [selectedDifficulty, setSelectedDifficulty] = useState('Mixed');
    const [view, setView] = useState('home'); // home, category, playing, result
    
    const categories = ['Mixed', 'Science', 'History', 'Geography', 'Technology', 'Space', 'Pop Culture', 'Mathematics'];
    const difficulties = ['Mixed', 'Easy', 'Medium', 'Hard'];

    // Load state from localStorage on mount
    useEffect(() => {
        const savedState = localStorage.getItem('quizState');
        const savedHistory = localStorage.getItem('quizHistory');
        
        if (savedHistory) {
            setQuizHistory(JSON.parse(savedHistory));
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
            const response = await fetch('http://localhost:3000/api/quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    category: selectedCategory,
                    difficulty: selectedDifficulty 
                }),
            });
            if (!response.ok) {
                throw new Error('Failed to fetch quiz');
            }
            const data = await response.json();
            
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
        
        const newHistoryItem = {
            id: quizData.quiz_id || Date.now(),
            date: new Date().toLocaleString(),
            score: newScore,
            total: quizData.questions.length,
            category: selectedCategory
        };

        setQuizHistory(prev => {
            if (prev.length > 0 && prev[0].id === newHistoryItem.id) {
                return prev;
            }
            const newHistory = [newHistoryItem, ...prev].slice(0, 10);
            localStorage.setItem('quizHistory', JSON.stringify(newHistory));
            return newHistory;
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
        // Go to category selection instead of immediate restart
        setView('category');
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


    // Wallet button component for top right
    const WalletButton = () => 
        {haveamount && 
        <div className="wallet-button-container">
            <ConnectButton chainStatus="icon" showBalance={false} />
        </div>
        };

    if (loading) {
        return (
            <>
                <WalletButton />
                <div className="loading-container">Generating {selectedCategory} Quiz...</div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <WalletButton />
                <div className="error-container">
                    <p>Error: {error}</p>
                    <button onClick={() => setView('home')} className="btn-primary">Go Home</button>
                </div>
            </>
        );
    }

    // View Routing
    if (view === 'home') {
        return (
            <>
                <WalletButton />
                <StartScreen 
                    onStart={() => setView('category')} 
                    history={quizHistory} 
                    setHaveamount={setHaveamount}
                />
            </>
        );
    }

    if (view === 'category') {
        return (
            <>
                <WalletButton />
                <SelectCategory 
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    difficulties={difficulties}
                    selectedDifficulty={selectedDifficulty}
                    onSelectDifficulty={setSelectedDifficulty}
                    onStart={fetchQuiz}
                    onBack={() => setView('home')}
                    haveamount={haveamount}
                />
            </>
        );
    }

    if (view === 'result') {
        return (
            <>
                <WalletButton />
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
            </>
        );
    }

    // Playing View
    const currentQuestion = quizData?.questions?.[currentQuestionIndex];

    if (!currentQuestion) {
        return <div className="error-container">Error: Question not found</div>;
    }

    return (
        <>
            <WalletButton />
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
                                    onClick={() => handleAnswerSelect(currentQuestion.id, letter)}
                                >
                                    <span className="option-letter">{letter}</span>
                                    <span className="option-text">{opt}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="game-footer">
                    <button 
                        className="btn-next" 
                        onClick={handleNext}
                        disabled={!selectedAnswers[currentQuestion.id]}
                    >
                        {currentQuestionIndex === quizData.questions.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default QuizGame;
