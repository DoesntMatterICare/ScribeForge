import * as Phaser from 'phaser';
import { normalizeVertices } from '../lib/weaponGeometry';
import P1SpriteRenderer from './P1SpriteRenderer';
import SoundFX from './SoundFX';

// ═══════ CORE CONSTANTS ═══════
const W=1200,H=600,FLOOR=470,GRAV=0.55,SPD=3.5,JUMP=-12.5,S=1.55;
const COMBO_WIN=500,PARRY_WIN=200,SPECIAL_CD=8000;

// ═══════ COMBAT CONSTANTS ═══════
const MAX_STAMINA=100,STAM_REGEN=12,STAM_BLOCK_DRAIN=6;
const DODGE_COST=20,DODGE_DUR=350,DODGE_IFRAMES=250,DODGE_SPD=9,DBL_TAP_WIN=300;
const SPRITE_SCALE_VIS=1.55; // visual scale for armor overlay on sprite
const CHIP_MULT=0.2;
const KD_DMG_THRESH=16,KD_TIME=900,KD_RECOVER=500;
const MAX_DUR=100,DUR_PASSIVE=1.5,DUR_ON_HIT=5,DUR_ON_BLOCK=3;
const BARE_DMG=0.6,REFORGE_TIME=7000;
const ROUNDS_WIN=2,ROUND_TIME=60,ROUND_TRANS=3000;
const KO_SLOWMO=0.25,KO_SLOWMO_DUR=2500;

// ═══════ HELPERS ═══════
function lerp(a,b,t){return a+(b-a)*t}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))}
function lerpPose(c,tg,t){const r={};for(const k in tg)r[k]=c[k]?{x:lerp(c[k].x,tg[k].x,t),y:lerp(c[k].y,tg[k].y,t)}:{...tg[k]};return r}
function easeOutQuad(t){return t*(2-t)}
function easeInCubic(t){return t*t*t}

// ═══════ MUSCULAR BODY RENDERING ═══════
function taperedLimb(g,x1,y1,x2,y2,w1,w2){
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;
  const nx=-dy/len,ny=dx/len;
  const bw=Math.max(w1,w2)*0.13;
  g.beginPath();
  g.moveTo(x1+nx*w1/2,y1+ny*w1/2);
  g.lineTo((x1+x2)/2+nx*(w1+w2)*0.28+nx*bw,(y1+y2)/2+ny*(w1+w2)*0.28+ny*bw);
  g.lineTo(x2+nx*w2/2,y2+ny*w2/2);
  g.lineTo(x2-nx*w2/2,y2-ny*w2/2);
  g.lineTo((x1+x2)/2-nx*(w1+w2)*0.28-nx*bw,(y1+y2)/2-ny*(w1+w2)*0.28-ny*bw);
  g.lineTo(x1-nx*w1/2,y1+ny*w1/2);
  g.closePath();g.fillPath();
}
function torso(g,lSh,rSh,lHip,rHip){
  const sw=4*S;
  g.beginPath();g.moveTo(lSh.x-sw,lSh.y);g.lineTo(rSh.x+sw,rSh.y);
  g.lineTo(rHip.x+2*S,rHip.y);g.lineTo(lHip.x-2*S,lHip.y);g.closePath();g.fillPath();
}
function fist(g,x,y,sz){g.fillRoundedRect(x-sz*0.7,y-sz*0.6,sz*1.4,sz*1.2,sz*0.3)}
function foot(g,x,y,sz,dir){g.fillRoundedRect(x-sz*0.3,y-sz*0.35,sz*1.3*dir,sz*0.7,3);g.fillCircle(x,y,sz*0.45)}
function head(g,hx,hy,radius,dir,c,isHit){
  g.fillCircle(hx,hy,radius);
  g.fillRoundedRect(hx-radius*0.6,hy+radius*0.3,radius*1.2,radius*0.5,3);
  g.fillStyle(0x020208);g.fillCircle(hx,hy-radius*0.1,radius*0.75);
  if(!isHit){
    g.fillStyle(c||0x3399ff,0.9);
    g.fillCircle(hx+dir*radius*0.25,hy-radius*0.15,3);
    g.fillCircle(hx+dir*radius*0.55,hy-radius*0.15,3);
    g.fillStyle(c||0x3399ff,0.4);
    g.fillCircle(hx+dir*radius*0.4,hy-radius*0.15,5);
  }else{
    g.lineStyle(2,0xf87171,0.8);
    const ex=hx+dir*radius*0.3,ey=hy-radius*0.15;
    g.lineBetween(ex-3,ey-3,ex+3,ey+3);g.lineBetween(ex-3,ey+3,ex+3,ey-3);
    const ex2=hx+dir*radius*0.55;
    g.lineBetween(ex2-3,ey-3,ex2+3,ey+3);g.lineBetween(ex2-3,ey+3,ex2+3,ey-3);
  }
}

// ═══════════════════════════════════════════════
// POSES — All offsets relative to hip (0,0)
// ═══════════════════════════════════════════════
const P={
  idle1:{chest:{x:4,y:-33},head:{x:5,y:-55},lSh:{x:-14,y:-33},rSh:{x:14,y:-33},lElb:{x:-6,y:-22},lHnd:{x:-2,y:-40},rElb:{x:12,y:-24},rHnd:{x:10,y:-44},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-12,y:18},lFt:{x:-16,y:38},rKne:{x:14,y:15},rFt:{x:18,y:35}},
  idle2:{chest:{x:3,y:-32},head:{x:4,y:-54},lSh:{x:-14,y:-32},rSh:{x:14,y:-32},lElb:{x:-7,y:-21},lHnd:{x:-3,y:-39},rElb:{x:11,y:-23},rHnd:{x:9,y:-43},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-11,y:19},lFt:{x:-15,y:39},rKne:{x:13,y:16},rFt:{x:17,y:36}},
  idle3:{chest:{x:5,y:-34},head:{x:6,y:-56},lSh:{x:-14,y:-34},rSh:{x:14,y:-34},lElb:{x:-5,y:-23},lHnd:{x:-1,y:-41},rElb:{x:13,y:-25},rHnd:{x:11,y:-45},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-13,y:17},lFt:{x:-17,y:37},rKne:{x:15,y:14},rFt:{x:19,y:34}},
  walkF1:{chest:{x:7,y:-32},head:{x:8,y:-54},lSh:{x:-12,y:-32},rSh:{x:14,y:-32},lElb:{x:-18,y:-16},lHnd:{x:-14,y:-24},rElb:{x:20,y:-20},rHnd:{x:24,y:-30},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-18,y:12},lFt:{x:-24,y:32},rKne:{x:20,y:10},rFt:{x:26,y:30}},
  walkF2:{chest:{x:5,y:-31},head:{x:6,y:-53},lSh:{x:-13,y:-31},rSh:{x:13,y:-31},lElb:{x:-8,y:-20},lHnd:{x:-6,y:-28},rElb:{x:10,y:-22},rHnd:{x:14,y:-32},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:18},lFt:{x:-14,y:38},rKne:{x:12,y:16},rFt:{x:16,y:36}},
  walkF3:{chest:{x:7,y:-32},head:{x:8,y:-54},lSh:{x:-13,y:-32},rSh:{x:13,y:-32},lElb:{x:18,y:-20},lHnd:{x:14,y:-30},rElb:{x:-16,y:-16},rHnd:{x:-12,y:-24},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:18,y:10},lFt:{x:24,y:30},rKne:{x:-16,y:12},rFt:{x:-22,y:32}},
  walkF4:{chest:{x:5,y:-31},head:{x:6,y:-53},lSh:{x:-13,y:-31},rSh:{x:13,y:-31},lElb:{x:8,y:-22},lHnd:{x:6,y:-32},rElb:{x:-8,y:-20},rHnd:{x:-6,y:-28},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:10,y:16},lFt:{x:14,y:36},rKne:{x:-10,y:18},rFt:{x:-14,y:38}},
  highKickLift:{chest:{x:-4,y:-34},head:{x:-6,y:-56},lSh:{x:-16,y:-34},rSh:{x:8,y:-34},lElb:{x:-22,y:-24},lHnd:{x:-26,y:-36},rElb:{x:6,y:-28},rHnd:{x:2,y:-40},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-6,y:20},lFt:{x:-10,y:38},rKne:{x:18,y:2},rFt:{x:20,y:14}},
  highKickPeak:{chest:{x:-14,y:-34},head:{x:-16,y:-56},lSh:{x:-22,y:-34},rSh:{x:2,y:-34},lElb:{x:-28,y:-22},lHnd:{x:-32,y:-34},rElb:{x:4,y:-28},rHnd:{x:0,y:-40},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-6,y:20},lFt:{x:-10,y:38},rKne:{x:18,y:-24},rFt:{x:22,y:-50}},
  highKickRecover:{chest:{x:-6,y:-33},head:{x:-8,y:-55},lSh:{x:-16,y:-33},rSh:{x:8,y:-33},lElb:{x:-20,y:-24},lHnd:{x:-22,y:-36},rElb:{x:6,y:-28},rHnd:{x:2,y:-40},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-6,y:20},lFt:{x:-10,y:38},rKne:{x:16,y:4},rFt:{x:18,y:20}},
  frontKickChamber:{chest:{x:-6,y:-34},head:{x:-8,y:-56},lSh:{x:-16,y:-34},rSh:{x:8,y:-34},lElb:{x:-22,y:-24},lHnd:{x:-24,y:-36},rElb:{x:8,y:-28},rHnd:{x:4,y:-40},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-4,y:20},lFt:{x:-8,y:38},rKne:{x:22,y:2},rFt:{x:20,y:10}},
  frontKickPeak:{chest:{x:-10,y:-34},head:{x:-12,y:-56},lSh:{x:-18,y:-34},rSh:{x:6,y:-34},lElb:{x:-24,y:-22},lHnd:{x:-28,y:-34},rElb:{x:6,y:-28},rHnd:{x:2,y:-40},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-4,y:20},lFt:{x:-8,y:38},rKne:{x:34,y:-2},rFt:{x:60,y:-4}},
  frontKickRecover:{chest:{x:-6,y:-33},head:{x:-8,y:-55},lSh:{x:-16,y:-33},rSh:{x:8,y:-33},lElb:{x:-22,y:-24},lHnd:{x:-24,y:-36},rElb:{x:6,y:-28},rHnd:{x:2,y:-40},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-4,y:20},lFt:{x:-8,y:38},rKne:{x:20,y:6},rFt:{x:22,y:22}},
  backKickTurn:{chest:{x:6,y:-32},head:{x:4,y:-54},lSh:{x:12,y:-32},rSh:{x:-8,y:-32},lElb:{x:16,y:-24},lHnd:{x:20,y:-34},rElb:{x:-4,y:-26},rHnd:{x:0,y:-38},lHip:{x:6,y:0},rHip:{x:-6,y:0},lKne:{x:8,y:18},lFt:{x:12,y:36},rKne:{x:-14,y:4},rFt:{x:-18,y:14}},
  backKickPeak:{chest:{x:10,y:-30},head:{x:8,y:-52},lSh:{x:16,y:-30},rSh:{x:-6,y:-30},lElb:{x:20,y:-22},lHnd:{x:24,y:-32},rElb:{x:-2,y:-24},rHnd:{x:2,y:-36},lHip:{x:6,y:0},rHip:{x:-6,y:0},lKne:{x:8,y:18},lFt:{x:12,y:36},rKne:{x:-28,y:-2},rFt:{x:-54,y:-6}},
  backKickRecover:{chest:{x:6,y:-32},head:{x:4,y:-54},lSh:{x:12,y:-32},rSh:{x:-8,y:-32},lElb:{x:16,y:-24},lHnd:{x:20,y:-34},rElb:{x:-4,y:-26},rHnd:{x:0,y:-38},lHip:{x:6,y:0},rHip:{x:-6,y:0},lKne:{x:8,y:18},lFt:{x:12,y:36},rKne:{x:-12,y:6},rFt:{x:-16,y:22}},
  spinJumpWind:{chest:{x:2,y:-32},head:{x:3,y:-54},lSh:{x:-12,y:-32},rSh:{x:12,y:-32},lElb:{x:-18,y:-24},lHnd:{x:-22,y:-34},rElb:{x:16,y:-24},rHnd:{x:20,y:-34},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-14,y:8},lFt:{x:-18,y:22},rKne:{x:16,y:4},rFt:{x:18,y:16}},
  spinJumpPeak:{chest:{x:4,y:-28},head:{x:6,y:-48},lSh:{x:-10,y:-28},rSh:{x:16,y:-28},lElb:{x:-22,y:-18},lHnd:{x:-30,y:-24},rElb:{x:10,y:-22},rHnd:{x:6,y:-32},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-18,y:8},lFt:{x:-26,y:20},rKne:{x:38,y:-14},rFt:{x:62,y:-12}},
  jabWind:{chest:{x:2,y:-33},head:{x:3,y:-55},lSh:{x:-14,y:-33},rSh:{x:14,y:-33},lElb:{x:-6,y:-24},lHnd:{x:-2,y:-40},rElb:{x:16,y:-28},rHnd:{x:18,y:-38},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-12,y:18},lFt:{x:-16,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  jabPeak:{chest:{x:10,y:-31},head:{x:11,y:-53},lSh:{x:-8,y:-31},rSh:{x:16,y:-31},lElb:{x:-4,y:-24},lHnd:{x:-2,y:-38},rElb:{x:32,y:-31},rHnd:{x:54,y:-33},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:18},lFt:{x:-14,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  jabRecover:{chest:{x:6,y:-32},head:{x:7,y:-54},lSh:{x:-12,y:-32},rSh:{x:14,y:-32},lElb:{x:-6,y:-24},lHnd:{x:-2,y:-40},rElb:{x:22,y:-30},rHnd:{x:28,y:-38},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-12,y:18},lFt:{x:-16,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  slashWind:{chest:{x:-4,y:-35},head:{x:-3,y:-57},lSh:{x:-16,y:-35},rSh:{x:10,y:-35},lElb:{x:-12,y:-28},lHnd:{x:-8,y:-42},rElb:{x:6,y:-48},rHnd:{x:2,y:-62},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:18},lFt:{x:-14,y:38},rKne:{x:12,y:16},rFt:{x:16,y:36}},
  slashStrike:{chest:{x:12,y:-30},head:{x:13,y:-52},lSh:{x:-6,y:-30},rSh:{x:16,y:-30},lElb:{x:-8,y:-20},lHnd:{x:-10,y:-28},rElb:{x:30,y:-16},rHnd:{x:48,y:-6},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-6,y:18},lFt:{x:-10,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  slashFollow:{chest:{x:14,y:-28},head:{x:15,y:-50},lSh:{x:-4,y:-28},rSh:{x:18,y:-28},lElb:{x:-8,y:-18},lHnd:{x:-12,y:-26},rElb:{x:28,y:-10},rHnd:{x:42,y:2},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-4,y:18},lFt:{x:-8,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  dblSlash2Wind:{chest:{x:10,y:-30},head:{x:11,y:-52},lSh:{x:-6,y:-30},rSh:{x:16,y:-30},lElb:{x:-8,y:-20},lHnd:{x:-10,y:-28},rElb:{x:26,y:-40},rHnd:{x:30,y:-54},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-6,y:18},lFt:{x:-10,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  dblSlash2Hit:{chest:{x:8,y:-30},head:{x:9,y:-52},lSh:{x:-8,y:-30},rSh:{x:14,y:-30},lElb:{x:-6,y:-22},lHnd:{x:-4,y:-34},rElb:{x:28,y:-18},rHnd:{x:44,y:-10},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-8,y:18},lFt:{x:-12,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  strongPunchWind:{chest:{x:-8,y:-34},head:{x:-7,y:-56},lSh:{x:-18,y:-34},rSh:{x:6,y:-34},lElb:{x:-14,y:-26},lHnd:{x:-10,y:-40},rElb:{x:2,y:-42},rHnd:{x:-2,y:-54},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:18},lFt:{x:-14,y:38},rKne:{x:12,y:16},rFt:{x:16,y:36}},
  strongPunchPeak:{chest:{x:20,y:-28},head:{x:21,y:-50},lSh:{x:2,y:-28},rSh:{x:22,y:-28},lElb:{x:-4,y:-18},lHnd:{x:-10,y:-24},rElb:{x:38,y:-24},rHnd:{x:60,y:-22},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-2,y:16},lFt:{x:-6,y:36},rKne:{x:16,y:14},rFt:{x:22,y:34}},
  strongPunchFollow:{chest:{x:14,y:-30},head:{x:15,y:-52},lSh:{x:0,y:-30},rSh:{x:18,y:-30},lElb:{x:-6,y:-20},lHnd:{x:-10,y:-28},rElb:{x:32,y:-22},rHnd:{x:48,y:-20},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-4,y:18},lFt:{x:-8,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  heavySlashWind:{chest:{x:-8,y:-36},head:{x:-6,y:-58},lSh:{x:-18,y:-36},rSh:{x:6,y:-36},lElb:{x:-14,y:-28},lHnd:{x:-10,y:-42},rElb:{x:2,y:-50},rHnd:{x:-2,y:-64},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:18},lFt:{x:-14,y:38},rKne:{x:12,y:16},rFt:{x:16,y:36}},
  heavySlashSwing:{chest:{x:10,y:-30},head:{x:11,y:-52},lSh:{x:-6,y:-30},rSh:{x:18,y:-30},lElb:{x:-8,y:-20},lHnd:{x:-12,y:-28},rElb:{x:32,y:-22},rHnd:{x:50,y:-14},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-6,y:18},lFt:{x:-10,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  heavySlashFollow:{chest:{x:16,y:-26},head:{x:17,y:-48},lSh:{x:-2,y:-26},rSh:{x:20,y:-26},lElb:{x:-6,y:-16},lHnd:{x:-14,y:-22},rElb:{x:30,y:-8},rHnd:{x:46,y:6},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-2,y:18},lFt:{x:-6,y:38},rKne:{x:16,y:16},rFt:{x:20,y:36}},
  uppercutWind:{chest:{x:0,y:-18},head:{x:1,y:-36},lSh:{x:-14,y:-18},rSh:{x:12,y:-18},lElb:{x:-8,y:-10},lHnd:{x:-4,y:-22},rElb:{x:14,y:-12},rHnd:{x:12,y:-20},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-16,y:10},lFt:{x:-20,y:24},rKne:{x:18,y:8},rFt:{x:22,y:22}},
  uppercutPeak:{chest:{x:8,y:-30},head:{x:9,y:-52},lSh:{x:-8,y:-30},rSh:{x:14,y:-30},lElb:{x:-6,y:-22},lHnd:{x:-4,y:-34},rElb:{x:18,y:-46},rHnd:{x:20,y:-62},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:14},lFt:{x:-14,y:34},rKne:{x:12,y:14},rFt:{x:16,y:34}},
  lowSweepWind:{chest:{x:-2,y:-16},head:{x:-3,y:-34},lSh:{x:-14,y:-16},rSh:{x:10,y:-16},lElb:{x:-18,y:-8},lHnd:{x:-20,y:-18},rElb:{x:8,y:-10},rHnd:{x:6,y:-20},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-6,y:14},lFt:{x:-10,y:28},rKne:{x:18,y:6},rFt:{x:22,y:16}},
  lowSweepPeak:{chest:{x:-6,y:-14},head:{x:-7,y:-32},lSh:{x:-16,y:-14},rSh:{x:8,y:-14},lElb:{x:-22,y:-6},lHnd:{x:-24,y:-16},rElb:{x:6,y:-8},rHnd:{x:4,y:-18},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-4,y:14},lFt:{x:-8,y:28},rKne:{x:36,y:10},rFt:{x:60,y:12}},
  crouchJab:{chest:{x:8,y:-16},head:{x:9,y:-34},lSh:{x:-10,y:-16},rSh:{x:14,y:-16},lElb:{x:-6,y:-10},lHnd:{x:-4,y:-22},rElb:{x:26,y:-14},rHnd:{x:44,y:-16},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-16,y:12},lFt:{x:-20,y:26},rKne:{x:18,y:10},rFt:{x:22,y:24}},
  crouch:{chest:{x:0,y:-16},head:{x:1,y:-34},lSh:{x:-14,y:-16},rSh:{x:14,y:-16},lElb:{x:-8,y:-10},lHnd:{x:-4,y:-26},rElb:{x:10,y:-12},rHnd:{x:8,y:-28},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-18,y:10},lFt:{x:-22,y:24},rKne:{x:20,y:8},rFt:{x:24,y:22}},
  aerSlash:{chest:{x:8,y:-30},head:{x:9,y:-52},lSh:{x:-10,y:-30},rSh:{x:14,y:-30},lElb:{x:-16,y:-22},lHnd:{x:-12,y:-36},rElb:{x:28,y:-38},rHnd:{x:46,y:-42},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-12,y:12},lFt:{x:-16,y:28},rKne:{x:14,y:10},rFt:{x:18,y:26}},
  block:{chest:{x:-4,y:-30},head:{x:-5,y:-52},lSh:{x:-16,y:-30},rSh:{x:10,y:-30},lElb:{x:-2,y:-28},lHnd:{x:8,y:-44},rElb:{x:4,y:-28},rHnd:{x:6,y:-48},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:20},lFt:{x:-14,y:40},rKne:{x:10,y:20},rFt:{x:14,y:40}},
  hitReact:{chest:{x:-14,y:-28},head:{x:-18,y:-46},lSh:{x:-22,y:-28},rSh:{x:-6,y:-28},lElb:{x:-20,y:-14},lHnd:{x:-16,y:-22},rElb:{x:-8,y:-16},rHnd:{x:-2,y:-24},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-4,y:22},lFt:{x:-8,y:40},rKne:{x:14,y:20},rFt:{x:18,y:38}},
  hitReact2:{chest:{x:-16,y:-26},head:{x:-20,y:-44},lSh:{x:-24,y:-26},rSh:{x:-8,y:-26},lElb:{x:-22,y:-12},lHnd:{x:-18,y:-20},rElb:{x:-10,y:-14},rHnd:{x:-4,y:-22},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-2,y:22},lFt:{x:-6,y:40},rKne:{x:16,y:20},rFt:{x:20,y:38}},
  dashStrike:{chest:{x:20,y:-28},head:{x:21,y:-50},lSh:{x:0,y:-28},rSh:{x:22,y:-28},lElb:{x:-6,y:-18},lHnd:{x:-14,y:-26},rElb:{x:38,y:-24},rHnd:{x:58,y:-22},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-2,y:16},lFt:{x:-6,y:36},rKne:{x:18,y:14},rFt:{x:24,y:34}},
  spinAtk1:{chest:{x:0,y:-30},head:{x:1,y:-52},lSh:{x:-14,y:-30},rSh:{x:14,y:-30},lElb:{x:-28,y:-22},lHnd:{x:-44,y:-26},rElb:{x:28,y:-22},rHnd:{x:44,y:-26},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:18},lFt:{x:-14,y:38},rKne:{x:10,y:18},rFt:{x:14,y:38}},
  spinAtk2:{chest:{x:0,y:-30},head:{x:1,y:-52},lSh:{x:14,y:-30},rSh:{x:-14,y:-30},lElb:{x:28,y:-22},lHnd:{x:44,y:-26},rElb:{x:-28,y:-22},rHnd:{x:-44,y:-26},lHip:{x:7,y:0},rHip:{x:-7,y:0},lKne:{x:10,y:18},lFt:{x:14,y:38},rKne:{x:-10,y:18},rFt:{x:-14,y:38}},
  slamGround:{chest:{x:4,y:-18},head:{x:5,y:-36},lSh:{x:-10,y:-18},rSh:{x:14,y:-18},lElb:{x:-14,y:-8},lHnd:{x:-16,y:2},rElb:{x:20,y:-8},rHnd:{x:24,y:4},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-12,y:14},lFt:{x:-16,y:30},rKne:{x:14,y:12},rFt:{x:18,y:28}},
  serrate1:{chest:{x:8,y:-30},head:{x:9,y:-52},lSh:{x:-10,y:-30},rSh:{x:14,y:-30},lElb:{x:-6,y:-22},lHnd:{x:-4,y:-36},rElb:{x:26,y:-30},rHnd:{x:42,y:-32},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-8,y:18},lFt:{x:-12,y:38},rKne:{x:12,y:16},rFt:{x:16,y:36}},
  serrate2:{chest:{x:6,y:-30},head:{x:7,y:-52},lSh:{x:-12,y:-30},rSh:{x:12,y:-30},lElb:{x:22,y:-28},lHnd:{x:38,y:-30},rElb:{x:-4,y:-24},rHnd:{x:-2,y:-38},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-8,y:18},lFt:{x:-12,y:38},rKne:{x:12,y:16},rFt:{x:16,y:36}},
  victory:{chest:{x:0,y:-35},head:{x:0,y:-57},lSh:{x:-14,y:-35},rSh:{x:14,y:-35},lElb:{x:-22,y:-46},lHnd:{x:-26,y:-58},rElb:{x:22,y:-46},rHnd:{x:26,y:-58},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:18},lFt:{x:-12,y:38},rKne:{x:10,y:18},rFt:{x:12,y:38}},

  // ──── NEW: Dodge/Roll ────
  dodge:{chest:{x:0,y:-14},head:{x:2,y:-20},lSh:{x:-10,y:-14},rSh:{x:10,y:-14},lElb:{x:-6,y:-8},lHnd:{x:-2,y:-14},rElb:{x:6,y:-8},rHnd:{x:2,y:-14},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-14,y:8},lFt:{x:-10,y:18},rKne:{x:14,y:8},rFt:{x:10,y:18}},
  // ──── NEW: Knockdown ────
  knockdown:{chest:{x:14,y:-4},head:{x:24,y:-6},lSh:{x:8,y:-4},rSh:{x:20,y:-4},lElb:{x:4,y:4},lHnd:{x:0,y:8},rElb:{x:26,y:4},rHnd:{x:30,y:8},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-14,y:6},lFt:{x:-22,y:4},rKne:{x:14,y:6},rFt:{x:22,y:4}},
  getUp:{chest:{x:4,y:-22},head:{x:5,y:-40},lSh:{x:-10,y:-22},rSh:{x:14,y:-22},lElb:{x:-14,y:-10},lHnd:{x:-16,y:0},rElb:{x:18,y:-10},rHnd:{x:20,y:0},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-14,y:12},lFt:{x:-18,y:28},rKne:{x:16,y:10},rFt:{x:20,y:26}},
  // ──── NEW: Grab / Throw / Counter ────
  grabReach:{chest:{x:12,y:-30},head:{x:13,y:-52},lSh:{x:-4,y:-30},rSh:{x:18,y:-30},lElb:{x:6,y:-24},lHnd:{x:18,y:-34},rElb:{x:30,y:-26},rHnd:{x:42,y:-30},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-10,y:18},lFt:{x:-14,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
  grabHold:{chest:{x:10,y:-30},head:{x:11,y:-52},lSh:{x:-6,y:-30},rSh:{x:16,y:-30},lElb:{x:8,y:-26},lHnd:{x:22,y:-34},rElb:{x:28,y:-26},rHnd:{x:36,y:-34},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-8,y:18},lFt:{x:-12,y:38},rKne:{x:12,y:16},rFt:{x:16,y:36}},
  throwFwd:{chest:{x:16,y:-28},head:{x:17,y:-50},lSh:{x:0,y:-28},rSh:{x:20,y:-28},lElb:{x:14,y:-18},lHnd:{x:28,y:-22},rElb:{x:34,y:-18},rHnd:{x:50,y:-14},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-4,y:18},lFt:{x:-8,y:38},rKne:{x:16,y:16},rFt:{x:20,y:36}},
  counterStrike:{chest:{x:14,y:-32},head:{x:15,y:-54},lSh:{x:-4,y:-32},rSh:{x:18,y:-32},lElb:{x:-6,y:-24},lHnd:{x:-4,y:-38},rElb:{x:30,y:-30},rHnd:{x:48,y:-32},lHip:{x:-7,y:0},rHip:{x:7,y:0},lKne:{x:-8,y:18},lFt:{x:-12,y:38},rKne:{x:14,y:16},rFt:{x:18,y:36}},
};

// ═══════════════════════════════════════
// ATTACKS — with stamina costs
// ═══════════════════════════════════════
const ATK={
  jab:{frames:[{d:35,p:'jabWind'},{d:45,p:'jabPeak'},{d:55,p:'jabRecover'},{d:50,p:'idle1'}],hitF:1,baseDmg:8,type:'slash',hj:'rHnd',hr:54,kb:3,sc:5},
  slash:{frames:[{d:60,p:'slashWind'},{d:45,p:'slashStrike'},{d:50,p:'slashFollow'},{d:60,p:'idle1'}],hitF:1,baseDmg:12,type:'slash',hj:'rHnd',hr:56,kb:4,sc:8},
  dblSlash:{frames:[{d:50,p:'slashWind'},{d:40,p:'slashStrike'},{d:35,p:'dblSlash2Wind'},{d:40,p:'dblSlash2Hit'},{d:60,p:'idle1'}],hitF:[1,3],baseDmg:20,type:'slash',hj:'rHnd',hr:56,kb:4,multi:true,sc:12},
  strongPunch:{frames:[{d:90,p:'strongPunchWind'},{d:50,p:'strongPunchPeak'},{d:60,p:'strongPunchFollow'},{d:80,p:'idle1'}],hitF:1,baseDmg:16,type:'blunt',hj:'rHnd',hr:62,kb:6,dash:false,sc:12},
  heavySlash:{frames:[{d:100,p:'heavySlashWind'},{d:45,p:'heavySlashSwing'},{d:50,p:'heavySlashFollow'},{d:90,p:'idle1'}],hitF:1,baseDmg:18,type:'slash',hj:'rHnd',hr:60,kb:7,sc:15},
  crouchJab:{frames:[{d:40,p:'crouchJab'},{d:60,p:'crouch'}],hitF:0,baseDmg:6,type:'pierce',hj:'rHnd',hr:52,kb:2,sc:4},
  uppercut:{frames:[{d:50,p:'uppercutWind'},{d:45,p:'uppercutPeak'},{d:70,p:'idle1'}],hitF:1,baseDmg:14,type:'blunt',hj:'rHnd',hr:55,kb:5,launches:true,sc:10},
  aerSlash:{frames:[{d:150,p:'aerSlash'}],hitF:0,baseDmg:14,type:'slash',hj:'rHnd',hr:58,kb:4,sc:10,weaponOnly:true},
  dashStrike:{frames:[{d:45,p:'dashStrike'},{d:90,p:'idle1'}],hitF:0,baseDmg:18,type:'slash',hj:'rHnd',hr:68,kb:6,dash:true,sc:12,weaponOnly:true},
  highKick:{frames:[{d:50,p:'highKickLift'},{d:55,p:'highKickPeak'},{d:65,p:'highKickRecover'},{d:60,p:'idle1'}],hitF:1,baseDmg:12,type:'blunt',hj:'rFt',hr:58,kb:4,sc:8},
  frontKick:{frames:[{d:50,p:'frontKickChamber'},{d:50,p:'frontKickPeak'},{d:65,p:'frontKickRecover'},{d:55,p:'idle1'}],hitF:1,baseDmg:10,type:'blunt',hj:'rFt',hr:62,kb:5,sc:8},
  backKick:{frames:[{d:60,p:'backKickTurn'},{d:55,p:'backKickPeak'},{d:65,p:'backKickRecover'},{d:60,p:'idle1'}],hitF:1,baseDmg:14,type:'blunt',hj:'rFt',hr:60,kb:6,sc:10},
  spinJumpKick:{frames:[{d:60,p:'spinJumpWind'},{d:65,p:'spinJumpPeak'},{d:100,p:'idle1'}],hitF:1,baseDmg:15,type:'blunt',hj:'rFt',hr:66,kb:7,sc:14},
  lowSweep:{frames:[{d:55,p:'lowSweepWind'},{d:55,p:'lowSweepPeak'},{d:80,p:'idle1'}],hitF:1,baseDmg:13,type:'blunt',hj:'rFt',hr:64,kb:5,trips:true,sc:10},
  jumpKick:{frames:[{d:60,p:'spinJumpWind'},{d:65,p:'spinJumpPeak'}],hitF:1,baseDmg:20,type:'blunt',hj:'rFt',hr:66,kb:7,sc:12},
  special_lunge:{frames:[{d:45,p:'dashStrike'},{d:80,p:'idle1'}],hitF:0,baseDmg:22,type:'pierce',hj:'rHnd',hr:72,kb:4,dash:true,pierceBlock:true,sc:20},
  special_whirlwind:{frames:[{d:65,p:'spinAtk1'},{d:65,p:'spinAtk2'},{d:65,p:'spinAtk1'},{d:80,p:'idle1'}],hitF:[0,1,2],baseDmg:30,type:'slash',hj:'rHnd',hr:84,kb:5,aoe:true,sc:25},
  special_shockwave:{frames:[{d:90,p:'heavySlashWind'},{d:55,p:'uppercutPeak'},{d:55,p:'slamGround'},{d:100,p:'idle1'}],hitF:2,baseDmg:25,type:'blunt',hj:'rFt',hr:94,kb:8,aoe:true,stun:800,sc:25},
  special_crush:{frames:[{d:110,p:'heavySlashWind'},{d:50,p:'heavySlashSwing'},{d:50,p:'heavySlashFollow'},{d:120,p:'idle1'}],hitF:2,baseDmg:35,type:'blunt',hj:'rHnd',hr:60,kb:9,unblockable:true,sc:30},
  special_ricochet:{frames:[{d:45,p:'jabPeak'},{d:70,p:'idle1'}],hitF:0,baseDmg:14,type:'slash',hj:'rHnd',hr:58,kb:3,multi:true,bounceHits:3,sc:18},
  special_serrate:{frames:[{d:30,p:'serrate1'},{d:22,p:'serrate2'},{d:30,p:'serrate1'},{d:22,p:'serrate2'},{d:30,p:'serrate1'},{d:45,p:'idle1'}],hitF:[0,1,2,3,4],baseDmg:20,type:'pierce',hj:'rHnd',hr:54,kb:2,multi:true,bleed:true,bleedDPS:2,bleedDuration:5000,sc:22},
  special_overpower:{frames:[{d:90,p:'strongPunchWind'},{d:50,p:'strongPunchPeak'},{d:50,p:'strongPunchFollow'},{d:100,p:'idle1'}],hitF:1,baseDmg:40,type:'blunt',hj:'rHnd',hr:64,kb:7,damageMultiplier:2,sc:30},
  counterStrike:{frames:[{d:40,p:'counterStrike'},{d:70,p:'idle1'}],hitF:0,baseDmg:15,type:'blunt',hj:'rHnd',hr:56,kb:5,sc:0},
};

const IDLE_ANIM={loop:true,frames:[{d:500,p:'idle1'},{d:500,p:'idle2'},{d:500,p:'idle3'},{d:500,p:'idle2'}]};
const WALK_ANIM={loop:true,frames:[{d:170,p:'walkF1'},{d:170,p:'walkF2'},{d:170,p:'walkF3'},{d:170,p:'walkF4'}]};
const BLOCK_ANIM={loop:true,frames:[{d:100,p:'block'}]};
const CROUCH_ANIM={loop:true,frames:[{d:100,p:'crouch'}]};
const DODGE_ANIM={loop:false,frames:[{d:DODGE_DUR,p:'dodge'},{d:100,p:'idle1'}]};
const KD_ANIM={loop:false,frames:[{d:KD_TIME,p:'knockdown'},{d:KD_RECOVER,p:'getUp'},{d:150,p:'idle1'}]};

// ═══════ BARE-HANDED ALLOWED ATTACKS ═══════
const BARE_ATTACKS=new Set(['jab','strongPunch','uppercut','highKick','frontKick','backKick','spinJumpKick','lowSweep','jumpKick','crouchJab','counterStrike']);

function mkFighter(id,name,el,col,right){
  return{id,name,element:el,colorHex:col,facingRight:right,
    x:0,y:FLOOR,vx:0,vy:0,grounded:true,hp:100,maxHp:100,
    stamina:MAX_STAMINA,maxStamina:MAX_STAMINA,
    fi:0,ft:0,animFrames:IDLE_ANIM.frames,animLoop:true,
    pose:{...P.idle1},target:{...P.idle1},
    attacking:false,blocking:false,crouching:false,hitStun:0,atkCd:0,
    didHit:false,currentAtk:null,combo:0,comboT:0,
    specialCd:0,specialMax:SPECIAL_CD,
    weaponVerts:[],weaponPhysics:null,weaponSpecial:null,isDummy:false,
    gfx:null,glowGfx:null,trailGfx:null,nameGfx:null,
    bleedTimer:0,bleedDPS:0,stunTimer:0,hitStop:0,
    swingProgress:0,swingEasing:easeOutQuad,
    trails:[],trailTimer:0,wasAirborne:false,landDust:false,
    // Dodge
    dodging:false,dodgeTimer:0,dodgeDir:0,iframes:0,
    lastTapA:0,lastTapD:0,
    // Knockdown
    knockedDown:false,kdTimer:0,kdRecovering:false,kdInvuln:0,
    // Weapon durability
    weaponDur:MAX_DUR,maxDur:MAX_DUR,bareHanded:false,reforging:false,
    // Original weapon backup
    origWeaponVerts:[],origWeaponPhysics:null,origWeaponSpecial:null,
    // Round
    roundWins:0,
    // Grab
    grabbed:false,grabbedBy:null,
  };
}

// ═══════ TAUNTS ═══════
const TAUNTS_GENERIC=[
  "You're stepping into the wrong arena.",
  "I hope you brought a better weapon than that.",
  "Your stance is weak. This will be over quickly.",
  "I've dismantled better fighters than you.",
  "Let's see if your code is as sloppy as your footwork.",
  "System prediction: Flawless victory.",
  "You should have stayed logged out.",
  "Last fighter who tried that didn't get up.",
  "I've seen better aggression from training dummies.",
  "Your weapon looks like my first draft.",
  "Nice armor. It won't help.",
  "I've already mapped every hole in your defense.",
  "You telegraphed that move before you even thought it.",
  "Error 404: Skill not found.",
  "I don't lose to amateurs. Today's no exception.",
  "Breathe. It's the last calm moment you'll get.",
  "This arena has seen legends. You are not one of them.",
  "Your combo window is a mile wide. Thanks.",
];
const TAUNTS_NAMED=(n)=>[
  `${n}, I already know how this ends.`,
  `${n}? That's the name you chose to lose under?`,
  `${n}, that's the name you picked for your fighter — shows your IQ, dude.`,
  `${n}, you sure you want to do this?`,
  `${n}, I'll remember that name. As a cautionary tale.`,
  `${n}... I expected more from someone with that much confidence.`,
  `Everyone's watching, ${n}. Don't make it worse.`,
];
const TAUNTS_KO_WIN=[
  "Told you.",
  "Exactly as predicted.",
  "You can do better. You won't, but you can.",
  "Nothing personal. Actually it was a little personal.",
  "First rule of the arena: show up ready.",
  "FLAWLESS.",
  "That's what happens when geometry meets cowardice.",
  "K.O. — just like I scripted.",
];
const TAUNTS_KO_LOSE=[
  "Lucky hit. Don't get used to it.",
  "I let that one land. Studying you.",
  "Enjoy it. The next round belongs to me.",
  "A fluke. My systems are recalibrating.",
  "Fine. Round one to you. Enjoy it while it lasts.",
];

// ═══════ TAUNT → AUDIO MAP ═══════
const TAUNT_AUDIO={
  "You're stepping into the wrong arena.":                       'taunt_wrongarena',
  "I hope you brought a better weapon than that.":              'taunt_betterweapon',
  "I've dismantled better fighters than you.":                  'taunt_dismantled',
  "Let's see if your code is as sloppy as your footwork.":      'taunt_footwork',
  "System prediction: Flawless victory.":                       'taunt_flawless',
  "You should have stayed logged out.":                         'taunt_loggedout',
  "Your stance is weak. This will be over quickly.":            'taunt_stance',
  "Last fighter who tried that didn't get up.":                 'taunt_lastfighter',
  "I've seen better aggression from training dummies.":         'taunt_dummies',
  "Your weapon looks like my first draft.":                     'taunt_firstdraft',
  "Nice armor. It won't help.":                                 'taunt_armor',
  "I've already mapped every hole in your defense.":            'taunt_mapped',
  "You telegraphed that move before you even thought it.":      'taunt_telegraphed',
  "Error 404: Skill not found.":                                'taunt_error404',
  "I don't lose to amateurs. Today's no exception.":            'taunt_amateurs',
  "Breathe. It's the last calm moment you'll get.":             'taunt_breathe',
};

// ═══════ SCENE ═══════
export default class ArenaScene extends Phaser.Scene{
  constructor(){super({key:'ArenaScene'})}

  preload(){
    this.spriteRenderers=[];
    const r=new P1SpriteRenderer(this);
    r.preload();
    this.spriteRenderers.push(r,new P1SpriteRenderer(this));
    // Suppress audio decode errors — don't let bad MP3s crash the game
    this.load.on('loaderror',(file)=>{
      if(file.type==='audio')console.warn(`[ScribFight] Audio skipped: ${file.key}`);
    });
    // ═══════ TAUNT AUDIO ═══════
    const audioFiles={
      taunt_wrongarena:  'yoursteppingintothewrongarena',
      taunt_betterweapon:'ihopeyoubroghtabetterweaponthenthat',
      taunt_dismantled:  'ihavedismantlebetterfightersthanyou',
      taunt_footwork:    'letsseeifyourcodeisasloppyasyourfootwork',
      taunt_flawless:    'systempredictionflawlessvictory',
      taunt_loggedout:   'youshouldhavestayedlockedout',
      taunt_stance:      'yourstanceisweakthiswillbeoverquickly',
      taunt_lastfighter: 'lastfighterwhotriedthatdidntgetup',
      taunt_dummies:     'I_veseenbetteraggressionfromtrainig_dummies',
      taunt_firstdraft:  'Your_weapon_looks_like_my_first_draft',
      taunt_armor:       'Nice_armor__It_won_t_help',
      taunt_mapped:      'I_ve_already_mapped_every_hole_in_your_defense',
      taunt_telegraphed: 'You_telegraphed_that_move_before_you_even_thought_it',
      taunt_error404:    'Error_404_Skill_not_found',
      taunt_amateurs:    'I_don_t_lose_to_amateurs__Today_s_no_exception',
      taunt_breathe:     'Breathe__It_s_the_last_calm_moment_you_ll_get',
      grunt_hah:         'light_punch',
      grunt_attack:      'light_punch',
      grunt_attack2:     'heavy_attack',
      grunt_hit:         'getting_hit',
      grunt_death:       'death',
    };
    // Disable WebAudio decode errors by switching to HTML5 audio
    if(this.sound&&this.sound.locked!==undefined){
      try{this.sound.pauseOnBlur=false;}catch(e){}
    }
    this.load.on('loaderror',(file)=>{
      console.warn(`[Audio skipped] ${file.key}`);
    });
    for(const[key,file]of Object.entries(audioFiles)){
      this.load.audio(key,`/audio/${file}.mp3`);
    }
  }

  init(data){
    const d=data?.players?data:(ArenaScene.pendingData||{});
    this.pData=d.players||[];this.localId=d.localId||'local';
    this.mode=d.mode||'practice';this.onEvent=d.onEvent||(()=>{});
    this.f=[];this.matchOn=false;this.timer=ROUND_TIME;this.inputBuf=[];
    this.currentRound=1;this.roundOver=false;this.transitioning=false;
    this.gameSpeed=1;this.koActive=false;this.koTimer=0;
    this.winStreak=parseInt(localStorage.getItem('scrib_winstreak')||'0');
  }

  create(){
    const pg=this.make.graphics({});pg.fillStyle(0xffffff);pg.fillCircle(3,3,3);
    pg.generateTexture('sp',6,6);pg.destroy();
    this.drawBg();
    this.sfx=new SoundFX();this.sfx.init();
    const mk=(pd,col,right)=>{
      const f=mkFighter(pd.id,pd.name,pd.weapon?.element||'fire',col,right);
      f.weaponVerts=normalizeVertices(pd.weapon?.vertices||pd.weapon?.allPoints||[],32);
      f.origWeaponVerts=[...f.weaponVerts];
      f.weaponPhysics=pd.weapon?.physics||null;
      f.origWeaponPhysics=f.weaponPhysics?{...f.weaponPhysics}:null;
      f.weaponSpecial=pd.weapon?.special||null;
      f.origWeaponSpecial=f.weaponSpecial?{...f.weaponSpecial}:null;
      if(f.weaponPhysics?.swingArcEasing==='easeInCubic')f.swingEasing=easeInCubic;
      // ═══════ ARMOR ═══════
      const armorData=pd.armor;
      if(armorData&&armorData.hasArmor){
        f.armor={
          helmet:{...armorData.helmet,durability:armorData.helmet.durability,maxDurability:armorData.helmet.maxDurability},
          body:{...armorData.body,durability:armorData.body.durability,maxDurability:armorData.body.maxDurability},
          totalReduction:armorData.totalReduction,
          broken:false,
        };
      }else{
        f.armor=null;
      }
      // ═══════ ARMOR IMAGE (user-drawn holographic overlay) ═══════
      f.armorImageUrl=pd.armorImage||null;
      f.gfx=this.add.graphics().setDepth(10);f.glowGfx=this.add.graphics().setDepth(9);
      f.trailGfx=this.add.graphics().setDepth(8);
      f.armorGfx=this.add.graphics().setDepth(18);
      f.nameGfx=this.add.text(0,0,pd.name,{fontFamily:'Space Grotesk',fontSize:'18px',color:'#ffffffcc',stroke:'#000',strokeThickness:4,fontStyle:'700'}).setOrigin(0.5).setDepth(12);
      return f;
    };
    const p1=this.pData[0]||{id:'local',name:'Fighter',weapon:{element:'fire'}};
    const f1=mk(p1,'#3399ff',true);f1.x=W*0.3;this.f.push(f1);
    const p2=this.pData[1]||{id:'dummy',name:'DUMMY',weapon:{element:'water'}};
    const f2=mk(p2,'#ff2244',false);f2.x=W*0.7;
    f2.isDummy=(this.mode==='training'||this.mode==='practice'||p2.id==='dummy');
    f2.weaponDur=MAX_DUR*999; // dummy never breaks
    // Give dummy the same armor as P1 if it has none
    if(!f2.armor&&f1.armor){f2.armor=JSON.parse(JSON.stringify(f1.armor));}
    this.f.push(f2);

    this.keys=this.input.keyboard.addKeys('W,A,S,D,J,K,L,I');
    this.input.keyboard.on('keydown',(e)=>this.onKeyDown(e.key.toUpperCase()));
    this.input.mouse?.disableContextMenu();

    this.hudGfx=this.add.graphics().setDepth(50);
    this.timerText=this.add.text(W/2,32,'99',{fontFamily:'Unbounded',fontSize:'36px',color:'#FFE66D',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setDepth(51);
    this.p1Nm=this.add.text(140,12,f1.name,{fontFamily:'Space Grotesk',fontSize:'20px',color:'#fff',stroke:'#000',strokeThickness:4,fontStyle:'bold'}).setDepth(51);
    this.p2Nm=this.add.text(W-140,12,f2.name,{fontFamily:'Space Grotesk',fontSize:'20px',color:'#fff',stroke:'#000',strokeThickness:4,fontStyle:'bold'}).setOrigin(1,0).setDepth(51);
    this.comboText=this.add.text(W/2,H*0.28,'',{fontFamily:'Unbounded',fontSize:'36px',color:'#FFE66D',stroke:'#000',strokeThickness:6}).setOrigin(0.5).setDepth(51).setAlpha(0);
    this.roundText=this.add.text(W/2,H*0.20,'',{fontFamily:'Unbounded',fontSize:'32px',color:'#C9A0FF',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setDepth(51).setAlpha(0);
    this.koText=this.add.text(W/2,H*0.38,'',{fontFamily:'Unbounded',fontSize:'82px',color:'#FF8A76',stroke:'#000',strokeThickness:8}).setOrigin(0.5).setDepth(55).setAlpha(0);
    this.tauntText=this.add.text(W/2,H*0.70,'',{fontFamily:'Space Grotesk',fontSize:'20px',fontStyle:'bold',color:'#FFE66D',stroke:'#000',strokeThickness:5,wordWrap:{width:600},padding:{x:12,y:6}}).setOrigin(0.5).setDepth(52).setAlpha(0);

    // Particles
    this.slashFx=this.add.particles(0,0,'sp',{speed:{min:120,max:400},scale:{start:1.3,end:0},lifespan:400,tint:[0xfbbf24,0xffffff,0xff8c00],blendMode:'ADD',frequency:-1,quantity:20}).setDepth(20);
    this.bluntFx=this.add.particles(0,0,'sp',{speed:{min:50,max:160},scale:{start:2,end:0},lifespan:500,tint:[0x94a3b8,0xffffff,0xcbd5e1],blendMode:'ADD',frequency:-1,quantity:16}).setDepth(20);
    this.pierceFx=this.add.particles(0,0,'sp',{speed:{min:150,max:420},scale:{start:0.8,end:0},lifespan:320,tint:[0xf472b6,0xe8eaf6,0xfb7185],blendMode:'ADD',frequency:-1,quantity:22}).setDepth(20);
    this.shockFx=this.add.particles(0,0,'sp',{speed:{min:80,max:320},scale:{start:2.5,end:0},lifespan:700,tint:[0xa78bfa,0x60a5fa,0xc084fc],blendMode:'ADD',frequency:-1,quantity:30}).setDepth(20);
    this.bleedFx=this.add.particles(0,0,'sp',{speed:{min:10,max:50},scale:{start:0.5,end:0},lifespan:700,tint:[0xf87171,0xef4444],blendMode:'ADD',frequency:-1,quantity:5}).setDepth(20);
    this.dustFx=this.add.particles(0,0,'sp',{speed:{min:20,max:60},angle:{min:240,max:300},scale:{start:0.8,end:0},lifespan:400,tint:[0x8b7355,0x6b5b45],blendMode:'NORMAL',frequency:-1,quantity:6}).setDepth(5);
    this.shatterFx=this.add.particles(0,0,'sp',{speed:{min:100,max:300},scale:{start:1.2,end:0},lifespan:600,tint:[0xfbbf24,0xff6b00,0xffffff],blendMode:'ADD',frequency:-1,quantity:24}).setDepth(20);
    this.impactGfx=this.add.graphics().setDepth(25);
    this.vignetteGfx=this.add.graphics().setDepth(45);

    this.add.text(W/2,H-16,'A/D Move | W Jump | S Crouch | J Slash | K Heavy | L Kick | I Block | Double-tap A/D Dodge | fwd+fwd+L Special',{fontFamily:'Space Grotesk',fontSize:'13px',color:'#88C8E8',fontStyle:'bold',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(51);

    // ═══════ PIXEL ART SPRITE SETUP (both fighters) ═══════
    if(this.spriteRenderers&&this.spriteRenderers.length>=2){
      this.spriteRenderers[0].createAnimations(); // create anims once (shared)
      for(let i=0;i<this.f.length&&i<this.spriteRenderers.length;i++){
        const fi=this.f[i];
        const sr=this.spriteRenderers[i];
        sr.createSprite(fi.x,fi.y);
        fi.useSprite=true;
        fi.spriteRenderer=sr;
        // ═══════ SHADOW TINT — dark silhouette characters ═══════
        if(sr.sprite){
          sr.sprite.setTint(0x080812);
        }
      }
    }

    // ═══════ ARMOR IMAGE → Holographic Texture Overlay ═══════
    for(let i=0;i<this.f.length;i++){
      const fi=this.f[i];
      const imgUrl=fi.armorImageUrl||(i>0&&this.f[0].armorImageUrl?this.f[0].armorImageUrl:null);
      if(imgUrl&&fi.armor&&!fi.armor.broken){
        const texKey='armorTex_'+fi.id;
        try{
          if(!this.textures.exists(texKey)){
            this.textures.addBase64(texKey,imgUrl);
          }
          this.textures.once('addtexture-'+texKey,()=>{
            const armorSprite=this.add.image(fi.x,fi.y-22*S,texKey).setDepth(15);
            armorSprite.setScale(S*0.28,-S*0.28);
            armorSprite.setBlendMode(Phaser.BlendModes.ADD);
            armorSprite.setAlpha(0.55);
            fi.armorSprite=armorSprite;
          });
        }catch(e){/* fallback to graphics-based armor */}
      }
    }

    // ═══════ CLICK TO START (unlocks AudioContext for Chrome/Safari) ═══════
    const overlay=this.add.graphics().setDepth(100);
    overlay.fillStyle(0x05050a,0.9);overlay.fillRect(0,0,W,H);
    // Neo Brutalist decorative border
    overlay.lineStyle(4,0xFFE66D,0.3);overlay.strokeRect(30,30,W-60,H-60);
    overlay.lineStyle(2,0xFF8AC4,0.15);overlay.strokeRect(40,40,W-80,H-80);
    const clickText=this.add.text(W/2,H/2,'CLICK TO FIGHT',{
      fontFamily:'Unbounded',fontSize:'44px',color:'#FFE66D',
      stroke:'#000',strokeThickness:7,
    }).setOrigin(0.5).setDepth(101);
    const subText=this.add.text(W/2,H/2+52,'Press anywhere to enter the arena',{
      fontFamily:'Space Grotesk',fontSize:'18px',color:'#88C8E8',fontStyle:'bold',stroke:'#000',strokeThickness:3,
    }).setOrigin(0.5).setDepth(101);
    this.tweens.add({targets:clickText,alpha:{from:0.4,to:1},duration:900,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    this.input.once('pointerdown',()=>{
      // Resume AudioContext if suspended (Chrome autoplay policy)
      if(this.sound.context&&this.sound.context.state==='suspended'){
        this.sound.context.resume();
      }
      this.tweens.add({targets:[overlay,clickText,subText],alpha:0,duration:300,onComplete:()=>{
        overlay.destroy();clickText.destroy();subText.destroy();
        this.startRound();
      }});
    });
  }

  startRound(){
    this.transitioning=true;this.roundOver=false;this.koActive=false;
    this.gameSpeed=1;this.timer=ROUND_TIME;
    // Reset fighters
    for(let i=0;i<this.f.length;i++){
      const f=this.f[i];
      f.x=i===0?W*0.3:W*0.7;f.y=FLOOR;f.vx=0;f.vy=0;f.grounded=true;
      f.hp=f.maxHp;f.stamina=f.maxStamina;
      f.attacking=false;f.blocking=false;f.crouching=false;f.hitStun=0;f.atkCd=0;
      f.dodging=false;f.dodgeTimer=0;f.iframes=0;
      f.knockedDown=false;f.kdTimer=0;f.kdRecovering=false;f.kdInvuln=0;
      f.combo=0;f.comboT=0;f.specialCd=0;
      f.bleedTimer=0;f.stunTimer=0;f.hitStop=0;
      f.swingProgress=0;f.trails=[];
      if(!f.isDummy){f.weaponDur=f.maxDur;f.bareHanded=false;f.reforging=false;}
      // Restore original weapon
      if(!f.bareHanded){f.weaponVerts=[...f.origWeaponVerts];f.weaponPhysics=f.origWeaponPhysics?{...f.origWeaponPhysics}:null;f.weaponSpecial=f.origWeaponSpecial?{...f.origWeaponSpecial}:null;}
      // Reset armor durability
      if(f.armor){f.armor.broken=false;f.armor.helmet.durability=f.armor.helmet.maxDurability;f.armor.body.durability=f.armor.body.maxDurability;}
      this.setAnim(f,IDLE_ANIM.frames,true);
    }
    // Reset sprites for all fighters
    for(let i=0;i<this.f.length;i++){
      const fi=this.f[i];
      if(fi.spriteRenderer){
        fi.spriteRenderer.reset(fi.x,fi.y);
        // Re-apply shadow tint after reset
        if(fi.spriteRenderer.sprite){fi.spriteRenderer.sprite.setTint(0x080812);}
      }
    }
    // Show round text
    const rndLabel=`ROUND ${this.currentRound}`;
    this.roundText.setText(rndLabel).setAlpha(1);
    this.tweens.add({targets:this.roundText,alpha:{from:1,to:0},scale:{from:1,to:1.8},duration:1800,ease:'Power3'});
    // Taunt before fight — named on round 1, generic otherwise
    const opp=this.f[1];
    if(opp){
      const pool=this.currentRound===1&&opp.name&&opp.name!=='DUMMY'
        ?TAUNTS_NAMED(opp.name):TAUNTS_GENERIC;
      this.showTaunt(pool,200,opp);
    }
    const ft=this.add.text(W/2,H*0.38,'FIGHT',{fontFamily:'Unbounded',fontSize:'72px',color:'#FF8AC4',stroke:'#000',strokeThickness:8}).setOrigin(0.5).setDepth(60);
    this.tweens.add({targets:ft,alpha:{from:0,to:1},duration:400,yoyo:true,hold:800,onComplete:()=>{ft.destroy();this.transitioning=false;this.matchOn=true;}});
    this.sfx?.roundStart();
  }

  drawBg(){
    const bg=this.add.graphics().setDepth(0);
    for(let y=0;y<FLOOR;y+=2){const t=y/FLOOR;bg.fillStyle(Phaser.Display.Color.GetColor(Math.floor(14+t*45),Math.floor(10+t*25),Math.floor(32+t*50)));bg.fillRect(0,y,W,2)}
    // Subtle grid pattern — Neo Brutalist
    bg.lineStyle(1,0xffffff,0.015);
    for(let x=0;x<W;x+=60){bg.lineBetween(x,0,x,FLOOR)}
    for(let y=0;y<FLOOR;y+=60){bg.lineBetween(0,y,W,y)}
    bg.fillStyle(0xC9A0FF,0.04);bg.fillCircle(W/2,FLOOR-20,180);bg.fillStyle(0xFF8AC4,0.03);bg.fillCircle(W/2,FLOOR-10,100);
    const m=(c,pts)=>{bg.fillStyle(c);bg.beginPath();bg.moveTo(0,FLOOR);for(const[x,y]of pts)bg.lineTo(x,FLOOR-y);bg.lineTo(W,FLOOR);bg.closePath();bg.fillPath()};
    m(0x161228,[[100,60],[200,110],[350,40],[500,85],[650,130],[800,50],[950,100],[1100,65],[1200,35]]);
    m(0x10091e,[[0,25],[150,65],[300,90],[450,35],[600,55],[750,80],[900,45],[1050,70],[1200,25]]);
    m(0x0a0516,[[50,15],[200,35],[400,25],[550,40],[700,30],[900,22],[1100,32],[1200,10]]);
    bg.fillStyle(0x080412);bg.fillRect(0,FLOOR,W,H-FLOOR);
    // Thick floor line — Neo Brutalist
    bg.lineStyle(4,0xFFE66D,0.15);bg.lineBetween(0,FLOOR,W,FLOOR);
    bg.lineStyle(2,0xFFE66D,0.06);bg.lineBetween(0,FLOOR+2,W,FLOOR+2);
  }

  onKeyDown(key){
    const f=this.f[0];if(!f||f.hp<=0||!this.matchOn||this.transitioning)return;
    const fwd=f.facingRight?'D':'A',bck=f.facingRight?'A':'D';
    const mapped=key===fwd?'F':key===bck?'B':key;
    this.inputBuf.push({key:mapped,time:this.time.now});
    this.inputBuf=this.inputBuf.filter(i=>this.time.now-i.time<600).slice(-12);

    // Dodge detection (double-tap A or D)
    const now=this.time.now;
    if(key==='A'){
      if(now-f.lastTapA<DBL_TAP_WIN&&!f.dodging&&!f.attacking&&!f.knockedDown&&f.stamina>=DODGE_COST&&f.hitStun<=0){this.execDodge(f,-1);return}
      f.lastTapA=now;
    }
    if(key==='D'){
      if(now-f.lastTapD<DBL_TAP_WIN&&!f.dodging&&!f.attacking&&!f.knockedDown&&f.stamina>=DODGE_COST&&f.hitStun<=0){this.execDodge(f,1);return}
      f.lastTapD=now;
    }
    this.processInput(f,key);
  }

  execDodge(f,dir){
    f.stamina-=DODGE_COST;
    f.dodging=true;f.dodgeTimer=DODGE_DUR;f.dodgeDir=dir;f.iframes=DODGE_IFRAMES;
    f.vx=dir*DODGE_SPD;f.attacking=false;f.blocking=false;
    this.setAnim(f,DODGE_ANIM.frames,false);
    this.dustFx.setPosition(f.x,FLOOR);this.dustFx.emitParticle(4);
    this.sfx?.dodge();
  }

  execGrab(f,def){
    f.stamina-=15;
    f.attacking=true;f.didHit=false;f.currentAtk='grab';f.fi=0;f.ft=0;f.swingProgress=0;
    f.animFrames=[{d:80,p:'grabReach'},{d:400,p:'grabHold'},{d:100,p:'throwFwd'},{d:120,p:'idle1'}];
    f.animLoop=false;f.target={...P.grabReach};
    // Grab connects
    def.grabbed=true;def.grabbedBy=f.id;def.hitStun=700;def.blocking=false;
    this.setAnim(def,[{d:600,p:'hitReact'},{d:200,p:'hitReact2'},{d:200,p:'idle1'}],false);
    this.sfx?.grab();
    // Throw after hold
    this.time.delayedCall(500,()=>{
      if(!def.grabbed||def.hp<=0)return;
      const dir=f.facingRight?1:-1;
      def.grabbed=false;def.grabbedBy=null;
      def.hp=Math.max(0,def.hp-20);def.vx=dir*10;def.vy=-6;
      this.triggerKnockdown(def,dir);
      this.sfx?.throwSfx();
      this.cameras.main.shake(150,0.015);
      this.bluntFx.setPosition(def.x,def.y-20*S);this.bluntFx.emitParticle(14);
    });
  }

  processInput(f,key){
    if(f.attacking||f.hitStun>0||f.stunTimer>0||f.dodging||f.knockedDown)return;
    const keys=this.inputBuf.map(i=>i.key).join('');
    const cr=this.keys.S.isDown,air=!f.grounded;
    const fwdHeld=f.facingRight?this.keys.D.isDown:this.keys.A.isDown;
    const bckHeld=f.facingRight?this.keys.A.isDown:this.keys.D.isDown;
    const isBare=f.bareHanded;

    // Combos (longest first) — weapon only
    if(!isBare&&keys.endsWith('FFL')&&f.specialCd<=0)return this.execAttack(f,this.getSpecialType(f));
    if(!isBare&&keys.endsWith('FFJ'))return this.execAttack(f,'dashStrike');
    if(!isBare&&keys.endsWith('JJ'))return this.execAttack(f,'dblSlash');

    // Kicks (always available)
    if(key==='L'){
      if(cr)return this.execAttack(f,'lowSweep');
      if(air)return this.execAttack(f,'spinJumpKick');
      if(bckHeld)return this.execAttack(f,'backKick');
      if(fwdHeld)return this.execAttack(f,'frontKick');
      return this.execAttack(f,'highKick');
    }
    // Punches / Weapon
    if(key==='J'){
      if(cr)return this.execAttack(f,'uppercut');
      if(air&&!isBare)return this.execAttack(f,'aerSlash');
      if(air&&isBare)return this.execAttack(f,'jab');
      if(fwdHeld&&!isBare)return this.execAttack(f,'strongPunch');
      if(fwdHeld&&isBare)return this.execAttack(f,'strongPunch');
      return this.execAttack(f,isBare?'jab':'slash');
    }
    if(key==='K'){
      if(cr){
        // GRAB: S+K near opponent
        const opp=this.f.find(o=>o.id!==f.id&&o.hp>0);
        if(opp&&Math.abs(f.x-opp.x)<75&&f.grounded&&!opp.grabbed&&f.stamina>=15)return this.execGrab(f,opp);
        return this.execAttack(f,'crouchJab');
      }
      if(air)return this.execAttack(f,'jumpKick');
      if(fwdHeld&&!isBare)return this.execAttack(f,'heavySlash');
      return this.execAttack(f,'strongPunch');
    }
  }

  getSpecialType(f){
    const sp=f.weaponSpecial?.type;
    const map={lunge:'special_lunge',whirlwind:'special_whirlwind',shockwave:'special_shockwave',crush:'special_crush',ricochet:'special_ricochet',serrate:'special_serrate',overpower:'special_overpower',spin:'special_whirlwind',aoe:'special_shockwave',overhead:'special_crush',dash:'special_lunge'};
    return map[sp]||'special_overpower';
  }

  playGrunt(key){
    try{
      if(this.cache.audio.has(key)){
        this.sound.stopByKey(key);
        this.sound.play(key,{volume:0.7,rate:0.95+Math.random()*0.1});
      }
    }catch(e){console.warn(`[ScribFight] Grunt playback failed: ${key}`,e);}
  }

  execAttack(f,type){
    const atk=ATK[type];if(!atk||f.attacking||f.atkCd>0)return;
    if(f.bareHanded&&!BARE_ATTACKS.has(type))return;
    if(f.stamina<(atk.sc||0)){return}
    f.stamina-=atk.sc||0;
    f.attacking=true;f.didHit=false;f.currentAtk=type;f.fi=0;f.ft=0;f.swingProgress=0;
    const wp=f.weaponPhysics,speedMs=wp?.speed||450,speedMod=450/Math.max(200,speedMs);
    const staminaPenalty=f.stamina<15?1.4:1;
    f.animFrames=atk.frames.map(fr=>({...fr,d:(fr.d/Math.max(0.3,speedMod))*staminaPenalty}));
    f.animLoop=false;f.target={...P[atk.frames[0].p]};
    if(atk.dash)f.vx=(f.facingRight?1:-1)*(type==='special_lunge'?14:10);
    if(atk.launches){f.vy=-3;}
    if(type.startsWith('special_'))f.specialCd=SPECIAL_CD;
    // ═══════ ATTACK GRUNT ═══════
    if(f.id===this.f[0]?.id){
      if(type==='jab'||type==='crouchJab'||type==='frontKick')this.playGrunt('grunt_hah');
      else if(type.startsWith('special_')||atk.baseDmg>=25)this.playGrunt('grunt_attack2');
      else this.playGrunt('grunt_attack');
    }
  }

  checkHit(atk,def){
    const a=ATK[atk.currentAtk];if(!a)return;
    const hitFrames=Array.isArray(a.hitF)?a.hitF:[a.hitF];
    if(!hitFrames.includes(atk.fi))return;
    if(a.multi){if(atk.didHit&&atk.fi===atk.lastHitFrame)return}
    else{if(atk.didHit)return}
    // I-frame check
    if(def.iframes>0)return;
    const dir=atk.facingRight?1:-1,hj=atk.pose[a.hj];if(!hj)return;
    const hx=atk.x+hj.x*dir*S,hy=atk.y+hj.y*S;
    const wp=atk.weaponPhysics,reachVal=wp?.reach||50;
    const reachScale=0.6+(reachVal/150)*0.8;
    if(Math.hypot(hx-def.x,hy-(def.y-20*S))>a.hr*S*reachScale)return;
    atk.didHit=true;atk.lastHitFrame=atk.fi;atk.hitStop=55;def.hitStop=55;
    // ═══════ HIT SOUND ═══════
    const aType=a.type;
    if(aType==='slash')this.sfx?.slash();
    else if(aType==='pierce')this.sfx?.pierce();
    else if(a.hj==='rFt')this.sfx?.kick();
    else if(a.baseDmg>=16)this.sfx?.heavyHit();
    else this.sfx?.lightHit();
    let dmg=a.baseDmg;
    if(wp){if(a.type==='slash')dmg+=(wp.slash||0)*0.6;if(a.type==='blunt')dmg+=(wp.blunt||0)*0.5;if(a.type==='pierce')dmg+=(wp.pierce||0)*0.6}
    if(a.damageMultiplier)dmg*=a.damageMultiplier;
    // Bare-handed damage reduction
    if(atk.bareHanded&&a.hj==='rHnd')dmg*=BARE_DMG;
    // Durability drain on attacker's weapon
    if(!atk.isDummy&&!atk.bareHanded)atk.weaponDur-=DUR_ON_HIT;

    const blocked=def.blocking&&!a.unblockable&&!a.pierceBlock;
    if(blocked){
      this.sfx?.block();
      if(def.parryTimer&&def.parryTimer>0){this.doParry(atk,def);return}
      const atkBB=wp?.blockBreak||0,defParry=def.weaponPhysics?.parry||0.3;
      if(atkBB>defParry+0.2){
        dmg*=0.8;def.hitStun=400;def.blocking=false;
        this.setAnim(def,[{d:120,p:'hitReact'},{d:120,p:'hitReact2'},{d:180,p:'idle1'}],false);
        this.cameras.main.shake(120,0.012);
      }else{
        // CHIP DAMAGE: 20% bleeds through block
        dmg*=CHIP_MULT;
        def.hitStun=100;
      }
      // Durability drain on defender block
      if(!def.isDummy&&!def.bareHanded)def.weaponDur-=DUR_ON_BLOCK;
    }else{
      def.hitStun=350;
      // GETTING HIT GRUNT — only for local player
      if(def.id===this.f[0]?.id)this.playGrunt('grunt_hit');
      // KNOCKDOWN: heavy attacks cause knockdown
      if(a.baseDmg>=KD_DMG_THRESH&&def.grounded&&!a.trips){
        this.triggerKnockdown(def,dir);
      }else{
        this.setAnim(def,[{d:100,p:'hitReact'},{d:100,p:'hitReact2'},{d:180,p:'idle1'}],false);
      }
    }
    // ═══════ ARMOR REDUCTION ═══════
    if(def.armor&&!def.armor.broken){
      const ar=def.armor;
      // Body armor always applies
      let reduction=0;
      if(ar.body.durability>0){
        reduction+=ar.body.reduction*0.7;
        ar.body.durability-=dmg*0.5; // armor absorbs half raw damage as wear
        if(ar.body.durability<=0){ar.body.durability=0;}
      }
      // Helmet applies to head-level attacks (uppercut, highKick, aerSlash, head-targeted)
      const headAttacks=['uppercut','highKick','aerSlash','spinJumpKick','special_shockwave','special_overpower'];
      if(ar.helmet.durability>0&&(headAttacks.includes(a.name)||Math.random()<0.3)){
        reduction+=ar.helmet.reduction*0.3;
        ar.helmet.durability-=dmg*0.3;
        if(ar.helmet.durability<=0){ar.helmet.durability=0;}
      }
      if(reduction>0){
        const absorbed=Math.round(dmg*reduction);
        dmg=Math.max(1,dmg-absorbed); // always deal at least 1
      }
      // Check if all armor broken
      if(ar.body.durability<=0&&ar.helmet.durability<=0){
        ar.broken=true;
        // Armor break visual: camera flash + particles
        this.cameras.main.flash(200,167,139,250,false,null,0.3);
      }
    }
    def.hp=Math.max(0,def.hp-dmg);
    // Register hit type for sprite animation variation
    if(def.useSprite&&def.spriteRenderer){def.spriteRenderer.registerHit(a.hj);}
    const kbDir=atk.facingRight?1:-1;def.vx=a.kb*kbDir*(wp?(0.8+(wp.mass||5)*0.04):1);
    if(a.trips&&def.grounded)def.vy=-4;
    if(a.launches){def.vy=-8;}
    if(a.stun){def.stunTimer=a.stun;def.hitStun=Math.max(def.hitStun,a.stun)}
    if(a.bleed){def.bleedTimer=a.bleedDuration||5000;def.bleedDPS=a.bleedDPS||2}

    // ═══════ VISUAL EFFECTS (enhanced) ═══════
    const shakeMag=clamp(dmg*0.0015,0.004,0.03);
    const shakeDur=clamp(80+dmg*5,80,350);
    if(a.type==='slash'){this.slashFx.setPosition(hx,hy);this.slashFx.emitParticle(20);this.cameras.main.shake(shakeDur,shakeMag)}
    if(a.type==='blunt'){this.bluntFx.setPosition(hx,hy);this.bluntFx.emitParticle(16);this.cameras.main.shake(shakeDur,shakeMag*1.3)}
    if(a.type==='pierce'){this.pierceFx.setPosition(hx,hy);this.pierceFx.emitParticle(22);this.cameras.main.shake(shakeDur*0.7,shakeMag*0.8)}
    if(a.aoe&&atk.currentAtk==='special_shockwave'){this.shockFx.setPosition(atk.x,FLOOR-10);this.shockFx.emitParticle(34);this.cameras.main.shake(300,0.025)}

    // Impact flash
    this.impactGfx.fillStyle(a.type==='slash'?0xfbbf24:a.type==='pierce'?0xf472b6:0xffffff,0.7);
    this.impactGfx.fillCircle(hx,hy,28);this.impactGfx.fillStyle(0xffffff,0.9);this.impactGfx.fillCircle(hx,hy,10);
    this.time.delayedCall(50,()=>{this.impactGfx.clear()});

    // Screen flash on big hits
    if(dmg>20)this.cameras.main.flash(100,255,255,255,true);

    atk.combo++;atk.comboT=COMBO_WIN;
    if(atk.combo>1){this.comboText.setText(`${atk.combo}x COMBO`);this.comboText.setAlpha(1);this.tweens.killTweensOf(this.comboText);this.tweens.add({targets:this.comboText,alpha:0,duration:700,delay:400})}
    if(atk.element==='fire'&&!blocked)for(let i=1;i<=3;i++)this.time.delayedCall(i*1000,()=>{if(def.hp>0)def.hp=Math.max(0,def.hp-1)});
    if(atk.element==='water')def.vx*=1.6;
    if(a.bounceHits&&a.bounceHits>1){let rem=a.bounceHits-1;const bh=()=>{if(rem<=0||def.hp<=0)return;rem--;def.hp=Math.max(0,def.hp-dmg*0.5);def.vx+=kbDir*2;this.slashFx.setPosition(def.x,def.y-20*S);this.slashFx.emitParticle(8);this.time.delayedCall(200,bh)};this.time.delayedCall(200,bh)}
  }

  triggerKnockdown(f,hitDir){
    f.knockedDown=true;f.kdTimer=KD_TIME+KD_RECOVER;f.kdRecovering=false;
    f.hitStun=KD_TIME+KD_RECOVER;
    f.vx=hitDir*6;f.vy=-4;
    this.setAnim(f,KD_ANIM.frames,false);
    this.cameras.main.shake(200,0.015);
    this.dustFx.setPosition(f.x,FLOOR);this.dustFx.emitParticle(10);
  }

  doParry(atk,def){
    atk.hitStun=500;atk.hitStop=80;
    this.setAnim(atk,[{d:120,p:'hitReact'},{d:180,p:'hitReact2'},{d:250,p:'idle1'}],false);
    this.cameras.main.flash(120,255,255,255,true);
    this.slashFx.setPosition((atk.x+def.x)/2,def.y-30*S);this.slashFx.emitParticle(24);
    this.sfx?.parry();
    // AUTO COUNTER-STRIKE after parry
    this.time.delayedCall(150,()=>{
      if(def.hp>0&&!def.attacking&&atk.hp>0){
        this.sfx?.counter();
        this.execAttack(def,'counterStrike');
      }
    });
  }

  setAnim(f,frames,loop){f.fi=0;f.ft=0;f.animFrames=frames;f.animLoop=loop;f.target={...P[frames[0].p]};f.attacking=false;f.currentAtk=null;f.swingProgress=0}

  handleInput(f){
    if(f.hitStun>0||f.hp<=0||f.stunTimer>0||f.dodging||f.knockedDown)return;
    if(this.keys.I.isDown&&!f.attacking){
      f.blocking=true;if(!f.parryTimer)f.parryTimer=PARRY_WIN;
      this.setAnim(f,this.keys.S.isDown?[{d:100,p:'crouch'}]:BLOCK_ANIM.frames,true);f.vx=0;return}
    if(f.blocking){f.blocking=false;f.parryTimer=0}
    if(f.attacking)return;
    if(this.keys.S.isDown&&f.grounded){f.crouching=true;this.setAnim(f,CROUCH_ANIM.frames,true);f.vx=0;return}
    f.crouching=false;
    let moving=false;
    if(this.keys.A.isDown){f.vx=-SPD;moving=true}else if(this.keys.D.isDown){f.vx=SPD;moving=true}else{f.vx*=0.7}
    const opp=this.f.find(o=>o.id!==f.id);if(opp)f.facingRight=opp.x>f.x;
    if(this.keys.W.isDown&&f.grounded){f.vy=JUMP;f.grounded=false}
    if(!f.attacking&&!f.blocking&&!f.crouching){
      if(moving&&f.grounded){const fwd=(f.facingRight&&f.vx>0)||(!f.facingRight&&f.vx<0);this.setAnim(f,fwd?WALK_ANIM.frames:[{d:200,p:'walkF3'},{d:200,p:'walkF4'},{d:200,p:'walkF1'},{d:200,p:'walkF2'}],true)}
      else if(f.grounded)this.setAnim(f,IDLE_ANIM.frames,true)}
  }

  dummyLogic(f){if(f.hp<=0)return;const t=this.f.find(o=>o.id!==f.id);if(t)f.facingRight=t.x>f.x;if(t?.attacking&&Math.random()<0.02){f.blocking=true;this.setAnim(f,BLOCK_ANIM.frames,true)}else if(f.blocking&&Math.random()<0.05){f.blocking=false;this.setAnim(f,IDLE_ANIM.frames,true)}}

  updateFighter(f,dt){
    if(f.hitStop>0){f.hitStop-=dt;return}
    f.wasAirborne=!f.grounded;

    // ═══════ STAMINA REGEN ═══════
    if(!f.attacking&&!f.dodging){
      const drain=f.blocking?STAM_BLOCK_DRAIN*(dt/1000):0;
      f.stamina=clamp(f.stamina-drain+STAM_REGEN*(dt/1000),0,f.maxStamina);
    }

    // ═══════ DODGE UPDATE ═══════
    if(f.dodging){
      f.dodgeTimer-=dt;f.iframes-=dt;
      f.vx=f.dodgeDir*DODGE_SPD;
      if(f.dodgeTimer<=0){f.dodging=false;f.iframes=0;this.setAnim(f,IDLE_ANIM.frames,true)}
    }
    if(f.iframes>0&&!f.dodging)f.iframes-=dt;

    // ═══════ KNOCKDOWN UPDATE ═══════
    if(f.knockedDown){
      f.kdTimer-=dt;
      if(f.kdTimer<=KD_RECOVER&&!f.kdRecovering){f.kdRecovering=true}
      if(f.kdTimer<=0){f.knockedDown=false;f.kdRecovering=false;f.kdInvuln=200;f.hitStun=0;this.setAnim(f,IDLE_ANIM.frames,true)}
    }
    if(f.kdInvuln>0){f.kdInvuln-=dt;f.iframes=f.kdInvuln}

    // ═══════ WEAPON DURABILITY ═══════
    if(!f.isDummy&&!f.bareHanded&&f.weaponDur>0){
      f.weaponDur-=DUR_PASSIVE*(dt/1000);
      // Faster drain on attacks
      if(f.attacking)f.weaponDur-=DUR_PASSIVE*0.5*(dt/1000);
      if(f.weaponDur<=0){
        f.weaponDur=0;
        this.weaponBreak(f);
      }
    }

    if(!f.grounded){f.vy+=GRAV;f.y+=f.vy;if(f.y>=FLOOR){f.y=FLOOR;f.vy=0;f.grounded=true;f.landDust=true}}
    f.x+=f.vx;f.vx*=0.9;f.x=Math.max(50,Math.min(W-50,f.x));
    if(f.hitStun>0&&!f.knockedDown){f.hitStun-=dt;if(f.hitStun<=0&&f.hp>0)this.setAnim(f,IDLE_ANIM.frames,true)}
    if(f.atkCd>0)f.atkCd-=dt;if(f.comboT>0){f.comboT-=dt;if(f.comboT<=0)f.combo=0}
    if(f.specialCd>0)f.specialCd-=dt;if(f.parryTimer>0)f.parryTimer-=dt;
    if(f.stunTimer>0)f.stunTimer-=dt;
    if(f.bleedTimer>0&&f.hp>0){f.bleedTimer-=dt;f.hp=Math.max(0,f.hp-(f.bleedDPS||2)*(dt/1000));if(Math.random()<0.04){this.bleedFx.setPosition(f.x,f.y-20*S);this.bleedFx.emitParticle(3)}}
    if(f.landDust&&f.wasAirborne){this.dustFx.setPosition(f.x,FLOOR);this.dustFx.emitParticle(8);f.landDust=false}
    // Trails
    if(f.attacking){f.trailTimer-=dt;if(f.trailTimer<=0){f.trails.push({pose:{...f.pose},x:f.x,y:f.y,alpha:0.25,life:180});if(f.trails.length>4)f.trails.shift();f.trailTimer=45}const td=f.animFrames.reduce((s,fr)=>s+fr.d,0),el=f.animFrames.slice(0,f.fi).reduce((s,fr)=>s+fr.d,0)+f.ft;f.swingProgress=clamp(el/td,0,1)}
    else f.trails=[];
    for(const tr of f.trails){tr.life-=dt;tr.alpha*=0.9}f.trails=f.trails.filter(tr=>tr.life>0&&tr.alpha>0.02);
    // Animation
    f.ft+=dt;
    const rate=f.attacking?0.04+f.swingEasing(f.swingProgress)*0.02:0.022;
    f.pose=lerpPose(f.pose,f.target,Math.min(1,dt*rate));
    const fr=f.animFrames?.[f.fi];
    if(fr&&f.ft>=fr.d){f.ft=0;f.fi++;if(f.fi>=f.animFrames.length){if(f.animLoop)f.fi=0;else{f.fi=f.animFrames.length-1;if(f.attacking){f.attacking=false;f.atkCd=140;f.currentAtk=null;f.swingProgress=0;this.setAnim(f,IDLE_ANIM.frames,true)}}}const nf=f.animFrames[f.fi];if(nf)f.target={...P[nf.p]}}
  }

  weaponBreak(f){
    // Visual shatter
    const hnd=f.pose.rHnd;
    const dir=f.facingRight?1:-1;
    const sx=f.x+(hnd?.x||0)*dir*S,sy=f.y+(hnd?.y||0)*S;
    this.shatterFx.setPosition(sx,sy);this.shatterFx.emitParticle(24);
    this.cameras.main.shake(100,0.008);
    // Enter bare-handed
    f.bareHanded=true;f.weaponVerts=[];f.weaponPhysics=null;f.weaponSpecial=null;
    f.reforging=true;
    // Notify React
    if(f.id===this.f[0]?.id){
      this.onEvent('weaponBreak',{fighterId:f.id});
    }
  }

  // Called from React when player picks/draws new weapon
  reforgeWeapon(weaponData){
    const f=this.f[0];if(!f)return;
    f.reforging=false;
    if(weaponData){
      f.bareHanded=false;
      f.weaponVerts=normalizeVertices(weaponData.vertices||weaponData.allPoints||[],32);
      f.weaponPhysics=weaponData.physics||null;
      f.weaponSpecial=weaponData.special||null;
      f.weaponDur=f.maxDur;
      if(f.weaponPhysics?.swingArcEasing==='easeInCubic')f.swingEasing=easeInCubic;
      else f.swingEasing=easeOutQuad;
    }
    // else stays bare-handed
  }

  goBarehanded(){
    const f=this.f[0];if(!f)return;
    f.reforging=false;
    // stays bareHanded
  }

  drawFighter(f,dt){
    const g=f.gfx,gg=f.glowGfx,tg=f.trailGfx,ag=f.armorGfx;
    const dir=f.facingRight?1:-1,cx=f.x,cy=f.y,p=f.pose;
    const c=parseInt(f.colorHex.slice(1),16);
    g.clear();gg.clear();tg.clear();if(ag)ag.clear();

    // Compute world joint positions (needed for weapon position even with sprite)
    const wj={};for(const k in p)wj[k]={x:cx+p[k].x*dir*S,y:cy+p[k].y*S};wj.hip={x:cx,y:cy};

    // ═══════ SPRITE PATH (any fighter with sprite) ═══════
    if(f.useSprite&&f.spriteRenderer){
      // Update sprite animation & position
      f.spriteRenderer.update(f,dt);

      // ═══════ SHADOW CHARACTER GLOW — body-wrapping energy field ═══════
      const t=Date.now()*0.001;
      const glowPulse=0.75+Math.sin(t*3)*0.25;
      const flicker=Math.random()>0.92?0.6:1;
      const glowA=glowPulse*flicker;

      // Outer ambient aura
      gg.fillStyle(c,0.04*glowA);gg.fillCircle(cx,cy-22*S,90*S);
      // Body contour ellipse (vertical)
      gg.fillStyle(c,0.08*glowA);gg.fillEllipse(cx,cy-18*S,40*S,62*S);
      // Inner hot core
      gg.fillStyle(c,0.16*glowA);gg.fillEllipse(cx,cy-18*S,28*S,48*S);
      // Tight center
      gg.fillStyle(c,0.06);gg.fillEllipse(cx,cy-18*S,18*S,32*S);

      // ═══ Lightning arcs between body positions ═══
      const jpts=[
        {x:cx-12*S*dir,y:cy-40*S},{x:cx+6*S*dir,y:cy-30*S},
        {x:cx-8*S*dir,y:cy-10*S},{x:cx+10*S*dir,y:cy},
        {x:cx-6*S*dir,y:cy+15*S},{x:cx+8*S*dir,y:cy+25*S}
      ];
      // Draw 2-3 lightning bolts between random joint pairs
      const arcCount=2+Math.floor(Math.sin(t*5)*1.5);
      gg.lineStyle(1.5,c,0.5*glowA);
      for(let a=0;a<arcCount;a++){
        const i1=Math.floor(Math.abs(Math.sin(t*7+a*2.1))*jpts.length);
        const i2=Math.min(jpts.length-1,i1+1+Math.floor(Math.abs(Math.cos(t*5+a))*2));
        const p1=jpts[i1],p2=jpts[i2];
        const segs=4+Math.floor(Math.random()*3);
        gg.beginPath();gg.moveTo(p1.x,p1.y);
        for(let s=1;s<=segs;s++){
          const frac=s/segs;
          const mx=p1.x+(p2.x-p1.x)*frac+(Math.random()-0.5)*16*S;
          const my=p1.y+(p2.y-p1.y)*frac+(Math.random()-0.5)*8*S;
          gg.lineTo(mx,my);
        }
        gg.strokePath();
      }

      // ═══ Rim energy ring (wraps around body) ═══
      const ringY=cy-18*S;
      const ringRx=36*S,ringRy=12*S;
      const ringPhase=t*2;
      gg.lineStyle(2,c,0.3*glowA);
      gg.beginPath();
      for(let i=0;i<=32;i++){
        const ang=ringPhase+i*(Math.PI*2/32);
        const px=cx+Math.cos(ang)*ringRx;
        const py=ringY+Math.sin(ang)*ringRy;
        if(i===0)gg.moveTo(px,py);else gg.lineTo(px,py);
      }
      gg.strokePath();
      // Second ring offset
      gg.lineStyle(1.5,c,0.18*glowA);
      gg.beginPath();
      for(let i=0;i<=32;i++){
        const ang=-ringPhase*0.7+i*(Math.PI*2/32);
        const px=cx+Math.cos(ang)*(ringRx+6*S);
        const py=(ringY-10*S)+Math.sin(ang)*(ringRy+4*S);
        if(i===0)gg.moveTo(px,py);else gg.lineTo(px,py);
      }
      gg.strokePath();

      // ═══ Ground interaction — light pool ═══
      const groundFlicker=0.7+Math.sin(t*4)*0.3;
      gg.fillStyle(c,0.10*groundFlicker);gg.fillEllipse(cx,f.y+2,70*S,8*S);
      gg.fillStyle(c,0.06*groundFlicker);gg.fillEllipse(cx,f.y+4,100*S,5*S);
      // Ground caustics (moving light dots on floor)
      for(let i=0;i<4;i++){
        const gx=cx+Math.sin(t*3+i*1.7)*40*S;
        const gy=f.y+2+Math.cos(t*2+i)*3;
        gg.fillStyle(c,0.15*groundFlicker);gg.fillCircle(gx,gy,2.5*S);
      }

      // ═══ Floating energy particles ═══
      for(let i=0;i<6;i++){
        const px=cx+Math.sin(t*1.5+i*1.05)*45*S;
        const py=cy-22*S+Math.cos(t*2+i*0.8)*50*S;
        const pa=0.15+Math.sin(t*4+i*1.3)*0.15;
        gg.fillStyle(c,pa*glowA);gg.fillCircle(px,py,1.5+Math.sin(t*3+i)*0.8);
      }

      // Bleed indicator
      if(f.bleedTimer>0){g.lineStyle(2,0xf87171,0.3+Math.sin(Date.now()*0.008)*0.2);g.strokeCircle(cx,cy-20*S,30*S)}

      // ═══════ HOLOGRAPHIC ARMOR OVERLAY on sprite ═══════
      if(f.armor&&!f.armor.broken){
        // Update user-drawn armor sprite position + holographic FX
        if(f.armorSprite){
          const at=Date.now()*0.001;
          const armorPulse=0.45+Math.sin(at*3)*0.15;
          const armorFlicker=Math.random()>0.95?0.25:1;
          const armorColor=parseInt(f.colorHex.slice(1),16);
          f.armorSprite.setPosition(cx,cy-18*S);
          f.armorSprite.setAlpha(armorPulse*armorFlicker);
          f.armorSprite.setTint(armorColor);
          f.armorSprite.setFlipX(dir<0);
          // Holographic scan line via armorGfx
          if(ag){
            const scanY2=(cy-55*S)+((at*60)%(70*S));
            ag.lineStyle(1.5,armorColor,0.3*armorPulse);
            ag.lineBetween(cx-25*S,scanY2,cx+25*S,scanY2);
            // Edge glow outline around armor
            ag.lineStyle(1,armorColor,0.2*armorPulse);
            ag.strokeRect(cx-22*S,cy-50*S,44*S,60*S);
          }
        }else if(ag){
          // Fallback: graphics-based holographic armor if no sprite loaded
          const ar=f.armor;const at=Date.now()*0.001;
          const armorFlicker=Math.random()>0.95?0.5:1;

          if(ar.helmet&&ar.helmet.durability>0){
            const hdp=clamp(ar.helmet.durability/ar.helmet.maxDurability,0,1);
            const hColor=ar.helmet.tier==='heavy'?0xfbbf24:ar.helmet.tier==='medium'?0xa78bfa:0x60a5fa;
            const hx=wj.head.x,hy=wj.head.y,hr=20*S;
            const visorPulse=0.7+Math.sin(at*4)*0.3;
            ag.fillStyle(hColor,0.06*hdp*visorPulse);ag.fillCircle(hx,hy-4*S,hr+6*S);
            ag.lineStyle(3,hColor,0.8*hdp*visorPulse*armorFlicker);
            ag.beginPath();ag.arc(hx,hy-2*S,hr,-Math.PI*0.85,-Math.PI*0.15,false);ag.strokePath();
            ag.lineStyle(1.5,hColor,0.4*hdp*visorPulse);
            ag.beginPath();ag.arc(hx,hy-2*S,hr-4*S,-Math.PI*0.8,-Math.PI*0.2,false);ag.strokePath();
          }
          if(ar.body&&ar.body.durability>0){
            const bdp=clamp(ar.body.durability/ar.body.maxDurability,0,1);
            const bColor=ar.body.tier==='heavy'?0xfbbf24:ar.body.tier==='medium'?0xa78bfa:0x60a5fa;
            const bodyPulse=0.65+Math.sin(at*3.5)*0.35;
            const chestX=cx,chestY=wj.chest?wj.chest.y:(cy-30*S);
            ag.fillStyle(bColor,0.07*bdp*bodyPulse);
            ag.beginPath();ag.moveTo(chestX,chestY-10*S);ag.lineTo(chestX+11*S,chestY);ag.lineTo(chestX+11*S,chestY+10*S);ag.lineTo(chestX,chestY+15*S);ag.lineTo(chestX-11*S,chestY+10*S);ag.lineTo(chestX-11*S,chestY);ag.closePath();ag.fillPath();
            ag.lineStyle(2.5,bColor,0.7*bdp*bodyPulse*armorFlicker);
            ag.beginPath();ag.moveTo(chestX,chestY-10*S);ag.lineTo(chestX+11*S,chestY);ag.lineTo(chestX+11*S,chestY+10*S);ag.lineTo(chestX,chestY+15*S);ag.lineTo(chestX-11*S,chestY+10*S);ag.lineTo(chestX-11*S,chestY);ag.closePath();ag.strokePath();
          }
        }
      }

      // WEAPON overlay on sprite — use sprite hand position instead of pose data
      if(f.weaponVerts.length>=3&&!f.bareHanded){
        const durPct=clamp(f.weaponDur/f.maxDur,0,1);
        const weaponAlpha=durPct>0.25?(0.5+durPct*0.5):(0.2+Math.sin(Date.now()*0.02)*0.2);
        const weaponTint=durPct>0.5?0xe8eaf6:durPct>0.25?0xfbbf24:0xf87171;
        const hnd=f.spriteRenderer.getHandWorldPos(f);let angle;
        if(f.attacking){const pr=f.swingEasing(f.swingProgress);angle=dir>0?-0.9+pr*1.4:0.9-pr*1.4}else angle=dir>0?0.3:-0.3;
        const cos=Math.cos(angle),sin=Math.sin(angle);
        if(f.attacking){g.lineStyle(5,c,0.2*weaponAlpha);g.beginPath();const v0=f.weaponVerts[0];g.moveTo(hnd.x+(v0.x*cos-v0.y*sin)*dir,hnd.y+(v0.x*sin+v0.y*cos));for(let i=1;i<f.weaponVerts.length;i++){const v=f.weaponVerts[i];g.lineTo(hnd.x+(v.x*cos-v.y*sin)*dir,hnd.y+(v.x*sin+v.y*cos))}g.closePath();g.strokePath()}
        g.lineStyle(2.5,weaponTint,0.9*weaponAlpha);g.beginPath();const v02=f.weaponVerts[0];g.moveTo(hnd.x+(v02.x*cos-v02.y*sin)*dir,hnd.y+(v02.x*sin+v02.y*cos));for(let i=1;i<f.weaponVerts.length;i++){const v=f.weaponVerts[i];g.lineTo(hnd.x+(v.x*cos-v.y*sin)*dir,hnd.y+(v.x*sin+v.y*cos))}g.closePath();g.strokePath();
        if(durPct<0.3&&Math.random()<0.05){this.shatterFx.setPosition(hnd.x,hnd.y);this.shatterFx.emitParticle(2)}
      }
      if(f.nameGfx)f.nameGfx.setPosition(f.x,f.y+48*S);
      return; // Skip stick-figure drawing for sprite-based fighter
    }

    // ═══════ STICK-FIGURE PATH (P2 / non-sprite fighters) ═══════
    // Dodge alpha flash
    const dodgeAlpha=f.dodging?(0.3+Math.sin(Date.now()*0.03)*0.2):1;
    const kdAlpha=f.knockedDown?(0.6+Math.sin(Date.now()*0.015)*0.15):1;
    const invulnAlpha=f.kdInvuln>0?(0.5+Math.sin(Date.now()*0.04)*0.3):1;
    const alpha=Math.min(dodgeAlpha,kdAlpha,invulnAlpha);
    g.setAlpha(alpha);

    // Trails
    for(const tr of f.trails){tg.fillStyle(c,tr.alpha*0.3);const tw={};for(const k in tr.pose)tw[k]={x:tr.x+tr.pose[k].x*dir*S,y:tr.y+tr.pose[k].y*S};tw.hip={x:tr.x,y:tr.y};taperedLimb(tg,tw.hip.x,tw.hip.y,tw.chest.x,tw.chest.y,22*S,26*S);taperedLimb(tg,tw.rSh.x,tw.rSh.y,tw.rElb.x,tw.rElb.y,11*S,9*S);taperedLimb(tg,tw.rElb.x,tw.rElb.y,tw.rHnd.x,tw.rHnd.y,9*S,7*S);tg.fillCircle(tw.head.x,tw.head.y,16*S)}

    // ═══════ SHADOW CHARACTER GLOW — body-wrapping energy for stick-figure ═══════
    const t2=Date.now()*0.001;
    const glowPulse2=0.75+Math.sin(t2*3)*0.25;
    const flicker2=Math.random()>0.92?0.6:1;
    const glowA2=glowPulse2*flicker2;

    // Body contour ellipse
    gg.fillStyle(c,0.04*glowA2);gg.fillCircle(cx,cy-22*S,90*S);
    gg.fillStyle(c,0.08*glowA2);gg.fillEllipse(cx,cy-18*S,40*S,62*S);
    gg.fillStyle(c,0.16*glowA2);gg.fillEllipse(cx,cy-18*S,28*S,48*S);
    gg.fillStyle(c,0.06);gg.fillEllipse(cx,cy-18*S,18*S,32*S);

    // Lightning arcs along limbs
    gg.lineStyle(1.5,c,0.5*glowA2);
    const limbs=[[wj.rSh,wj.rElb],[wj.rElb,wj.rHnd],[wj.rHip,wj.rKne],[wj.rKne,wj.rFt],[wj.chest||wj.rSh,wj.head]];
    for(const[la,lb]of limbs){
      if(Math.sin(t2*7+la.x*0.01)>0.3){
        const segs=3;gg.beginPath();gg.moveTo(la.x,la.y);
        for(let s=1;s<=segs;s++){
          const fr=s/segs;
          gg.lineTo(la.x+(lb.x-la.x)*fr+(Math.random()-0.5)*10*S,la.y+(lb.y-la.y)*fr+(Math.random()-0.5)*6*S);
        }
        gg.strokePath();
      }
    }

    // Rim energy ring
    const ringY2=cy-18*S;
    gg.lineStyle(2,c,0.3*glowA2);
    gg.beginPath();
    for(let i=0;i<=32;i++){
      const ang=t2*2+i*(Math.PI*2/32);
      const px=cx+Math.cos(ang)*36*S;
      const py=ringY2+Math.sin(ang)*12*S;
      if(i===0)gg.moveTo(px,py);else gg.lineTo(px,py);
    }
    gg.strokePath();

    // Ground light pool
    const gf2=0.7+Math.sin(t2*4)*0.3;
    gg.fillStyle(c,0.10*gf2);gg.fillEllipse(cx,f.y+2,70*S,8*S);
    gg.fillStyle(c,0.06*gf2);gg.fillEllipse(cx,f.y+4,100*S,5*S);
    for(let i=0;i<4;i++){
      const gx=cx+Math.sin(t2*3+i*1.7)*40*S;
      gg.fillStyle(c,0.15*gf2);gg.fillCircle(gx,f.y+2,2.5*S);
    }
    // Floating particles
    for(let i=0;i<6;i++){
      const px=cx+Math.sin(t2*1.5+i*1.05)*45*S;
      const py=cy-22*S+Math.cos(t2*2+i*0.8)*50*S;
      const pa=0.15+Math.sin(t2*4+i*1.3)*0.15;
      gg.fillStyle(c,pa*glowA2);gg.fillCircle(px,py,1.5+Math.sin(t2*3+i)*0.8);
    }

    const bd=f.stunTimer>0?0x1a0828:0x060610;const bm=f.stunTimer>0?0x200a30:0x0a0a18;
    g.fillStyle(bd);taperedLimb(g,wj.lHip.x,wj.lHip.y,wj.lKne.x,wj.lKne.y,16*S,13*S);taperedLimb(g,wj.lKne.x,wj.lKne.y,wj.lFt.x,wj.lFt.y,13*S,10*S);g.fillRoundedRect(wj.lFt.x-5*S,wj.lFt.y-4*S,12*S*dir,8*S,3);g.fillCircle(wj.lFt.x,wj.lFt.y,5*S);
    g.fillStyle(bd);taperedLimb(g,wj.lSh.x,wj.lSh.y,wj.lElb.x,wj.lElb.y,12*S,10*S);taperedLimb(g,wj.lElb.x,wj.lElb.y,wj.lHnd.x,wj.lHnd.y,10*S,8*S);g.fillStyle(bm);fist(g,wj.lHnd.x,wj.lHnd.y,7*S);
    g.fillStyle(bd);torso(g,wj.lSh,wj.rSh,wj.lHip,wj.rHip);taperedLimb(g,wj.lSh.x,wj.lSh.y,wj.rSh.x,wj.rSh.y,15*S,15*S);taperedLimb(g,wj.lHip.x,wj.lHip.y,wj.rHip.x,wj.rHip.y,16*S,16*S);
    g.fillStyle(bm,0.3);const tcx2=(wj.lSh.x+wj.rSh.x)/2,tcy2=(wj.chest.y+wj.hip.y)/2;g.fillRoundedRect(tcx2-6*S,tcy2-6*S,12*S,14*S,2);
    g.fillStyle(bd);taperedLimb(g,wj.chest.x,wj.chest.y,wj.head.x,wj.head.y+10*S,10*S,8*S);
    g.fillStyle(bd);taperedLimb(g,wj.rHip.x,wj.rHip.y,wj.rKne.x,wj.rKne.y,17*S,14*S);taperedLimb(g,wj.rKne.x,wj.rKne.y,wj.rFt.x,wj.rFt.y,14*S,11*S);g.fillCircle(wj.rKne.x,wj.rKne.y,7*S);g.fillRoundedRect(wj.rFt.x-5*S,wj.rFt.y-4*S,14*S*dir,9*S,3);g.fillCircle(wj.rFt.x,wj.rFt.y,5.5*S);
    g.fillStyle(bd);g.fillCircle(wj.rSh.x,wj.rSh.y,8*S);taperedLimb(g,wj.rSh.x,wj.rSh.y,wj.rElb.x,wj.rElb.y,13*S,11*S);taperedLimb(g,wj.rElb.x,wj.rElb.y,wj.rHnd.x,wj.rHnd.y,11*S,8*S);g.fillCircle(wj.rElb.x,wj.rElb.y,6*S);g.fillStyle(bm);fist(g,wj.rHnd.x,wj.rHnd.y,8*S);
    g.fillStyle(bd);head(g,wj.head.x,wj.head.y,16*S,dir,c,f.hitStun>0);

    // Accent outlines
    g.lineStyle(2,c,0.45);g.lineBetween(wj.lSh.x,wj.lSh.y,wj.rSh.x,wj.rSh.y);g.lineBetween(wj.lSh.x-3*S,wj.lSh.y,wj.lHip.x-1*S,wj.lHip.y);g.lineBetween(wj.rSh.x+3*S,wj.rSh.y,wj.rHip.x+1*S,wj.rHip.y);g.strokeCircle(wj.head.x,wj.head.y,16*S);
    g.lineStyle(1.5,c,0.35);g.lineBetween(wj.rSh.x,wj.rSh.y,wj.rElb.x,wj.rElb.y);g.lineBetween(wj.rElb.x,wj.rElb.y,wj.rHnd.x,wj.rHnd.y);g.lineBetween(wj.rHip.x,wj.rHip.y,wj.rKne.x,wj.rKne.y);g.lineBetween(wj.rKne.x,wj.rKne.y,wj.rFt.x,wj.rFt.y);
    g.lineStyle(1,c,0.2);g.lineBetween(wj.lSh.x,wj.lSh.y,wj.lElb.x,wj.lElb.y);g.lineBetween(wj.lElb.x,wj.lElb.y,wj.lHnd.x,wj.lHnd.y);g.lineBetween(wj.lHip.x,wj.lHip.y,wj.lKne.x,wj.lKne.y);g.lineBetween(wj.lKne.x,wj.lKne.y,wj.lFt.x,wj.lFt.y);

    // ═══════ HOLOGRAPHIC ARMOR (stick-figure path) ═══════
    if(f.armor&&!f.armor.broken){
      if(f.armorSprite){
        const at2=Date.now()*0.001;
        const armorPulse2=0.45+Math.sin(at2*3)*0.15;
        const armorFlicker2=Math.random()>0.95?0.25:1;
        const armorColor2=parseInt(f.colorHex.slice(1),16);
        f.armorSprite.setPosition(cx,cy-18*S);
        f.armorSprite.setAlpha(armorPulse2*armorFlicker2);
        f.armorSprite.setTint(armorColor2);
        f.armorSprite.setFlipX(dir<0);
        if(ag){
          const scanLine=(cy-55*S)+((at2*60)%(70*S));
          ag.lineStyle(1.5,armorColor2,0.3*armorPulse2);
          ag.lineBetween(cx-25*S,scanLine,cx+25*S,scanLine);
          ag.lineStyle(1,armorColor2,0.2*armorPulse2);
          ag.strokeRect(cx-22*S,cy-50*S,44*S,60*S);
        }
      }else if(ag){
      const ar=f.armor;const at2=Date.now()*0.001;
      const af2=Math.random()>0.95?0.5:1;

      if(ar.helmet&&ar.helmet.durability>0){
        const hdp=clamp(ar.helmet.durability/ar.helmet.maxDurability,0,1);
        const hColor=ar.helmet.tier==='heavy'?0xfbbf24:ar.helmet.tier==='medium'?0xa78bfa:0x60a5fa;
        const hx=wj.head.x,hy=wj.head.y,hr=20*S;
        const vp=0.7+Math.sin(at2*4)*0.3;
        ag.fillStyle(hColor,0.06*hdp*vp);ag.fillCircle(hx,hy-4*S,hr+6*S);
        ag.lineStyle(3,hColor,0.8*hdp*vp*af2);
        ag.beginPath();ag.arc(hx,hy-2*S,hr,-Math.PI*0.85,-Math.PI*0.15,false);ag.strokePath();
        ag.lineStyle(1.5,hColor,0.4*hdp*vp);
        ag.beginPath();ag.arc(hx,hy-2*S,hr-4*S,-Math.PI*0.8,-Math.PI*0.2,false);ag.strokePath();
        const scanY2=hy-hr+(at2*40%hr*2);
        if(scanY2>hy-hr&&scanY2<hy+hr*0.3){ag.lineStyle(1,hColor,0.5*hdp);ag.lineBetween(hx-hr*0.8,scanY2,hx+hr*0.8,scanY2)}
        for(let i=0;i<4;i++){const da=-Math.PI*0.85+i*(Math.PI*0.7/3);ag.fillStyle(hColor,0.6*hdp*vp);ag.fillCircle(hx+Math.cos(da+at2*0.5)*(hr+3*S),(hy-2*S)+Math.sin(da+at2*0.5)*(hr+3*S),1.5)}
      }

      if(ar.body&&ar.body.durability>0){
        const bdp=clamp(ar.body.durability/ar.body.maxDurability,0,1);
        const bColor=ar.body.tier==='heavy'?0xfbbf24:ar.body.tier==='medium'?0xa78bfa:0x60a5fa;
        const bp=0.65+Math.sin(at2*3.5)*0.35;
        const chX=cx,chY=wj.chest?wj.chest.y:(cy-30*S),hiY=cy;
        // Shoulders
        const ls=cx-14*S*dir,rs=cx+14*S*dir,sy3=chY+2*S;
        ag.fillStyle(bColor,0.10*bdp*bp);ag.fillCircle(ls,sy3,8*S);ag.fillCircle(rs,sy3,8*S);
        ag.lineStyle(2,bColor,0.6*bdp*bp*af2);ag.strokeCircle(ls,sy3,8*S);ag.strokeCircle(rs,sy3,8*S);
        // Chest hex
        const cpW=22*S,cpH=20*S,cpY=chY+6*S;
        ag.fillStyle(bColor,0.07*bdp*bp);
        ag.beginPath();ag.moveTo(chX,cpY-cpH*0.5);ag.lineTo(chX+cpW*0.5,cpY-cpH*0.25);ag.lineTo(chX+cpW*0.5,cpY+cpH*0.25);ag.lineTo(chX,cpY+cpH*0.5);ag.lineTo(chX-cpW*0.5,cpY+cpH*0.25);ag.lineTo(chX-cpW*0.5,cpY-cpH*0.25);ag.closePath();ag.fillPath();
        ag.lineStyle(2.5,bColor,0.7*bdp*bp*af2);
        ag.beginPath();ag.moveTo(chX,cpY-cpH*0.5);ag.lineTo(chX+cpW*0.5,cpY-cpH*0.25);ag.lineTo(chX+cpW*0.5,cpY+cpH*0.25);ag.lineTo(chX,cpY+cpH*0.5);ag.lineTo(chX-cpW*0.5,cpY+cpH*0.25);ag.lineTo(chX-cpW*0.5,cpY-cpH*0.25);ag.closePath();ag.strokePath();
        ag.lineStyle(1,bColor,0.25*bdp);ag.lineBetween(chX,cpY-cpH*0.5,chX,cpY+cpH*0.5);ag.lineBetween(chX-cpW*0.45,cpY,chX+cpW*0.45,cpY);
        // Core node
        const cr=4*S,cop=0.5+Math.sin(at2*6)*0.5;
        ag.fillStyle(bColor,0.25*bdp*cop);ag.fillCircle(chX,cpY,cr);ag.lineStyle(1.5,bColor,0.6*bdp*cop);ag.strokeCircle(chX,cpY,cr);
        // Hips
        ag.fillStyle(bColor,0.06*bdp*bp);ag.fillRect(chX-9*S,hiY-6*S,18*S,12*S);
        ag.lineStyle(2,bColor,0.5*bdp*bp*af2);ag.strokeRect(chX-9*S,hiY-6*S,18*S,12*S);
        // Shield contour
        ag.lineStyle(1.5,bColor,0.15*bdp*(0.4+Math.sin(at2*2)*0.15));
        ag.beginPath();for(let i=0;i<=24;i++){const ang=i*(Math.PI*2/24);const rx=30*S+Math.sin(at2*3+i*0.5)*3*S;const ry=50*S+Math.cos(at2*2+i*0.3)*4*S;const px2=chX+Math.cos(ang)*rx;const py2=((chY+hiY)/2)+Math.sin(ang)*ry;if(i===0)ag.moveTo(px2,py2);else ag.lineTo(px2,py2)}ag.closePath();ag.strokePath();
        // Circuit lines
        ag.lineStyle(1,bColor,0.3*bdp*bp);
        ag.lineBetween(ls,sy3+6*S,chX-cpW*0.3,cpY-cpH*0.3);ag.lineBetween(rs,sy3+6*S,chX+cpW*0.3,cpY-cpH*0.3);
        ag.lineBetween(chX-cpW*0.2,cpY+cpH*0.4,chX-9*S,hiY-6*S);ag.lineBetween(chX+cpW*0.2,cpY+cpH*0.4,chX+9*S,hiY-6*S);
      }
      } // close else if(ag)
    }

    if(f.bleedTimer>0){g.lineStyle(2,0xf87171,0.3+Math.sin(Date.now()*0.008)*0.2);g.strokeCircle(cx,cy-20*S,30*S)}

    // WEAPON — with durability visual
    if(f.weaponVerts.length>=3&&!f.bareHanded){
      const durPct=clamp(f.weaponDur/f.maxDur,0,1);
      const weaponAlpha=durPct>0.25?(0.5+durPct*0.5):(0.2+Math.sin(Date.now()*0.02)*0.2);
      const weaponTint=durPct>0.5?0xe8eaf6:durPct>0.25?0xfbbf24:0xf87171;
      const hnd=wj.rHnd;let angle;
      if(f.attacking){const pr=f.swingEasing(f.swingProgress);angle=dir>0?-0.9+pr*1.4:0.9-pr*1.4}else angle=dir>0?0.3:-0.3;
      const cos=Math.cos(angle),sin=Math.sin(angle);
      if(f.attacking){g.lineStyle(5,c,0.2*weaponAlpha);g.beginPath();const v0=f.weaponVerts[0];g.moveTo(hnd.x+(v0.x*cos-v0.y*sin)*dir,hnd.y+(v0.x*sin+v0.y*cos));for(let i=1;i<f.weaponVerts.length;i++){const v=f.weaponVerts[i];g.lineTo(hnd.x+(v.x*cos-v.y*sin)*dir,hnd.y+(v.x*sin+v.y*cos))}g.closePath();g.strokePath()}
      g.lineStyle(2.5,weaponTint,0.9*weaponAlpha);g.beginPath();const v0=f.weaponVerts[0];g.moveTo(hnd.x+(v0.x*cos-v0.y*sin)*dir,hnd.y+(v0.x*sin+v0.y*cos));for(let i=1;i<f.weaponVerts.length;i++){const v=f.weaponVerts[i];g.lineTo(hnd.x+(v.x*cos-v.y*sin)*dir,hnd.y+(v.x*sin+v.y*cos))}g.closePath();g.strokePath();

      // Durability warning particles when low
      if(durPct<0.3&&Math.random()<0.05){
        this.shatterFx.setPosition(hnd.x,hnd.y);this.shatterFx.emitParticle(2);
      }
    }
    g.setAlpha(1); // reset alpha
    if(f.nameGfx)f.nameGfx.setPosition(f.x,f.y+48*S);
  }

  drawHUD(){
    const g=this.hudGfx;g.clear();const[f1,f2]=this.f;if(!f1||!f2)return;
    const bW=320,bH=22,bY=34,gap=28,r=4;

    // ═══════ NEO BRUTALIST PLAYER 1 HUD ═══════
    const p1x=gap+95;
    // HP bar — thick black border, hard fill
    g.fillStyle(0x000000,1);g.fillRect(p1x-2,bY-2,bW+4,bH+4);
    g.fillStyle(0x1a1a2e,1);g.fillRect(p1x,bY,bW,bH);
    const p1p=Math.max(0,f1.hp/f1.maxHp);
    if(p1p>0){g.fillStyle(p1p>0.5?0x88D8A8:p1p>0.25?0xFFE66D:0xFF8A76,1);g.fillRect(p1x,bY,Math.floor(bW*p1p),bH)}
    g.lineStyle(3,0x000000,1);g.strokeRect(p1x,bY,bW,bH);
    // Stamina bar
    const stY=bY+bH+6;
    g.fillStyle(0x000000,1);g.fillRect(p1x-1,stY-1,bW+2,10);
    g.fillStyle(0x1a1a2e,1);g.fillRect(p1x,stY,bW,8);
    const st1=Math.max(0,f1.stamina/f1.maxStamina);
    if(st1>0){g.fillStyle(st1>0.3?0x88C8E8:0xFF8A76,1);g.fillRect(p1x,stY,Math.floor(bW*st1),8)}
    g.lineStyle(2,0x000000,1);g.strokeRect(p1x,stY,bW,8);
    // Durability bar
    if(!f1.isDummy){
      const duY=stY+12;
      g.fillStyle(0x000000,1);g.fillRect(p1x-1,duY-1,Math.floor(bW*0.5)+2,7);
      g.fillStyle(0x1a1a2e,0.8);g.fillRect(p1x,duY,Math.floor(bW*0.5),5);
      const du1=clamp(f1.weaponDur/f1.maxDur,0,1);
      if(du1>0&&!f1.bareHanded){g.fillStyle(du1>0.5?0xFFE66D:du1>0.25?0xFF8A76:0xf87171,1);g.fillRect(p1x,duY,Math.floor(bW*0.5*du1),5)}
      g.lineStyle(2,0x000000,1);g.strokeRect(p1x,duY,Math.floor(bW*0.5),5);
    }
    // Portrait — Neo Brutalist square
    g.fillStyle(0x000000,1);g.fillRect(p1x-62,bY-4,52,52);
    g.fillStyle(0x0f0f25,1);g.fillRect(p1x-60,bY-2,48,48);
    g.lineStyle(3,parseInt(f1.colorHex.slice(1),16),1);g.strokeRect(p1x-60,bY-2,48,48);
    // Special CD
    if(f1.specialMax>0){const cd=Math.max(0,1-f1.specialCd/f1.specialMax);const spY=stY+22;g.fillStyle(0x000000,1);g.fillRect(p1x-1,spY-1,Math.floor(bW*0.35)+2,7);g.fillStyle(0x1a1a2e,0.8);g.fillRect(p1x,spY,Math.floor(bW*0.35),5);g.fillStyle(0xC9A0FF,1);g.fillRect(p1x,spY,Math.floor(bW*0.35*cd),5);g.lineStyle(2,0x000000,1);g.strokeRect(p1x,spY,Math.floor(bW*0.35),5)}
    // Bleed indicator
    if(f1.bleedTimer>0){g.fillStyle(0xFF8A76,0.7+Math.sin(Date.now()*0.01)*0.3);g.fillRect(p1x+bW+8,bY+4,12,12);g.lineStyle(2,0x000000,1);g.strokeRect(p1x+bW+8,bY+4,12,12)}
    // Round win squares
    for(let i=0;i<ROUNDS_WIN;i++){
      const dx=p1x-56+i*18,dy=bY+54;
      if(i<f1.roundWins){g.fillStyle(0x88D8A8,1);g.fillRect(dx,dy,12,12);g.lineStyle(2,0x000000,1);g.strokeRect(dx,dy,12,12)}
      else{g.lineStyle(2,0x475569,0.7);g.strokeRect(dx,dy,12,12)}
    }

    // ═══════ NEO BRUTALIST PLAYER 2 HUD ═══════
    const p2x=W-gap-95-bW;
    g.fillStyle(0x000000,1);g.fillRect(p2x-2,bY-2,bW+4,bH+4);
    g.fillStyle(0x1a1a2e,1);g.fillRect(p2x,bY,bW,bH);
    const p2p=Math.max(0,f2.hp/f2.maxHp);
    if(p2p>0){const fillW=Math.floor(bW*p2p);g.fillStyle(p2p>0.5?0x88D8A8:p2p>0.25?0xFFE66D:0xFF8A76,1);g.fillRect(p2x+bW-fillW,bY,fillW,bH)}
    g.lineStyle(3,0x000000,1);g.strokeRect(p2x,bY,bW,bH);
    // P2 Stamina
    g.fillStyle(0x000000,1);g.fillRect(p2x-1,stY-1,bW+2,10);
    g.fillStyle(0x1a1a2e,1);g.fillRect(p2x,stY,bW,8);
    const st2=Math.max(0,f2.stamina/f2.maxStamina);
    if(st2>0){const fillW2=Math.floor(bW*st2);g.fillStyle(st2>0.3?0x88C8E8:0xFF8A76,1);g.fillRect(p2x+bW-fillW2,stY,fillW2,8)}
    g.lineStyle(2,0x000000,1);g.strokeRect(p2x,stY,bW,8);
    // P2 Portrait — Neo Brutalist square
    g.fillStyle(0x000000,1);g.fillRect(p2x+bW+10,bY-4,52,52);
    g.fillStyle(0x0f0f25,1);g.fillRect(p2x+bW+12,bY-2,48,48);
    g.lineStyle(3,parseInt(f2.colorHex.slice(1),16),1);g.strokeRect(p2x+bW+12,bY-2,48,48);
    if(f2.bleedTimer>0){g.fillStyle(0xFF8A76,0.7+Math.sin(Date.now()*0.01)*0.3);g.fillRect(p2x-20,bY+4,12,12);g.lineStyle(2,0x000000,1);g.strokeRect(p2x-20,bY+4,12,12)}
    // P2 Round win squares
    for(let i=0;i<ROUNDS_WIN;i++){
      const dx=p2x+bW+16+36-i*18,dy=bY+54;
      if(i<f2.roundWins){g.fillStyle(0x88D8A8,1);g.fillRect(dx,dy,12,12);g.lineStyle(2,0x000000,1);g.strokeRect(dx,dy,12,12)}
      else{g.lineStyle(2,0x475569,0.7);g.strokeRect(dx,dy,12,12)}
    }

    // Center timer — Neo Brutalist box
    g.fillStyle(0x000000,1);g.fillRect(W/2-36,bY-8,72,bH+18);
    g.fillStyle(0x1a1a2e,1);g.fillRect(W/2-34,bY-6,68,bH+14);
    g.lineStyle(3,0xFFE66D,1);g.strokeRect(W/2-34,bY-6,68,bH+14);

    // ═══════ KO VIGNETTE — Neo Brutalist bars ═══════
    if(this.koActive){
      const vg=this.vignetteGfx;vg.clear();
      vg.fillStyle(0x000000,0.6);
      vg.fillRect(0,0,W,70);vg.fillRect(0,H-70,W,70);
      vg.lineStyle(3,0xFF8A76,0.4);vg.lineBetween(0,70,W,70);vg.lineBetween(0,H-70,W,H-70);
    }else{this.vignetteGfx.clear()}
  }

  showTaunt(pool,delay=0,fighter=null){
    if(!this.tauntText)return;
    const msg=pool[Math.floor(Math.random()*pool.length)];
    this.tweens.killTweensOf(this.tauntText);
    this.tauntText.setAlpha(0);
    this.time.delayedCall(delay,()=>{
      if(fighter){
        const headY=fighter.y+(fighter.pose?.head?.y||(-55))*S;
        const tx=Math.max(100,Math.min(W-100,fighter.x));
        const anchorX=fighter.x>W/2?1:0;
        this.tauntText.setOrigin(anchorX,1).setPosition(tx,headY-32*S);
      }else{
        this.tauntText.setOrigin(0.5,0.5).setPosition(W/2,H*0.70);
      }
      this.tauntText.setText(`"${msg}"`).setAlpha(1);
      this.tweens.add({targets:this.tauntText,alpha:{from:1,to:0},duration:600,delay:3500,ease:'Power2'});
      // Play matching audio if available
      const audioKey=TAUNT_AUDIO[msg];
      if(audioKey&&this.cache.audio.has(audioKey)){
        this.sound.stopByKey(audioKey);
        this.sound.play(audioKey,{volume:0.85});
      }
    });
  }

  triggerKO(winner,loser){
    if(this.koActive)return;
    this.koActive=true;this.koTimer=KO_SLOWMO_DUR;
    this.gameSpeed=KO_SLOWMO;
    // KO text
    this.koText.setText('K.O.').setAlpha(1).setScale(0.4);
    this.tweens.add({targets:this.koText,scale:{from:0.4,to:1.8},alpha:{from:1,to:0.85},duration:KO_SLOWMO_DUR*0.8,ease:'Back.easeOut'});
    // Camera zoom
    this.cameras.main.shake(400,0.025);
    this.cameras.main.flash(200,255,100,100,true);
    // Big particle burst on loser
    this.shockFx.setPosition(loser.x,loser.y-20*S);this.shockFx.emitParticle(40);
    this.slashFx.setPosition(loser.x,loser.y-20*S);this.slashFx.emitParticle(30);
    // Death grunt for loser (local player only)
    if(loser.id===this.f[0]?.id)this.playGrunt('grunt_death');
    // Victory pose for winner
    if(winner)this.setAnim(winner,[{d:500,p:'victory'}],true);
    // Taunt from winner
    if(winner&&loser){
      const isP1Win=winner.id===this.f[0]?.id;
      const tauntPool=isP1Win?TAUNTS_KO_WIN:TAUNTS_KO_LOSE;
      this.showTaunt(tauntPool,600,winner);
    }
  }

  endRound(winner){
    if(this.roundOver)return;
    this.roundOver=true;this.matchOn=false;
    if(winner)winner.roundWins++;

    // Check match win
    const matchWinner=this.f.find(f=>f.roundWins>=ROUNDS_WIN);
    if(matchWinner){
      // Match over
      if(matchWinner.id===this.f[0]?.id){this.winStreak++;localStorage.setItem('scrib_winstreak',String(this.winStreak))}
      else{this.winStreak=0;localStorage.setItem('scrib_winstreak','0')}
      this.time.delayedCall(this.koActive?KO_SLOWMO_DUR+500:1200,()=>{
        this.gameSpeed=1;this.koText.setAlpha(0);
        this.onEvent('matchEnd',{winnerId:matchWinner.id,winnerName:matchWinner.name,
          p1Rounds:this.f[0].roundWins,p2Rounds:this.f[1].roundWins,winStreak:this.winStreak});
      });
    }else{
      // Next round
      this.time.delayedCall(this.koActive?KO_SLOWMO_DUR+500:1500,()=>{
        this.gameSpeed=1;this.koText.setAlpha(0);
        this.currentRound++;
        this.startRound();
      });
    }
  }

  update(time,rawDt){
    const dt=rawDt*this.gameSpeed;
    if(this.transitioning){
      for(const f of this.f){this.drawFighter(f,0)}
      this.drawHUD();
      return;
    }
    if(!this.matchOn&&!this.koActive){
      for(const f of this.f){this.drawFighter(f,0)}
      this.drawHUD();
      return;
    }

    // KO timer
    if(this.koActive){
      this.koTimer-=rawDt;
      if(this.koTimer<=0){this.koActive=false;this.gameSpeed=1;this.koText.setAlpha(0)}
    }

    this.timer-=dt/1000;
    this.timerText.setText(String(Math.max(0,Math.ceil(this.timer))));
    const local=this.f[0];if(local?.hp>0&&!local.knockedDown)this.handleInput(local);
    for(const f of this.f){
      if(f.isDummy)this.dummyLogic(f);
      this.updateFighter(f,dt);
      if(f.attacking)for(const t of this.f)if(t.id!==f.id&&t.hp>0)this.checkHit(f,t);
      this.drawFighter(f,dt);
    }
    this.drawHUD();

    // Check round end
    if(!this.roundOver){
      const dead=this.f.filter(f=>f.hp<=0);
      if(dead.length>0){
        const winner=this.f.find(f=>f.hp>0);
        const loser=dead[0];
        this.triggerKO(winner,loser);
        this.endRound(winner);
      }else if(this.timer<=0){
        const winner=this.f.reduce((a,b)=>a.hp>b.hp?a:b);
        this.endRound(winner);
      }
    }
  }
}
