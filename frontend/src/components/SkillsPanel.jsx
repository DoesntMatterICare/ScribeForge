import { useState } from 'react';
import { Trash2, Zap } from 'lucide-react';
import { getSkills, deleteSkill, equipSkill, getEquippedIndex } from '../lib/storage';

export default function SkillsPanel({ onEquip }) {
  const [ver, setVer] = useState(0);
  const skills = getSkills();
  const equipped = getEquippedIndex();

  const handleEquip = (i) => {
    equipSkill(i);
    onEquip?.(skills[i]);
    setVer(v => v + 1);
  };
  const handleDelete = (i, e) => {
    e.stopPropagation();
    deleteSkill(i);
    setVer(v => v + 1);
  };

  return (
    <div className="skills-panel" data-testid="skills-panel">
      <h3 className="panel-label">SAVED WEAPONS ({skills.length}/8)</h3>
      <div className="skills-grid" data-testid="skills-grid">
        {skills.map((s, i) => {
          // Support both old format (physics.speed/power/reach) and new (statBars.*)
          const bars = s.statBars || {
            power: s.physics?.power || 0,
            speed: s.physics?.speed || 0,
            reach: s.physics?.reach || 0,
            parry: s.physics?.parry || 0,
            chaos: s.physics?.chaos || 0,
          };
          const special = s.special;

          return (
            <div key={`${i}-${ver}`} className={`skill-slot ${equipped === i ? 'equipped' : ''}`}
              data-testid={`skill-slot-${i}`} onClick={() => handleEquip(i)}>
              {s.thumbnail && <img src={s.thumbnail} alt="" className="skill-thumb" />}
              <div className="skill-info">
                <span className="skill-name">{s.name}</span>
                <div className="skill-bars">
                  {[
                    ['PWR', bars.power, 'power'],
                    ['SPD', bars.speed, 'speed'],
                    ['RCH', bars.reach, 'reach'],
                    ['PRY', bars.parry, 'parry'],
                    ['CHS', bars.chaos, 'chaos'],
                  ].map(([label, val, cls]) => (
                    <div className="stat-bar" key={label}>
                      <span>{label}</span>
                      <div className="bar-bg"><div className={`bar-fill ${cls}`} style={{ width: `${(val || 0) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
                {special && <span className="skill-special"><Zap size={10} /> {special.name}</span>}
                {s.dominantType && s.dominantType !== 'raw' && (
                  <span className="skill-dmg-type">{s.dominantType.toUpperCase()}</span>
                )}
              </div>
              <button className="skill-delete" data-testid={`skill-delete-${i}`} onClick={(e) => handleDelete(i, e)}>
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, 8 - skills.length) }).map((_, i) => (
          <div key={`e-${i}`} className="skill-slot empty"><span className="empty-label">EMPTY</span></div>
        ))}
      </div>
    </div>
  );
}
