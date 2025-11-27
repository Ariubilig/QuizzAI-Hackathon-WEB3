import React from 'react';
import { useNavigate } from 'react-router-dom';

const StartScreen = ({ onStart, onProfile, history, balance, username }) => {
    const navigate = useNavigate();

    return (
        <div className="start-screen">
            <div className="profile-btn-container" onClick={onProfile}>
                <span>{username}</span>
                <span className="balance-badge">{balance} 🪙</span>
            </div>

            <div className="start-screen-main">
                <h1>DanDar Quizz</h1>
                <p>10 Questions. 45 Seconds. Prove your knowledge.</p>

                <div className="start-actions flex gap-4">
                    <button onClick={onStart} className="btn-primary">Take Quiz</button>
                    <button onClick={() => navigate('/multiplayer')} className="btn-secondary bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-full font-bold transition-all transform hover:scale-105">Multiplayer</button>
                </div>
            </div>

            {history && history.length > 0 && (
                <div className="history-section">
                    <h3>Recent History</h3>
                    <div className="history-list">
                        {history.map((item, index) => (
                            <div key={index} className="history-item">
                                <div className="history-info">
                                    <span className="history-date">{item.date}</span>
                                    <span className="history-cat">{item.category || 'Mixed'}</span>
                                </div>
                                <span className="history-score">{item.score}/{item.total}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StartScreen;
