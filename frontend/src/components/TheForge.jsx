import { useState, useRef, useCallback } from 'react';
import { Flame, Droplets, Save, Swords, Trash2, Zap, Shield, HardHat } from 'lucide-react';
import StrokeCanvas from './StrokeCanvas';
import ArmorCanvas from './ArmorCanvas';
import SkillsPanel from './SkillsPanel';
import { saveSkill, getSkills, getWeapon, savePlayerName, getPlayerName, saveArmor, getArmor } from '../lib/storage';

const STAT_COLORS = {
  power: '#f472b6',
  speed: '#60a5fa',
  reach: '#34d399',
  parry: '#a78bfa',
  chaos: '#fbbf24',
};

const DMG_COLORS = {
  slash: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  blunt: { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  pierce: { bg: 'rgba(244,114,182,0.15)', text: '#f472b6' },
  raw: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
};

const TIER_COLORS = {
  none: '#475569',
  light: '#60a5fa',
  medium: '#a78bfa',
  heavy: '#fbbf24',
};

export default function TheForge({ onEnterArena, pendingRoom }) {
  const [playerName, setPlayerName] = useState(getPlayerName());
  const [weaponName, setWeaponName] = useState('');
  const [element, setElement] = useState('fire');
  const [analysis, setAnalysis] = useState(null);
  const [armorAnalysis, setArmorAnalysis] = useState(getArmor());
  const [saved, setSaved] = useState(!!getWeapon());
  const [ver, setVer] = useState(0);
  const [activeTab, setActiveTab] = useState('weapon'); // 'weapon' or 'armor'
  const canvasRef = useRef(null);
  const armorCanvasRef = useRef(null);

  const handleSave = useCallback(() => {
    if (!weaponName.trim() || !canvasRef.current) return;
    const a = canvasRef.current.getAnalysis();
    const thumb = canvasRef.current.toDataURL();
    const strokes = canvasRef.current.getStrokes();
    const stroke = canvasRef.current.getStroke?.() || (strokes?.[0] || []);

    const data = {
      name: weaponName.trim(),
      element,
      thumbnail: thumb,
      strokes,
      stroke,
      vertices: a?.vertices || a?.hull || [],
      allPoints: a?.allPoints || [],
      physics: a?.physics || {},
      special: a?.special || { name: 'OVERPOWER', type: 'overpower', desc: 'Double damage single hit' },
      statBars: a?.statBars || { power: 0.3, speed: 0.5, reach: 0.4, parry: 0.3, chaos: 0 },
      dominantType: a?.dominantType || 'raw',
      gripPoint: a?.gripPoint || null,
      gripOffset: a?.gripOffset || null,
      gripEnd: a?.gripEnd || 'center',
      isOpenStroke: a?.isOpenStroke || false,
      ribbonPolygon: a?.ribbonPolygon || null,
      rawMetrics: a?.rawMetrics || {},
    };
    if (saveSkill(data)) {
      savePlayerName(playerName.trim() || 'Fighter');
      // Also save armor if drawn
      if (armorAnalysis && armorAnalysis.hasArmor) {
        saveArmor(armorAnalysis);
      }
      setSaved(true);
      setWeaponName('');
      canvasRef.current.clear();
      setVer(v => v + 1);
    }
  }, [weaponName, element, playerName, armorAnalysis]);

  const handleClear = useCallback(() => { canvasRef.current?.clear(); setAnalysis(null); }, []);
  const handleClearArmor = useCallback(() => {
    armorCanvasRef.current?.clear();
    setArmorAnalysis(null);
    saveArmor(null);
  }, []);

  const handleArmorAnalysis = useCallback((result) => {
    setArmorAnalysis(result);
    if (result && result.hasArmor) {
      saveArmor(result);
    }
  }, []);

  const ph = analysis?.physics;
  const sp = analysis?.special;
  const bars = analysis?.statBars;
  const dt = analysis?.dominantType;

  return (
    <div className="forge-screen" data-testid="forge-screen">
      <div className="forge-header">
        <h1 className="forge-title" data-testid="forge-title">THE FORGE</h1>
        <p className="forge-subtitle">Draw your weapon &amp; armor &middot; Shape defines physics &middot; Enter the arena</p>
      </div>

      <div className="forge-main-grid">
        {/* Drawing Area with Tabs */}
        <div className="forge-draw-panel" data-testid="draw-panel">
          <div className="draw-tab-bar">
            <button className={`draw-tab ${activeTab === 'weapon' ? 'active' : ''}`}
              onClick={() => setActiveTab('weapon')}>
              <Swords size={14} /> WEAPON
            </button>
            <button className={`draw-tab ${activeTab === 'armor' ? 'active' : ''}`}
              onClick={() => setActiveTab('armor')}>
              <Shield size={14} /> ARMOR
            </button>
          </div>

          {activeTab === 'weapon' && (
            <>
              <div className="draw-header">
                <span className="panel-label">DRAW WEAPON</span>
                <button className="tool-btn clear-btn" onClick={handleClear} data-testid="clear-canvas-btn">
                  <Trash2 size={14} /> Clear
                </button>
              </div>
              <StrokeCanvas ref={canvasRef} onAnalysis={setAnalysis} />
              <p className="draw-hint">One continuous stroke — shape determines weapon stats</p>
            </>
          )}

          {activeTab === 'armor' && (
            <>
              <div className="draw-header">
                <span className="panel-label">DRAW ARMOR</span>
                <button className="tool-btn clear-btn" onClick={handleClearArmor}>
                  <Trash2 size={14} /> Clear
                </button>
              </div>
              <ArmorCanvas ref={armorCanvasRef} onAnalysis={handleArmorAnalysis} />
              <p className="draw-hint">Fill the head circle for helmet, torso rectangle for body armor — more fill = stronger</p>
            </>
          )}
        </div>

        {/* Stats & Config */}
        <div className="forge-config-panel" data-testid="config-panel">
          {/* Weapon Analysis */}
          {analysis && bars && (
            <div className="geo-stats" data-testid="geo-stats">
              <h3 className="panel-label">WEAPON ANALYSIS</h3>

              {/* 5-bar stat display */}
              <div className="stat-bars-large">
                {[
                  ['Power', bars.power, STAT_COLORS.power],
                  ['Speed', bars.speed, STAT_COLORS.speed],
                  ['Reach', bars.reach, STAT_COLORS.reach],
                  ['Parry', bars.parry, STAT_COLORS.parry],
                  ['Chaos', bars.chaos, STAT_COLORS.chaos],
                ].map(([label, val, color]) => (
                  <div className="stat-row" key={label}>
                    <span className="stat-label">{label}</span>
                    <div className="stat-track">
                      <div className="stat-fill" style={{ width: `${(val || 0) * 100}%`, background: color }} />
                    </div>
                    <span className="stat-val">{Math.round((val || 0) * 100)}</span>
                  </div>
                ))}
              </div>

              {/* Damage types */}
              <div className="dmg-types">
                {ph && ph.slash > 0 && (
                  <span className="dmg-tag" style={{ background: DMG_COLORS.slash.bg, color: DMG_COLORS.slash.text }}>
                    Slash {Math.round(ph.slash)}
                  </span>
                )}
                {ph && ph.blunt > 0 && (
                  <span className="dmg-tag" style={{ background: DMG_COLORS.blunt.bg, color: DMG_COLORS.blunt.text }}>
                    Blunt {Math.round(ph.blunt)}
                  </span>
                )}
                {ph && ph.pierce > 0 && (
                  <span className="dmg-tag" style={{ background: DMG_COLORS.pierce.bg, color: DMG_COLORS.pierce.text }}>
                    Pierce {Math.round(ph.pierce)}
                  </span>
                )}
              </div>

              {/* Dominant type badge */}
              {dt && dt !== 'raw' && (
                <div className="dominant-type-badge" data-testid="dominant-type">
                  <Zap size={10} /> {dt.toUpperCase()} WEAPON
                </div>
              )}

              {/* Special move */}
              {sp && (
                <div className="special-badge" data-testid="special-badge">
                  <Zap size={12} /> {sp.name}: {sp.desc}
                </div>
              )}

              {/* Physics details */}
              <div className="physics-details">
                <span className="phys-tag">Mass {ph ? Math.round(ph.mass * 10) / 10 : 0}</span>
                <span className="phys-tag">Reach {ph ? Math.round(ph.reach) : 0}</span>
                {ph && ph.blockBreak > 0 && <span className="phys-tag">Break {Math.round(ph.blockBreak * 100)}%</span>}
                {ph && ph.aoeRadius > 0 && <span className="phys-tag">AOE {Math.round(ph.aoeRadius)}</span>}
              </div>
            </div>
          )}

          {/* ═══════ ARMOR ANALYSIS ═══════ */}
          {armorAnalysis && armorAnalysis.hasArmor && (
            <div className="armor-stats" data-testid="armor-stats">
              <h3 className="panel-label"><Shield size={14} /> ARMOR ANALYSIS</h3>

              {/* Helmet */}
              {armorAnalysis.helmet && armorAnalysis.helmet.tier !== 'none' && (
                <div className="armor-row">
                  <div className="armor-icon-label">
                    <HardHat size={14} style={{ color: TIER_COLORS[armorAnalysis.helmet.tier] }} />
                    <span className="armor-name">Helmet</span>
                    <span className="armor-tier" style={{ color: TIER_COLORS[armorAnalysis.helmet.tier] }}>
                      {armorAnalysis.helmet.tier.toUpperCase()}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Protection</span>
                    <div className="stat-track">
                      <div className="stat-fill" style={{
                        width: `${armorAnalysis.helmet.reduction * 200}%`,
                        background: TIER_COLORS[armorAnalysis.helmet.tier]
                      }} />
                    </div>
                    <span className="stat-val">{Math.round(armorAnalysis.helmet.reduction * 100)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Durability</span>
                    <div className="stat-track">
                      <div className="stat-fill" style={{
                        width: `${(armorAnalysis.helmet.durability / 170) * 100}%`,
                        background: '#64748b'
                      }} />
                    </div>
                    <span className="stat-val">{armorAnalysis.helmet.durability}</span>
                  </div>
                </div>
              )}

              {/* Body Armor */}
              {armorAnalysis.body && armorAnalysis.body.tier !== 'none' && (
                <div className="armor-row">
                  <div className="armor-icon-label">
                    <Shield size={14} style={{ color: TIER_COLORS[armorAnalysis.body.tier] }} />
                    <span className="armor-name">Body</span>
                    <span className="armor-tier" style={{ color: TIER_COLORS[armorAnalysis.body.tier] }}>
                      {armorAnalysis.body.tier.toUpperCase()}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Protection</span>
                    <div className="stat-track">
                      <div className="stat-fill" style={{
                        width: `${armorAnalysis.body.reduction * 200}%`,
                        background: TIER_COLORS[armorAnalysis.body.tier]
                      }} />
                    </div>
                    <span className="stat-val">{Math.round(armorAnalysis.body.reduction * 100)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Durability</span>
                    <div className="stat-track">
                      <div className="stat-fill" style={{
                        width: `${(armorAnalysis.body.durability / 220) * 100}%`,
                        background: '#64748b'
                      }} />
                    </div>
                    <span className="stat-val">{armorAnalysis.body.durability}</span>
                  </div>
                </div>
              )}

              {/* Total reduction */}
              <div className="armor-total">
                Total Damage Reduction: <strong>{Math.round(armorAnalysis.totalReduction * 100)}%</strong>
              </div>
            </div>
          )}

          <h3 className="panel-label">YOUR NAME</h3>
          <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter name..." className="forge-input" maxLength={12} data-testid="player-name-input" />

          <h3 className="panel-label">WEAPON NAME</h3>
          <input type="text" value={weaponName} onChange={e => setWeaponName(e.target.value)}
            placeholder="Name this weapon..." className="forge-input" maxLength={16} data-testid="weapon-name-input" />

          <h3 className="panel-label">ELEMENT</h3>
          <div className="element-selector">
            <button className={`element-btn fire ${element === 'fire' ? 'active' : ''}`}
              onClick={() => setElement('fire')} data-testid="element-fire-btn"><Flame size={18} /> Fire</button>
            <button className={`element-btn water ${element === 'water' ? 'active' : ''}`}
              onClick={() => setElement('water')} data-testid="element-water-btn"><Droplets size={18} /> Water</button>
          </div>

          <button className="save-btn" onClick={handleSave}
            disabled={!weaponName.trim() || !analysis || getSkills().length >= 8}
            data-testid="save-weapon-btn"><Save size={16} /> Save to Skills ({getSkills().length}/8)</button>

          {saved && (
            <button className="arena-btn" onClick={onEnterArena} data-testid="enter-arena-btn">
              <Swords size={16} /> Enter Arena
            </button>
          )}
          {pendingRoom && <p className="pending-room-text">Room {pendingRoom} waiting...</p>}
        </div>
      </div>

      {/* Skills Panel */}
      <SkillsPanel key={ver} onEquip={() => { setSaved(true); setVer(v => v + 1); }} />
    </div>
  );
}
