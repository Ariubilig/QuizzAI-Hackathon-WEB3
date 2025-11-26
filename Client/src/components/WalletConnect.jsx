import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

const WalletConnect = ({ onConnect, onSkip }) => {
    const { isConnected, address } = useAccount();
    const [hasInteracted, setHasInteracted] = useState(false);
    const initialConnectionRef = useRef(isConnected);

    // Only auto-proceed if user connects AFTER opening this modal
    useEffect(() => {
        if (hasInteracted && isConnected && address && !initialConnectionRef.current) {
            onConnect(address);
        }
    }, [isConnected, address, onConnect, hasInteracted]);

    // Track when user interacts with the connect button
    const handleConnectClick = () => {
        setHasInteracted(true);
    };

    return (
        <div className="wallet-connect-overlay">
            <div className="wallet-connect-modal">
                <h2>Connect Your Wallet</h2>
                <p className="wallet-subtitle">Choose a wallet to connect and play with stakes</p>
                
                <div className="rainbowkit-wrapper" onClick={handleConnectClick}>
                    <ConnectButton 
                        chainStatus="icon"
                        accountStatus="address"
                        showBalance={false}
                    />
                </div>

                <button className="btn-later" onClick={onSkip}>
                    Play Without Wallet (Later)
                </button>
            </div>
        </div>
    );
};

export default WalletConnect;
