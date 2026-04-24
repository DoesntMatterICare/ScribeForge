import { joinRoom } from 'trystero';

const APP_ID = 'forge-arena-fight-2025';

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function createGameRoom(roomId) {
  const room = joinRoom({ appId: APP_ID }, roomId);

  const [sendWeapon, onWeapon] = room.makeAction('weapon');
  const [sendInput, onInput] = room.makeAction('input');
  const [sendState, onState] = room.makeAction('state');
  const [sendStart, onStart] = room.makeAction('start');
  const [sendChat, onChat] = room.makeAction('chat');

  return {
    room,
    selfId: room.selfId,
    send: { weapon: sendWeapon, input: sendInput, state: sendState, start: sendStart, chat: sendChat },
    on: { weapon: onWeapon, input: onInput, state: onState, start: onStart, chat: onChat },
    onPeerJoin: room.onPeerJoin.bind(room),
    onPeerLeave: room.onPeerLeave.bind(room),
    leave: () => room.leave(),
  };
}
