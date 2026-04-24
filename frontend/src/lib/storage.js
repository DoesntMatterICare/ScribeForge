const WEAPON_KEY = 'forge_weapon';
const PLAYER_KEY = 'forge_player';
const SKILLS_KEY = 'forge_skills';
const EQUIPPED_KEY = 'forge_equipped';
const ARMOR_KEY = 'forge_armor';

export function saveWeapon(data) { localStorage.setItem(WEAPON_KEY, JSON.stringify(data)); }
export function getWeapon() { try { return JSON.parse(localStorage.getItem(WEAPON_KEY)); } catch { return null; } }
export function clearWeapon() { localStorage.removeItem(WEAPON_KEY); }
export function savePlayerName(n) { localStorage.setItem(PLAYER_KEY, n); }
export function getPlayerName() { return localStorage.getItem(PLAYER_KEY) || 'Fighter'; }

export function getSkills() { try { return JSON.parse(localStorage.getItem(SKILLS_KEY)) || []; } catch { return []; } }

export function saveSkill(data) {
  const skills = getSkills();
  if (skills.length >= 8) return false;
  skills.push(data);
  localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
  saveWeapon(data);
  equipSkill(skills.length - 1);
  return true;
}

export function deleteSkill(idx) {
  const skills = getSkills();
  skills.splice(idx, 1);
  localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
  const eq = getEquippedIndex();
  if (eq === idx) localStorage.removeItem(EQUIPPED_KEY);
  else if (eq > idx) localStorage.setItem(EQUIPPED_KEY, String(eq - 1));
}

export function equipSkill(idx) {
  const skills = getSkills();
  if (idx >= 0 && idx < skills.length) {
    localStorage.setItem(EQUIPPED_KEY, String(idx));
    saveWeapon(skills[idx]);
  }
}

export function getEquippedIndex() {
  const v = localStorage.getItem(EQUIPPED_KEY);
  return v !== null ? parseInt(v) : -1;
}

// ═══════ ARMOR ═══════
export function saveArmor(data) { localStorage.setItem(ARMOR_KEY, JSON.stringify(data)); }
export function getArmor() { try { return JSON.parse(localStorage.getItem(ARMOR_KEY)); } catch { return null; } }
export function clearArmor() { localStorage.removeItem(ARMOR_KEY); localStorage.removeItem(ARMOR_KEY + '_img'); }
export function saveArmorImage(dataUrl) { localStorage.setItem(ARMOR_KEY + '_img', dataUrl); }
export function getArmorImage() { return localStorage.getItem(ARMOR_KEY + '_img') || null; }
