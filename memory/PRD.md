# ScribFight - PRD

## Problem Statement
Browser-based P2P multiplayer 2D fighting game with Shadow Fight-style combat, custom weapon creation, and modern UI.

## Architecture
- **Frontend**: React (CRA) + Phaser 4 + Matter.js + Trystero (Nostr)
- **Backend**: FastAPI (minimal - health check only)
- **Storage**: localStorage
- **Networking**: P2P WebRTC via Trystero/Nostr

## What's Been Implemented

### Phase 1: The Forge (Complete)
- [x] Free-draw single-stroke weapon editor (StrokeCanvas)
- [x] Full Geometry to Physics Mapping System (Steps 0-9)
  - PCA orientation normalization, RDP simplification, grip detection
  - Raw metrics, normalization, weapon properties (mass, inertia, speed, reach, etc.)
  - 7 special moves, 5 stat bars, hitbox construction
- [x] Weapon saving with name, element, full physics data
- [x] Modern UI: glass-morphism, gradient buttons, Outfit font

### Phase 2: Arena & Combat (Complete)
- [x] Shadow Fight-style Arena with muscular humanoid silhouette characters
- [x] Articulated body system (head, torso, shoulders, arms, legs with joints)
- [x] 15+ attack types: light/heavy/kick/crouch/aerial + combos
- [x] Block + parry system
- [x] AI training dummy
- [x] Fire DOT / Water knockback elements
- [x] Combo system with damage multiplier
- [x] Atmospheric background: gradient sky, layered mountains

### Phase 3: Combat Overhaul (Complete - 2026-04-21)
- [x] **Stamina system**: 100 max, depletes on attacks/dodge/block, regens 12/sec
- [x] **Dodge/Roll**: double-tap A/D, 350ms duration, 250ms i-frames, costs 20 stamina
- [x] **Chip damage**: 20% bleeds through block
- [x] **Knockdowns**: heavy attacks (>=16 baseDmg) cause knockdown with floor bounce + recovery
- [x] **Best of 3 rounds**: round win tracking, round reset with countdown, "ROUND N" text
- [x] **KO cinematic**: slow-mo (0.25x), camera shake + zoom, "K.O." text, screen flash
- [x] **Win streaks**: tracked in localStorage, displayed on match result
- [x] **Weapon durability**: degrades passively (1.5/s) + faster on hits (5 per hit, 3 per block)
- [x] **Mid-fight weapon reforge**: React overlay on weapon break, draw new or pick saved, 7s timer, bare-handed fallback
- [x] **Enhanced visual effects**: 2x particle counts, screen shake scaled to damage, impact flashes on big hits
- [x] **HUD overhaul**: HP + Stamina + Durability bars, Special CD, Round win dots, 60s round timer

### Lobby & Networking
- [x] Host Game, Join Game, Practice Mode
- [x] Trystero/Nostr P2P networking
- [x] Room code system

## Code Architecture
```
/app/
├── backend/
│   └── server.py (health check)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── StrokeCanvas.jsx (weapon drawing)
│   │   │   ├── TheForge.jsx (weapon creation screen)
│   │   │   ├── SkillsPanel.jsx (saved weapons)
│   │   │   ├── TheArena.jsx (arena wrapper + reforge overlay)
│   │   │   ├── Lobby.jsx (game mode selection)
│   │   │   └── TournamentBracket.jsx
│   │   ├── game/
│   │   │   └── ArenaScene.js (~800 lines - full Phaser combat scene)
│   │   ├── lib/
│   │   │   ├── weaponGeometry.js (math/physics)
│   │   │   ├── storage.js (localStorage)
│   │   │   ├── networking.js (P2P)
│   │   │   └── utils.js
│   │   ├── App.js, App.css, index.js
```

## Next Tasks (Prioritized)
1. **P1**: Sound effects (attacks, hits, victory, KO, weapon break)
2. **P1**: Tournament bracket flow integration
3. **P2**: More attack types (grab, throw, counter)
4. **P2**: Character customization (fighting styles)
5. **P3**: Spectator mode for multiplayer
6. **P3**: Leaderboard / ranking system
