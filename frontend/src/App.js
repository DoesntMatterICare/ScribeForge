import { useState, useEffect, useCallback } from 'react';
import TheForge from './components/TheForge';
import Lobby from './components/Lobby';
import TheArena from './components/TheArena';
import { getWeapon } from './lib/storage';
import './App.css';

function App() {
  const [phase, setPhase] = useState('FORGE');
  const [gameData, setGameData] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setPendingRoom(room);
      if (getWeapon()) {
        setPhase('LOBBY');
      }
    }
  }, []);

  const handleEnterArena = useCallback(() => {
    setPhase('LOBBY');
  }, []);

  const handleGameStart = useCallback((data) => {
    setGameData(data);
    setPhase('ARENA');
  }, []);

  const handleExitArena = useCallback(() => {
    setGameData(null);
    setPhase('LOBBY');
    window.history.pushState({}, '', '/');
    setPendingRoom(null);
  }, []);

  const handleBackToForge = useCallback(() => {
    setPhase('FORGE');
    window.history.pushState({}, '', '/');
    setPendingRoom(null);
  }, []);

  return (
    <div className="game-app" data-testid="game-app">
      <div className="crt-scanlines" style={{ display: 'none' }} />

      {phase === 'FORGE' && (
        <TheForge
          onEnterArena={handleEnterArena}
          pendingRoom={pendingRoom}
        />
      )}

      {phase === 'LOBBY' && (
        <Lobby
          initialRoom={pendingRoom}
          onGameStart={handleGameStart}
          onBack={handleBackToForge}
        />
      )}

      {phase === 'ARENA' && gameData && (
        <TheArena
          gameData={gameData}
          onExit={handleExitArena}
        />
      )}
    </div>
  );
}

export default App;
