// ═══════════════════════════════════════════════════════════════════════
// P1SpriteRenderer v2 — Progress-Driven Pixel Art Sprite System
//
// Key improvement: Instead of letting Phaser auto-advance frames
// at a fixed fps (which desyncs from game timing), action animations
// are driven by the game's own progress values (swingProgress,
// dodgeTimer, kdTimer, hitStun). This keeps sprites perfectly in
// sync with gameplay, eliminating the "robotic" snap-to-idle feel.
// ═══════════════════════════════════════════════════════════════════════

const SPRITE_BASE = '/assets/sprites/p1/';

// ═══════ SPRITESHEET LOADING CONFIG ═══════
const SHEETS = {
  idle:       { file: 'idle.png',                fw: 600, fh: 600 },
  walkFwd:    { file: 'walk_foward.png',         fw: 600, fh: 600 },
  walkBck:    { file: 'walk_backward.png',       fw: 600, fh: 600 },
  normalRun:  { file: 'normal_run.png',          fw: 600, fh: 600 },
  jump:       { file: 'jump.png',                fw: 600, fh: 600 },
  fwdJump:    { file: 'foward_jump.png',         fw: 600, fh: 600 },
  bckJump:    { file: 'backward_jump.png',       fw: 600, fh: 600 },
  block:      { file: 'stand_block.png',         fw: 600, fh: 600 },
  crouch:     { file: 'crouch-0.png',            fw: 600, fh: 600 },
  crouchExt:  { file: 'crouch-1.png',            fw: 600, fh: 600 },
  lightPunch: { file: 'light_punch.png',         fw: 600, fh: 600 },
  medPunch:   { file: 'medium_punch.png',        fw: 600, fh: 600 },
  highPunch:  { file: 'high_punch.png',          fw: 600, fh: 600 },
  highKick:   { file: 'stand_high_kick.png',     fw: 610, fh: 600 },
  jumpKick:   { file: 'jump_kick.png',           fw: 600, fh: 600 },
  bodyHit:    { file: 'body_hit.png',            fw: 600, fh: 600 },
  headHit:    { file: 'head_hit.png',            fw: 600, fh: 600 },
  knockdown:  { file: 'knockdown.png',           fw: 600, fh: 600 },
  kdRecover:  { file: 'knockdown_recovery.png',  fw: 600, fh: 600 },
  dash:       { file: 'dash.png',                fw: 600, fh: 600 },
  roll:       { file: 'rolling_foward-0.png',    fw: 600, fh: 600 },
  stunned:    { file: 'stunned.png',             fw: 600, fh: 600 },
  fire:       { file: 'fire.png',                fw: 600, fh: 600 },
  knockStun:  { file: 'knock_to_stun.png',       fw: 600, fh: 600 },
};

// ═══════ ANIMATION DEFINITIONS ═══════
// Autoplay anims: { sheet, start, end, rate, repeat }
// Progress-driven anims: same shape but rate/repeat are ignored during manual control
const ANIMS = {
  // ─── LOOPING (Phaser autoplay) ───
  idle:         { sheet: 'idle',       start: 0,  end: 29, rate: 14,  repeat: -1 },
  walkFwd:      { sheet: 'walkFwd',    start: 0,  end: 14, rate: 14,  repeat: -1 },
  walkBck:      { sheet: 'walkBck',    start: 0,  end: 14, rate: 14,  repeat: -1 },
  normalRun:    { sheet: 'normalRun',  start: 0,  end: 19, rate: 18,  repeat: -1 },
  stunned:      { sheet: 'stunned',    start: 0,  end: 19, rate: 10,  repeat: -1 },

  // ─── BLOCK (play once then hold last frame) ───
  blockEnter:   { sheet: 'block',      start: 0,  end: 4,  rate: 20,  repeat: 0 },

  // ─── CROUCH (play once then hold) ───
  crouchEnter:  { sheet: 'crouch',     start: 0,  end: 2,  rate: 14,  repeat: 0 },

  // ─── ATTACKS (progress-driven via swingProgress) ───
  lightPunch:   { sheet: 'lightPunch', start: 0,  end: 19 },
  medPunch:     { sheet: 'medPunch',   start: 0,  end: 19 },
  highPunch:    { sheet: 'highPunch',  start: 0,  end: 19 },
  highKick:     { sheet: 'highKick',   start: 0,  end: 19 },
  jumpKick:     { sheet: 'jumpKick',   start: 0,  end: 29 },
  fire:         { sheet: 'fire',       start: 0,  end: 29 },

  // ─── CROUCH ATTACKS (progress-driven, sub-ranges of crouch-0 / crouch-1) ───
  crouchPunch:  { sheet: 'crouch',     start: 3,  end: 17 },  // 15 frames in crouch-0
  crouchKick:   { sheet: 'crouchExt',  start: 7,  end: 17 },  // ~11 frames in crouch-1
  crouchBlock:  { sheet: 'crouch',     start: 18, end: 22 },  // 5 frames in crouch-0

  // ─── DASH (progress-driven via dodgeTimer) ───
  dashFwd:      { sheet: 'dash',       start: 10, end: 24 },  // fwd = frames 10-24
  dashBck:      { sheet: 'dash',       start: 0,  end: 9  },  // bck = frames 0-9
  roll:         { sheet: 'roll',       start: 0,  end: 35 },

  // ─── JUMP (progress-driven via vy/jump arc) ───
  jump:         { sheet: 'jump',       start: 0,  end: 29 },
  fwdJump:      { sheet: 'fwdJump',    start: 0,  end: 29 },
  bckJump:      { sheet: 'bckJump',    start: 0,  end: 25 },

  // ─── HIT REACTIONS (progress-driven via hitStun) ───
  bodyHit:      { sheet: 'bodyHit',    start: 0,  end: 9  },
  headHit:      { sheet: 'headHit',    start: 0,  end: 9  },
  crouchHit:    { sheet: 'crouch',     start: 33, end: 35 },  // first 3 in crouch-0

  // ─── KNOCKDOWN (progress-driven via kdTimer) ───
  knockdown:    { sheet: 'knockdown',  start: 0,  end: 26 },
  kdRecover:    { sheet: 'kdRecover',  start: 0,  end: 34 },
  knockStun:    { sheet: 'knockStun',  start: 0,  end: 19 },
};

// ═══════ ATTACK → SPRITE ANIMATION MAP ═══════
const ATK_ANIM_MAP = {
  // Light attacks
  jab:              'lightPunch',
  crouchJab:        'crouchPunch',
  counterStrike:    'lightPunch',
  special_ricochet: 'lightPunch',

  // Medium attacks
  slash:            'medPunch',
  dblSlash:         'medPunch',
  special_serrate:  'medPunch',

  // Heavy attacks
  strongPunch:      'highPunch',
  heavySlash:       'highPunch',
  uppercut:         'highPunch',
  grab:             'highPunch',
  special_crush:    'highPunch',
  special_shockwave:'highPunch',
  special_overpower:'highPunch',

  // Kicks
  highKick:         'highKick',
  frontKick:        'highKick',
  backKick:         'highKick',
  lowSweep:         'crouchKick',
  spinJumpKick:     'jumpKick',
  jumpKick:         'jumpKick',

  // Aerial / dash
  aerSlash:         'jumpKick',
  dashStrike:       'dashFwd',

  // Specials
  special_lunge:    'dashFwd',
  special_whirlwind:'fire',
};

// ═══════ SPRITE POSITIONING ═══════
const SPRITE_SCALE = 0.42;
const ORIGIN_X = 0.527;
const ORIGIN_Y = 0.88;
const FRAME_OX = ORIGIN_X * 600;  // 316.2
const FRAME_OY = ORIGIN_Y * 600;  // 528

// ═══════ HAND ANCHOR POSITIONS (frame coordinates) ═══════
const HAND_ANCHORS = {
  idle:         { x: 402, y: 336 },
  walkFwd:      { x: 410, y: 336 },
  walkBck:      { x: 395, y: 336 },
  normalRun:    { x: 410, y: 330 },
  jump:         { x: 400, y: 320 },
  fwdJump:      { x: 410, y: 310 },
  bckJump:      { x: 390, y: 320 },
  blockEnter:   { x: 420, y: 270 },
  crouchEnter:  { x: 420, y: 370 },
  crouchPunch:  { x: 460, y: 350 },
  crouchKick:   { x: 420, y: 400 },
  crouchBlock:  { x: 420, y: 340 },
  crouchHit:    { x: 400, y: 370 },
  lightPunch:   { x: 460, y: 275 },
  medPunch:     { x: 430, y: 290 },
  highPunch:    { x: 480, y: 265 },
  highKick:     { x: 400, y: 340 },
  jumpKick:     { x: 460, y: 280 },
  bodyHit:      { x: 400, y: 325 },
  headHit:      { x: 395, y: 320 },
  knockdown:    { x: 430, y: 400 },
  kdRecover:    { x: 400, y: 370 },
  knockStun:    { x: 380, y: 350 },
  dashFwd:      { x: 420, y: 350 },
  dashBck:      { x: 380, y: 340 },
  roll:         { x: 450, y: 340 },
  stunned:      { x: 370, y: 365 },
  fire:         { x: 370, y: 310 },
};

// Jump physics constants (must match ArenaScene)
const JUMP_VY = -12.5;
const GRAVITY = 0.55;

// Dodge duration (must match ArenaScene)
const DODGE_DUR = 350;

// Knockdown timing (must match ArenaScene)
const KD_TIME = 900;
const KD_RECOVER = 500;

// Landing mini-state duration (ms)
const LANDING_DURATION = 120;


export default class P1SpriteRenderer {
  constructor(scene) {
    this.scene = scene;
    this.sprite = null;
    this.currentAnim = '';
    this.currentSheet = '';
    this.ready = false;

    // State tracking for smooth transitions
    this.wasAirborne = false;
    this.landingTimer = 0;
    this.lastHitType = 'body';       // 'body' or 'head' for alternating hit reactions
    this.blockHeld = false;          // track block hold state
    this.crouchHeld = false;         // track crouch hold state
    this.manualFrame = false;        // are we manually controlling the frame?
  }

  /** Call in scene.preload() */
  preload() {
    for (const [key, cfg] of Object.entries(SHEETS)) {
      this.scene.load.spritesheet(`p1_${key}`, `${SPRITE_BASE}${cfg.file}`, {
        frameWidth: cfg.fw,
        frameHeight: cfg.fh,
      });
    }
  }

  /** Call in scene.create() after preload completes */
  createAnimations() {
    for (const [animKey, cfg] of Object.entries(ANIMS)) {
      const sheetKey = `p1_${cfg.sheet}`;
      const animFullKey = `p1_${animKey}`;
      if (this.scene.textures.exists(sheetKey) && !this.scene.anims.exists(animFullKey)) {
        // Only create Phaser animation objects for autoplay anims (those with rate & repeat)
        if (cfg.rate !== undefined) {
          this.scene.anims.create({
            key: animFullKey,
            frames: this.scene.anims.generateFrameNumbers(sheetKey, {
              start: cfg.start,
              end: cfg.end,
            }),
            frameRate: cfg.rate,
            repeat: cfg.repeat,
          });
        }
      }
    }
  }

  /** Create the P1 sprite at initial position */
  createSprite(x, y) {
    this.sprite = this.scene.add.sprite(x, y, 'p1_idle', 0)
      .setOrigin(ORIGIN_X, ORIGIN_Y)
      .setScale(SPRITE_SCALE)
      .setDepth(10);
    this.currentAnim = '';
    this.currentSheet = '';
    this.ready = true;
  }

  // ─────────────────────────────────────────────────
  // MANUAL FRAME CONTROL
  // Sets the sprite texture + frame directly for
  // progress-driven animations
  // ─────────────────────────────────────────────────
  setManualFrame(animKey, progress01) {
    const cfg = ANIMS[animKey];
    if (!cfg) return;

    const sheetKey = `p1_${cfg.sheet}`;
    const totalFrames = cfg.end - cfg.start;
    const frameIdx = cfg.start + Math.min(Math.floor(progress01 * (totalFrames + 1)), totalFrames);

    // Stop autoplay if active
    if (!this.manualFrame) {
      this.sprite.anims.stop();
      this.manualFrame = true;
    }

    // Switch sheet if needed
    if (this.currentSheet !== sheetKey) {
      this.sprite.setTexture(sheetKey, frameIdx);
      this.currentSheet = sheetKey;
    } else {
      this.sprite.setFrame(frameIdx);
    }

    this.currentAnim = animKey;
  }

  // ─────────────────────────────────────────────────
  // AUTOPLAY CONTROL
  // Uses Phaser's built-in animation player for loops
  // ─────────────────────────────────────────────────
  playAutoAnim(animKey) {
    if (this.currentAnim === animKey && !this.manualFrame) return;

    const fullKey = `p1_${animKey}`;
    if (this.scene.anims.exists(fullKey)) {
      this.manualFrame = false;
      this.sprite.play(fullKey, true);
      this.currentAnim = animKey;
      this.currentSheet = `p1_${ANIMS[animKey]?.sheet || 'idle'}`;
    }
  }

  // ─────────────────────────────────────────────────
  // HOLD FRAME (play animation once, freeze on last)
  // ─────────────────────────────────────────────────
  playOnceAndHold(animKey, held) {
    if (!held) {
      // First entry: play the animation
      const fullKey = `p1_${animKey}`;
      if (this.scene.anims.exists(fullKey)) {
        this.manualFrame = false;
        this.sprite.play(fullKey, true);
        this.currentAnim = animKey;
        this.currentSheet = `p1_${ANIMS[animKey]?.sheet || 'idle'}`;
      }
      return true; // now held
    }
    // Already held: Phaser will stop on last frame (repeat: 0)
    return true;
  }

  // ─────────────────────────────────────────────────
  // MAIN UPDATE — called every frame
  // ─────────────────────────────────────────────────
  update(f, dt) {
    if (!this.ready || !this.sprite) return;

    // Landing detection
    if (this.wasAirborne && f.grounded) {
      this.landingTimer = LANDING_DURATION;
    }
    this.wasAirborne = !f.grounded;
    if (this.landingTimer > 0) this.landingTimer -= (dt || 16);

    // ════════ STATE MACHINE (priority order) ════════

    // 1. DEATH
    if (f.hp <= 0) {
      this.setManualFrame('knockdown', 1.0); // hold last frame
      this._updateTransform(f);
      return;
    }

    // 2. KNOCKDOWN / RECOVERY
    if (f.knockedDown) {
      if (f.kdRecovering) {
        // Recovery: drive frames by recovery progress
        const recoverProgress = 1 - Math.max(0, f.kdTimer / KD_RECOVER);
        this.setManualFrame('kdRecover', Math.min(recoverProgress, 1));
      } else {
        // Falling: drive by knockdown progress
        const kdProgress = 1 - Math.max(0, (f.kdTimer - KD_RECOVER) / KD_TIME);
        this.setManualFrame('knockdown', Math.min(Math.max(kdProgress, 0), 1));
      }
      this._updateTransform(f);
      return;
    }

    // 3. STUN
    if (f.stunTimer > 0 && !f.attacking) {
      this.playAutoAnim('stunned');
      this.blockHeld = false;
      this.crouchHeld = false;
      this._updateTransform(f);
      return;
    }

    // 4. HIT REACTION
    if (f.hitStun > 0 && !f.attacking && !f.knockedDown) {
      // Alternate between body and head hit for variety
      const hitAnim = f.crouching ? 'crouchHit' :
                      (this.lastHitType === 'body' ? 'bodyHit' : 'headHit');
      // Drive frames by hitStun progress (hitStun counts DOWN)
      // Estimate original hitStun duration (typically 100-500ms)
      const maxHitStun = 400;
      const progress = 1 - Math.min(f.hitStun / maxHitStun, 1);
      this.setManualFrame(hitAnim, progress);
      this.blockHeld = false;
      this.crouchHeld = false;
      this._updateTransform(f);
      return;
    }

    // 5. ATTACKING
    if (f.attacking && f.currentAtk) {
      let atkAnim = ATK_ANIM_MAP[f.currentAtk] || 'medPunch';

      // Crouch attack override
      if (f.crouching && f.currentAtk === 'crouchJab') atkAnim = 'crouchPunch';
      if (f.crouching && f.currentAtk === 'lowSweep') atkAnim = 'crouchKick';

      // Use swingProgress (0→1) to drive the sprite frame
      const progress = f.swingProgress || 0;
      this.setManualFrame(atkAnim, progress);
      this.blockHeld = false;
      this.crouchHeld = false;
      this._updateTransform(f);
      return;
    }

    // 6. DODGE
    if (f.dodging) {
      const dodgeProgress = 1 - Math.max(0, f.dodgeTimer / DODGE_DUR);
      // Determine direction
      const dir = f.facingRight ? 1 : -1;
      const fwd = (f.dodgeDir * dir) > 0;
      const dodgeAnim = fwd ? 'roll' : 'dashBck';
      this.setManualFrame(dodgeAnim, Math.min(dodgeProgress, 1));
      this.blockHeld = false;
      this.crouchHeld = false;
      this._updateTransform(f);
      return;
    }

    // 7. BLOCKING
    if (f.blocking) {
      if (f.crouching) {
        // Crouch block: manually hold a crouch block frame
        this.setManualFrame('crouchBlock', 0.5);
      } else {
        // Stand block: play entry once, then hold last frame
        this.blockHeld = this.playOnceAndHold('blockEnter', this.blockHeld);
      }
      this.crouchHeld = false;
      this._updateTransform(f);
      return;
    }
    this.blockHeld = false;

    // 8. CROUCHING
    if (f.crouching) {
      this.crouchHeld = this.playOnceAndHold('crouchEnter', this.crouchHeld);
      this._updateTransform(f);
      return;
    }
    this.crouchHeld = false;

    // 9. AIRBORNE (jump)
    if (!f.grounded) {
      // Drive jump frame by vertical velocity / arc position
      // vy goes from JUMP_VY (negative, ascending) to positive (descending)
      // Normalize to 0-1: 0=launch, 0.5=peak, 1=about to land
      const jumpRange = Math.abs(JUMP_VY) * 2; // total vy swing
      const jumpProgress = Math.min(Math.max((f.vy - JUMP_VY) / jumpRange, 0), 1);

      let jumpAnim = 'jump';
      if (f.facingRight ? f.vx > 2 : f.vx < -2) jumpAnim = 'fwdJump';
      else if (f.facingRight ? f.vx < -2 : f.vx > 2) jumpAnim = 'bckJump';

      this.setManualFrame(jumpAnim, jumpProgress);
      this._updateTransform(f);
      return;
    }

    // 10. LANDING (brief transition before idle/walk)
    if (this.landingTimer > 0) {
      // Show the last few frames of the jump animation (landing portion)
      this.setManualFrame('jump', 0.85 + (1 - this.landingTimer / LANDING_DURATION) * 0.15);
      this._updateTransform(f);
      return;
    }

    // 11. WALKING / RUNNING
    if (Math.abs(f.vx) > 0.5 && f.grounded) {
      const movingFwd = (f.facingRight && f.vx > 0) || (!f.facingRight && f.vx < 0);
      // Use run animation for faster movement (dash speed remnant, etc.)
      if (Math.abs(f.vx) > 5) {
        this.playAutoAnim('normalRun');
      } else {
        this.playAutoAnim(movingFwd ? 'walkFwd' : 'walkBck');
      }
      this._updateTransform(f);
      return;
    }

    // 12. IDLE (default)
    this.playAutoAnim('idle');
    this._updateTransform(f);
  }

  // ─────────────────────────────────────────────────
  // TRANSFORM UPDATE (position, flip, alpha)
  // ─────────────────────────────────────────────────
  _updateTransform(f) {
    this.sprite.setPosition(f.x, f.y);
    this.sprite.setFlipX(!f.facingRight);

    // Alpha effects
    const dodgeA = f.dodging ? (0.3 + Math.sin(Date.now() * 0.03) * 0.2) : 1;
    const kdA    = f.knockedDown ? (0.6 + Math.sin(Date.now() * 0.015) * 0.15) : 1;
    const invA   = f.kdInvuln > 0 ? (0.5 + Math.sin(Date.now() * 0.04) * 0.3) : 1;
    this.sprite.setAlpha(Math.min(dodgeA, kdA, invA));

    // HitStop freeze
    if (f.hitStop > 0) {
      if (!this.sprite.anims.isPaused && !this.manualFrame) {
        this.sprite.anims.pause();
      }
    } else {
      if (this.sprite.anims.isPaused && !this.manualFrame) {
        this.sprite.anims.resume();
      }
    }
  }

  /** Returns hand position in world-space for weapon overlay */
  getHandWorldPos(f) {
    const anchor = HAND_ANCHORS[this.currentAnim] || HAND_ANCHORS.idle;
    const dir = f.facingRight ? 1 : -1;
    return {
      x: f.x + (anchor.x - FRAME_OX) * SPRITE_SCALE * dir,
      y: f.y + (anchor.y - FRAME_OY) * SPRITE_SCALE,
    };
  }

  /** Called when a hit lands — toggles hit reaction type for next time */
  registerHit(hitJoint) {
    // Alternate between body/head based on which joint was hit
    this.lastHitType = (hitJoint === 'rFt' || this.lastHitType === 'head') ? 'body' : 'head';
  }

  /** Reset for new round */
  reset(x, y) {
    if (!this.sprite) return;
    this.currentAnim = '';
    this.currentSheet = '';
    this.manualFrame = false;
    this.blockHeld = false;
    this.crouchHeld = false;
    this.landingTimer = 0;
    this.wasAirborne = false;
    this.sprite.setPosition(x, y);
    this.sprite.setAlpha(1);
    this.playAutoAnim('idle');
  }

  destroy() {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
    this.ready = false;
    this.currentAnim = '';
  }
}
