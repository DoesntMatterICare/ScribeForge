import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Users, Play, Swords, ArrowLeft, Bot } from 'lucide-react';
import { createGameRoom, generateRoomCode } from '../lib/networking';
import { getWeapon, getPlayerName, getArmor } from '../lib/storage';

export default function Lobby({ initialRoom, onGameStart, onBack }) {
  const [roomCode, setRoomCode] = useState(initialRoom || '');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('idle');
  const [copied, setCopied] = useState(false);
  const networkRef = useRef(null);
  const joinedRef = useRef(false);

  const weapon = getWeapon();
  const playerName = getPlayerName();
  const armor = getArmor();

  const setupNetwork = useCallback((code, hosting) => {
    if (networkRef.current) return;
    const net = createGameRoom(code);
    networkRef.current = net;

    const me = { id: net.selfId || crypto.randomUUID(), name: playerName, weapon, isLocal: true };
    setPlayers([me]);
    setStatus('connected');

    net.onPeerJoin((peerId) => {
      net.send.weapon({ name: playerName, weapon }, peerId);
      setPlayers(prev => {
        if (prev.find(p => p.id === peerId)) return prev;
        return [...prev, { id: peerId, name: 'Connecting...', weapon: null }];
      });
    });

    net.on.weapon((data, peerId) => {
      setPlayers(prev => prev.map(p =>
        p.id === peerId ? { ...p, name: data.name || 'Player', weapon: data.weapon } : p
      ));
    });

    net.onPeerLeave((peerId) => {
      setPlayers(prev => prev.filter(p => p.id !== peerId));
    });

    if (!hosting) {
      net.on.start((data) => {
        onGameStart({ ...data, network: networkRef.current, isHost: false });
      });
    }
  }, [playerName, weapon, onGameStart]);

  const handleHost = useCallback(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);
    window.history.pushState({}, '', `?room=${code}`);
    setupNetwork(code, true);
  }, [setupNetwork]);

  const handleJoin = useCallback(() => {
    if (!roomCode.trim() || roomCode.trim().length < 3) return;
    const code = roomCode.trim().toUpperCase();
    setRoomCode(code);
    setIsHost(false);
    window.history.pushState({}, '', `?room=${code}`);
    setupNetwork(code, false);
  }, [roomCode, setupNetwork]);

  useEffect(() => {
    if (initialRoom && !joinedRef.current && !networkRef.current) {
      joinedRef.current = true;
      setRoomCode(initialRoom);
      setIsHost(false);
      const timer = setTimeout(() => setupNetwork(initialRoom, false), 200);
      return () => clearTimeout(timer);
    }
  }, [initialRoom, setupNetwork]);

  const handleStartGame = useCallback(() => {
    const gameData = {
      players: players.map(p => ({ id: p.id, name: p.name, weapon: p.weapon, armor: p.armor || armor })),
      network: networkRef.current,
      isHost: true,
      mode: 'multiplayer',
    };
    networkRef.current?.send.start(gameData);
    onGameStart(gameData);
  }, [players, armor, onGameStart]);

  const handlePractice = useCallback(() => {
    onGameStart({
      players: [{ id: 'local', name: playerName, weapon, armor }],
      network: null,
      isHost: true,
      mode: 'training',
    });
  }, [playerName, weapon, armor, onGameStart]);

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomCode]);

  useEffect(() => {
    return () => {
      networkRef.current?.leave();
      networkRef.current = null;
    };
  }, []);

  return (
    <div className="lobby-screen" data-testid="lobby-screen">
      <button className="back-btn" onClick={onBack} data-testid="lobby-back-btn">
        <ArrowLeft size={16} /> BACK TO FORGE
      </button>

      <h1 className="lobby-title" data-testid="lobby-title">THE ARENA</h1>
      <p className="lobby-subtitle">CHOOSE YOUR BATTLE</p>

      {status === 'idle' && (
        <div className="lobby-options" data-testid="lobby-options">
          <div className="lobby-card" data-testid="host-card">
            <Users size={32} className="lobby-icon" />
            <h2>HOST GAME</h2>
            <p>Create a room & invite fighters</p>
            <button className="primary-btn" onClick={handleHost} data-testid="host-game-btn">
              HOST GAME
            </button>
          </div>

          <div className="lobby-card" data-testid="join-card">
            <Swords size={32} className="lobby-icon" />
            <h2>JOIN GAME</h2>
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              className="room-input"
              maxLength={5}
              data-testid="room-code-input"
            />
            <button
              className="primary-btn"
              onClick={handleJoin}
              disabled={roomCode.length < 3}
              data-testid="join-game-btn"
            >
              JOIN GAME
            </button>
          </div>

          <div className="lobby-card practice" data-testid="practice-card">
            <Bot size={32} className="lobby-icon" />
            <h2>TRAINING</h2>
            <p>Practice combos on a training dummy</p>
            <button className="practice-btn" onClick={handlePractice} data-testid="practice-mode-btn">
              <Swords size={16} /> START TRAINING
            </button>
          </div>
        </div>
      )}

      {status !== 'idle' && (
        <div className="lobby-room" data-testid="lobby-room">
          <div className="room-code-display" data-testid="room-code-display">
            <span className="room-code-label">ROOM CODE</span>
            <span className="room-code" data-testid="room-code-value">{roomCode}</span>
            <button className="copy-btn" onClick={copyLink} data-testid="copy-link-btn">
              <Copy size={14} /> {copied ? 'COPIED!' : 'COPY LINK'}
            </button>
          </div>

          <div className="players-list" data-testid="players-list">
            <h3><Users size={16} /> FIGHTERS ({players.length}/4)</h3>
            {players.map(p => (
              <div key={p.id} className="player-card" data-testid={`player-card-${p.id}`}>
                {p.weapon?.texture && (
                  <img src={p.weapon.texture} alt="weapon" className="weapon-preview" />
                )}
                <div className="player-info">
                  <span className="player-name">{p.name}{p.isLocal ? ' (YOU)' : ''}</span>
                  {p.weapon && (
                    <span className="weapon-info">{p.weapon.name} &middot; {p.weapon.element?.toUpperCase()}</span>
                  )}
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
              <div key={`wait-${i}`} className="player-card waiting">
                <span>Waiting for fighters...</span>
              </div>
            ))}
          </div>

          {isHost && players.length >= 2 && (
            <button className="start-btn" onClick={handleStartGame} data-testid="start-game-btn">
              <Play size={20} /> START TOURNAMENT ({players.length} PLAYERS)
            </button>
          )}

          {!isHost && players.length < 2 && (
            <p className="connecting-text" data-testid="connecting-text">Waiting for host...</p>
          )}
        </div>
      )}
    </div>
  );
}
