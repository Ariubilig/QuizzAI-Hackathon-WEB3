import React, { useState } from 'react';
import WalletConnect from './WalletConnect';
import { useAccount } from 'wagmi';

const StartScreen = ({ onStart, history }) => {
    const [showWalletConnect, setShowWalletConnect] = useState(false);
    const { isConnected } = useAccount();

    const handleTakeQuiz = () => {
        // If wallet already connected, skip modal
        if (isConnected) {
            onStart();
        } else {
            setShowWalletConnect(true);
        }
    };

    const handleWalletConnect = (walletType) => {
        console.log('Connected with:', walletType);
        setShowWalletConnect(false);
        onStart();
    };

    const handleSkipWallet = () => {
        setShowWalletConnect(false);
        onStart();
    };

    return (
        <div className="start-screen">
            {showWalletConnect && (
                <WalletConnect 
                    onConnect={handleWalletConnect}
                    onSkip={handleSkipWallet}
                />
            )}

            <div className="start-screen-main">
                <h1>Infinite Quiz AI</h1>
                <p>10 Questions. 45 Seconds. Prove your knowledge.</p>
                
                <div className="start-actions">
                    <button onClick={handleTakeQuiz} className="btn-primary">Take Quiz</button>
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
