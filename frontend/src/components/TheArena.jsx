import { useEffect, useRef, useState, useCallback } from 'react';
import * as Phaser from 'phaser';
import ArenaScene from '../game/ArenaScene';
import StrokeCanvas from './StrokeCanvas';
import { getSkills } from '../lib/storage';
import { ArrowLeft, RotateCcw, Swords, Clock, Hand } from 'lucide-react';

const REFORGE_SECONDS = 7;

export default function TheArena({ gameData, onExit }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const initRef = useRef(false);
  const reforgeCanvasRef = useRef(null);
  const reforgeTimerRef = useRef(null);
  const [matchResult, setMatchResult] = useState(null);
  const [reforging, setReforging] = useState(false);
  const [reforgeTime, setReforgeTime] = useState(REFORGE_SECONDS);
  const [reforgeAnalysis, setReforgeAnalysis] = useState(null);

  const getScene = useCallback(() => {
    return gameRef.current?.scene?.getScene('ArenaScene');
  }, []);

  const closeReforge = useCallback((weaponData) => {
    setReforging(false);
    setReforgeAnalysis(null);
    if (reforgeTimerRef.current) { clearInterval(reforgeTimerRef.current); reforgeTimerRef.current = null; }
    const scene = getScene();
    if (scene && weaponData) {
      scene.reforgeWeapon(weaponData);
    } else if (scene) {
      scene.goBarehanded();
    }
  }, [getScene]);

  const handleGameEvent = useCallback((type, data) => {
    if (type === 'matchEnd') {
      setMatchResult(data);
      setReforging(false);
      if (reforgeTimerRef.current) { clearInterval(reforgeTimerRef.current); reforgeTimerRef.current = null; }
    }
    if (type === 'weaponBreak') {
      setReforging(true);
      setReforgeTime(REFORGE_SECONDS);
      setReforgeAnalysis(null);
      const startTime = Date.now();
      reforgeTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = Math.max(0, REFORGE_SECONDS - elapsed);
        setReforgeTime(remaining);
        if (remaining <= 0) {
          clearInterval(reforgeTimerRef.current);
          reforgeTimerRef.current = null;
          closeReforge(null);
        }
      }, 50);
    }
  }, [closeReforge]);

  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    initRef.current = true;

    ArenaScene.pendingData = {
      players: gameData.players,
      localId: gameData.network?.selfId || 'local',
      isHost: gameData.isHost,
      mode: gameData.mode,
      onEvent: handleGameEvent,
      network: gameData.network,
    };

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 1200,
      height: 600,
      backgroundColor: '#05050A',
      audio: {
        disableWebAudio: true,
      },
      physics: {
        default: 'matter',
        matter: { gravity: { y: 1.5 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [ArenaScene],
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      initRef.current = false;
      if (reforgeTimerRef.current) clearInterval(reforgeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestart = useCallback(() => {
    setMatchResult(null);
    setReforging(false);
    if (reforgeTimerRef.current) { clearInterval(reforgeTimerRef.current); reforgeTimerRef.current = null; }
    const scene = getScene();
    if (scene) {
      scene.scene.restart({
        players: gameData.players,
        localId: gameData.network?.selfId || 'local',
        isHost: gameData.isHost,
        mode: gameData.mode,
        onEvent: handleGameEvent,
        network: gameData.network,
      });
    }
  }, [gameData, handleGameEvent, getScene]);

  const handleSelectSavedWeapon = useCallback((weapon) => {
    closeReforge(weapon);
  }, [closeReforge]);

  const handleReforgeDrawn = useCallback(() => {
    if (!reforgeAnalysis) return;
    const weaponData = {
      vertices: reforgeAnalysis.vertices || reforgeAnalysis.hull || [],
      allPoints: reforgeAnalysis.allPoints || [],
      physics: reforgeAnalysis.physics || {},
      special: reforgeAnalysis.special || null,
    };
    closeReforge(weaponData);
  }, [reforgeAnalysis, closeReforge]);

  const savedWeapons = getSkills();
  const timerPct = reforgeTime / REFORGE_SECONDS;

  return (
    <div className="arena-screen" data-testid="arena-screen">
      <div className="arena-hud" data-testid="arena-hud">
        <button className="hud-btn" onClick={onExit} data-testid="exit-arena-btn">
          <ArrowLeft size={14} /> EXIT
        </button>
        <span className="hud-mode" data-testid="game-mode-label">
          {gameData.mode === 'practice' || gameData.mode === 'training' ? 'TRAINING MODE' : 'MULTIPLAYER'}
        </span>
      </div>

      <div ref={containerRef} className="arena-canvas" data-testid="arena-game-canvas" />

      {/* ═══════ MID-FIGHT REFORGE OVERLAY ═══════ */}
      {reforging && (
        <div className="reforge-overlay" data-testid="reforge-overlay">
          <div className="reforge-panel" data-testid="reforge-panel">
            <div className="reforge-header">
              <Swords size={18} />
              <h2 className="reforge-title">WEAPON BROKEN!</h2>
            </div>
            <p className="reforge-sub">Draw a new weapon or pick from saved — dodge attacks with A/D!</p>

            {/* Timer bar */}
            <div className="reforge-timer-wrap" data-testid="reforge-timer">
              <Clock size={12} />
              <div className="reforge-timer-bar">
                <div className="reforge-timer-fill" style={{ width: `${timerPct * 100}%`, background: timerPct > 0.4 ? '#38bdf8' : timerPct > 0.15 ? '#fbbf24' : '#f87171' }} />
              </div>
              <span className="reforge-timer-text">{reforgeTime.toFixed(1)}s</span>
            </div>

            <div className="reforge-body">
              {/* Draw canvas */}
              <div className="reforge-draw-section">
                <span className="reforge-label">DRAW NEW</span>
                <div className="reforge-canvas-wrap">
                  <StrokeCanvas ref={reforgeCanvasRef} onAnalysis={setReforgeAnalysis} />
                </div>
                {reforgeAnalysis && (
                  <button className="reforge-confirm-btn" onClick={handleReforgeDrawn} data-testid="reforge-confirm-btn">
                    <Swords size={14} /> EQUIP DRAWN WEAPON
                  </button>
                )}
              </div>

              {/* Saved weapons */}
              {savedWeapons.length > 0 && (
                <div className="reforge-saved-section">
                  <span className="reforge-label">OR PICK SAVED</span>
                  <div className="reforge-saved-grid">
                    {savedWeapons.map((w, i) => (
                      <button key={i} className="reforge-saved-item" onClick={() => handleSelectSavedWeapon(w)} data-testid={`reforge-saved-${i}`}>
                        {w.thumbnail && <img src={w.thumbnail} alt={w.name} className="reforge-thumb" />}
                        <span className="reforge-saved-name">{w.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className="reforge-barehanded-btn" onClick={() => closeReforge(null)} data-testid="reforge-barehanded-btn">
              <Hand size={14} /> FIGHT BARE-HANDED
            </button>
          </div>
        </div>
      )}

      {/* ═══════ MATCH RESULT OVERLAY ═══════ */}
      {matchResult && (
        <div className="match-result-overlay" data-testid="match-result-overlay">
          <div className="result-card">
            <h2 className="result-title" data-testid="match-result-title">
              {matchResult.winnerId ? `${matchResult.winnerName || 'PLAYER'} WINS!` : 'DRAW!'}
            </h2>
            {matchResult.p1Rounds !== undefined && (
              <div className="result-rounds" data-testid="match-rounds">
                <span className="round-score">{matchResult.p1Rounds}</span>
                <span className="round-dash">-</span>
                <span className="round-score">{matchResult.p2Rounds}</span>
              </div>
            )}
            {matchResult.winStreak > 1 && (
              <p className="win-streak-text" data-testid="win-streak">WIN STREAK: {matchResult.winStreak}</p>
            )}
            <div className="result-actions">
              <button className="primary-btn" onClick={handleRestart} data-testid="rematch-btn">
                <RotateCcw size={16} /> REMATCH
              </button>
              <button className="secondary-btn" onClick={onExit} data-testid="exit-to-lobby-btn">
                <ArrowLeft size={16} /> EXIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
