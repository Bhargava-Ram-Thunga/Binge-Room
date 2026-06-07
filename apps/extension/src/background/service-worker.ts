/**
 * SyncStream Background Service Worker (Manifest V3)
 *
 * Key responsibilities:
 *  - Single Socket.IO connection to the server
 *  - Room state ownership
 *  - Message broker: popup ↔ content script ↔ server
 *  - Auto-navigate to the shared video when joining a room
 *  - Re-sync after tab navigation (MV3 keepalive)
 */

import { io, Socket } from 'socket.io-client';
import type {
  Room, User, ConnectionStatus,
  CreateRoomPayload, JoinRoomPayload,
  SyncUpdatePayload, RoomJoinedPayload,
  UserJoinedPayload, UserLeftPayload,
  RoomStatePayload, HostChangedPayload,
  ControlsChangedPayload,
} from '../types/index.js';
import {
  CLIENT_EVENTS, SERVER_EVENTS,
  RECONNECT_ATTEMPTS, RECONNECT_DELAY_MS,
} from '@syncstream/event-schema';
import { sanitizeUsername } from '@syncstream/shared-utils';

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVER_URL     = 'http://localhost:4000';
const STORAGE_KEY    = 'syncstream_state';
const KEEPALIVE_ALARM = 'syncstream_keepalive';

// ─── State ────────────────────────────────────────────────────────────────────

interface BgState {
  room: Room | null;
  currentUser: User | null;
  isHost: boolean;
  userName: string;
}

let socket: Socket | null = null;
let state: BgState = {
  room: null, currentUser: null, isHost: false, userName: 'Anonymous',
};

// ─── Socket ───────────────────────────────────────────────────────────────────

function getSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnectionAttempts: RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY_MS,
    reconnectionDelayMax: 5000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[BG] Connected:', socket!.id);
    broadcastStatus();
  });

  socket.on('disconnect', (reason) => {
    console.log('[BG] Disconnected:', reason);
    broadcastStatus();
    broadcastToContent({ type: 'SHOW_TOAST', payload: { message: 'Disconnected — Reconnecting…', type: 'warning' } });
  });

  socket.on('connect_error', (err) => {
    console.warn('[BG] Connect error:', err.message);
    broadcastToPopup({ type: 'CONNECTION_STATUS', payload: buildStatus() });
  });

  // ─── Server → Client ────────────────────────────────────────────────────

  socket.on(SERVER_EVENTS.ROOM_CREATED, async (payload: RoomJoinedPayload) => {
    state.room        = payload.room;
    state.currentUser = payload.user;
    state.isHost      = true;
    await persistState();

    broadcastToPopup({ type: 'ROOM_UPDATE', payload: { room: payload.room, user: payload.user } });

    // If host is already on a YouTube page the content script handles sync.
    // Also tell the content script so it can start the sync engine.
    sendToYouTubeTabs({ type: 'ROOM_JOINED', payload: { room: payload.room, user: payload.user, serverTime: payload.serverTime } });
    broadcastToContent({ type: 'SHOW_TOAST', payload: { message: `Room created! Code: ${payload.room.code}`, type: 'success' } });
  });

  socket.on(SERVER_EVENTS.ROOM_JOINED, async (payload: RoomJoinedPayload) => {
    // Detect silent auto-rejoin (service worker restart reconnected to existing room).
    // In that case skip navigation and toasts — just re-sync the content scripts.
    const isSilentRejoin = state.room?.id === payload.room.id;

    state.room        = payload.room;
    state.currentUser = payload.user;
    state.isHost      = payload.user.isHost;
    await persistState();

    broadcastToPopup({ type: 'ROOM_UPDATE', payload: { room: payload.room, user: payload.user } });

    if (isSilentRejoin) {
      // Already watching — just re-attach the engine, no navigation needed
      console.log('[BG] Silent rejoin for room', payload.room.code);
      sendToYouTubeTabs({ type: 'ROOM_JOINED', payload: { room: payload.room, user: payload.user, serverTime: payload.serverTime } });
      return;
    }

    broadcastToContent({ type: 'SHOW_TOAST', payload: { message: `Joined room ${payload.room.code}!`, type: 'success' } });

    // ── Navigate to the shared video then sync ──────────────────────────
    const videoUrl = payload.room.videoState.videoUrl;
    if (videoUrl) {
      await navigateAndSync(videoUrl, payload.room, payload.user, payload.serverTime);
    } else {
      sendToYouTubeTabs({ type: 'ROOM_JOINED', payload: { room: payload.room, user: payload.user, serverTime: payload.serverTime } });
    }
  });

  socket.on(SERVER_EVENTS.USER_JOINED, async (payload: UserJoinedPayload) => {
    if (state.room) { state.room = payload.room; await persistState(); }
    broadcastToPopup({ type: 'ROOM_UPDATE', payload: { room: payload.room } });
    broadcastToContent({ type: 'ROOM_UPDATE', payload: { room: payload.room } });
    broadcastToContent({ type: 'SHOW_TOAST', payload: { message: `${payload.user.name} joined`, type: 'info' } });
  });

  socket.on(SERVER_EVENTS.USER_LEFT, async (payload: UserLeftPayload) => {
    if (state.room && payload.room) { state.room = payload.room; await persistState(); }
    broadcastToPopup({ type: 'ROOM_UPDATE', payload: { room: payload.room } });
    broadcastToContent({ type: 'ROOM_UPDATE', payload: { room: payload.room } });
    broadcastToContent({ type: 'SHOW_TOAST', payload: { message: `${payload.userName} left`, type: 'info' } });
  });

  socket.on(SERVER_EVENTS.SYNC_UPDATE, async (payload: SyncUpdatePayload) => {
    if (state.room) { state.room.videoState = payload.videoState; await persistState(); }
    broadcastToPopup({ type: 'ROOM_UPDATE', payload: { room: state.room } });
    // Update content scripts' overlay + engine room ref with the latest state
    broadcastToContent({ type: 'ROOM_UPDATE', payload: { room: state.room } });
    sendToYouTubeTabs({ type: 'SYNC_COMMAND', payload });
    const msg = buildActionToast(payload);
    if (msg) sendToYouTubeTabs({ type: 'SHOW_TOAST', payload: { message: msg, type: 'info' } });
  });

  socket.on(SERVER_EVENTS.ROOM_STATE, async (payload: RoomStatePayload) => {
    if (state.room) { state.room = payload.room; await persistState(); }
    sendToYouTubeTabs({ type: 'SYNC_COMMAND', payload: { videoState: payload.room.videoState, serverTime: payload.serverTime, action: 'ROOM_STATE', triggeredBy: '', triggeredByName: '' } });
  });

  socket.on(SERVER_EVENTS.HOST_CHANGED, async (payload: HostChangedPayload) => {
    if (state.room) {
      state.room  = payload.room;
      state.isHost = payload.newHostId === socket?.id;
      await persistState();
    }
    broadcastToPopup({ type: 'ROOM_UPDATE', payload: { room: payload.room } });
    sendToYouTubeTabs({ type: 'SHOW_TOAST', payload: { message: `${payload.newHostName} is now the host`, type: 'info' } });
  });

  socket.on(SERVER_EVENTS.CONTROLS_CHANGED, async (payload: ControlsChangedPayload) => {
    if (state.room) { state.room = payload.room; await persistState(); }
    broadcastToPopup({ type: 'ROOM_UPDATE', payload: { room: payload.room } });
    broadcastToContent({ type: 'ROOM_UPDATE', payload: { room: payload.room } });
    const msg = payload.locked ? '🔒 Host locked playback controls' : '🔓 Everyone can control playback';
    broadcastToContent({ type: 'SHOW_TOAST', payload: { message: msg, type: 'info' } });
  });

  socket.on(SERVER_EVENTS.ERROR, (payload: { code: string; message: string }) => {
    broadcastToPopup({ type: 'ERROR', payload });
    sendToYouTubeTabs({ type: 'SHOW_TOAST', payload: { message: `Error: ${payload.message}`, type: 'error' } });
  });

  return socket;
}

// ─── Navigate to video then send ROOM_JOINED once the tab is ready ───────────

async function navigateAndSync(
  videoUrl: string,
  room: Room,
  user: User,
  serverTime: number,
): Promise<void> {
  // Append ?t=SECONDS so YouTube seeks to the right position immediately
  // before our content script even runs — gives instant visual sync.
  let targetUrl = videoUrl;
  try {
    const u = new URL(videoUrl);
    const startSec = Math.max(0, Math.floor(
      room.videoState.currentTime + (Date.now() - serverTime) / 1000,
    ));
    if (startSec > 0) u.searchParams.set('t', String(startSec));
    targetUrl = u.toString();
  } catch { /* malformed URL — use as-is */ }

  // Find an existing YouTube tab to reuse, else create one
  const ytTabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });
  let tabId: number;

  if (ytTabs.length > 0 && ytTabs[0].id != null) {
    tabId = ytTabs[0].id;
    await chrome.tabs.update(tabId, { url: targetUrl, active: true });
  } else {
    const newTab = await chrome.tabs.create({ url: targetUrl, active: true });
    tabId = newTab.id!;
  }

  // Wait for the tab to fully load, then send the sync payload
  waitForTabLoad(tabId, () => {
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        type: 'ROOM_JOINED',
        payload: { room, user, serverTime },
      }).catch(() => {});
    }, 600);
  });
}

function waitForTabLoad(tabId: number, cb: () => void): void {
  const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
    if (id === tabId && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      cb();
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

// ─── Message handler (popup / content → background) ──────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;
  switch (type) {
    case 'CREATE_ROOM':
      handleCreateRoom(payload, sendResponse);
      return true;
    case 'JOIN_ROOM':
      handleJoinRoom(payload, sendResponse);
      return true;
    case 'LEAVE_ROOM':
      handleLeaveRoom(sendResponse);
      return true;
    case 'GET_ROOM_STATE':
      sendResponse({ success: true, data: { room: state.room, user: state.currentUser, status: buildStatus() } });
      break;
    case 'VIDEO_EVENT':
      handleVideoEvent(payload);
      sendResponse({ success: true });
      break;
    case 'TOGGLE_CONTROLS':
      handleToggleControls(payload.locked, sendResponse);
      return true;
    case 'GET_CONNECTION_STATUS':
      sendResponse({ success: true, data: buildStatus() });
      break;
  }
});

// ─── Action handlers ──────────────────────────────────────────────────────────

function handleCreateRoom(payload: CreateRoomPayload & { userName: string }, cb: (r: unknown) => void) {
  const sock = getSocket();
  state.userName = sanitizeUsername(payload.userName);
  if (!sock.connected) { cb({ success: false, error: 'Not connected to server' }); return; }
  sock.emit(CLIENT_EVENTS.CREATE_ROOM, {
    userName: state.userName,
    platform: payload.platform ?? 'youtube',
    videoId: payload.videoId ?? '',
    videoUrl: payload.videoUrl ?? '',
  });
  cb({ success: true });
}

function handleJoinRoom(payload: JoinRoomPayload, cb: (r: unknown) => void) {
  const sock = getSocket();
  state.userName = sanitizeUsername(payload.userName);
  if (!sock.connected) { cb({ success: false, error: 'Not connected to server' }); return; }
  sock.emit(CLIENT_EVENTS.JOIN_ROOM, {
    roomId: payload.roomId,
    code: payload.code,
    userName: state.userName,
    platform: payload.platform ?? 'youtube',
  });
  cb({ success: true });
}

async function handleLeaveRoom(cb: (r: unknown) => void) {
  if (socket && state.room) socket.emit(CLIENT_EVENTS.LEAVE_ROOM);
  state.room = null; state.currentUser = null; state.isHost = false;
  await persistState();
  broadcastToPopup({ type: 'ROOM_UPDATE', payload: { room: null, user: null } });
  sendToYouTubeTabs({ type: 'ROOM_LEFT', payload: {} });
  cb({ success: true });
}

function handleVideoEvent(payload: {
  action: string; currentTime?: number;
  videoId?: string; videoUrl?: string; resumeTime?: number;
}) {
  if (!socket?.connected || !state.room || !state.currentUser) return;
  const base = {
    roomId: state.room.id, userId: state.currentUser.id,
    userName: state.currentUser.name, timestamp: Date.now(),
    platform: state.room.platform,
  };

  // Optimistically update local room videoState so the sender's drift
  // correction doesn't fight their own seek/play/pause actions.
  // Also persist to Chrome storage so a page reload gets the correct state.
  const now = Date.now();
  switch (payload.action) {
    case 'PLAY':
      socket.emit(CLIENT_EVENTS.PLAY, { ...base, currentTime: payload.currentTime ?? 0 });
      if (state.room) state.room.videoState = { ...state.room.videoState, isPlaying: true, currentTime: payload.currentTime ?? 0, lastUpdated: now };
      break;
    case 'PAUSE':
      socket.emit(CLIENT_EVENTS.PAUSE, { ...base, currentTime: payload.currentTime ?? 0 });
      if (state.room) state.room.videoState = { ...state.room.videoState, isPlaying: false, currentTime: payload.currentTime ?? 0, lastUpdated: now };
      break;
    case 'SEEK':
      socket.emit(CLIENT_EVENTS.SEEK, { ...base, currentTime: payload.currentTime ?? 0 });
      if (state.room) state.room.videoState = { ...state.room.videoState, currentTime: payload.currentTime ?? 0, lastUpdated: now };
      break;
    case 'VIDEO_CHANGE':
      socket.emit(CLIENT_EVENTS.VIDEO_CHANGE, { ...base, videoId: payload.videoId ?? '', videoUrl: payload.videoUrl ?? '' });
      break;
    case 'AD_START':
      socket.emit(CLIENT_EVENTS.AD_START, { ...base, currentTime: payload.currentTime ?? 0 });
      if (state.room) state.room.videoState = { ...state.room.videoState, isPlaying: false, isAdPlaying: true, currentTime: payload.currentTime ?? 0, lastUpdated: now };
      break;
    case 'AD_END':
      socket.emit(CLIENT_EVENTS.AD_END, { ...base, resumeTime: payload.resumeTime ?? 0 });
      if (state.room) state.room.videoState = { ...state.room.videoState, isAdPlaying: false, isPlaying: true, currentTime: payload.resumeTime ?? 0, lastUpdated: now };
      break;
    case 'PLAYBACK_RATE_CHANGE':
      socket.emit(CLIENT_EVENTS.PLAYBACK_RATE_CHANGE, { ...base, playbackRate: payload.playbackRate ?? 1, currentTime: payload.currentTime ?? 0 });
      if (state.room) state.room.videoState = { ...state.room.videoState, playbackRate: payload.playbackRate ?? 1, currentTime: payload.currentTime ?? 0, lastUpdated: now };
      break;
  }
  // Persist updated state so page-reload rejoins use the correct timestamp
  if (state.room) void persistState();
}

function handleToggleControls(locked: boolean, cb: (r: unknown) => void) {
  const sock = getSocket();
  if (!sock.connected || !state.room || !state.isHost) { cb({ success: false, error: 'Not host or not connected' }); return; }
  sock.emit(CLIENT_EVENTS.LOCK_CONTROLS, { roomId: state.room.id, locked });
  cb({ success: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStatus(): ConnectionStatus {
  return {
    connected:  socket?.connected ?? false,
    roomId:     state.room?.id ?? null,
    userId:     state.currentUser?.id ?? null,
    userName:   state.currentUser?.name ?? null,
    isHost:     state.isHost,
    userCount:  state.room?.users.length ?? 0,
  };
}

function broadcastStatus() {
  const s = buildStatus();
  broadcastToPopup({ type: 'CONNECTION_STATUS', payload: s });
  sendToYouTubeTabs({ type: 'CONNECTION_STATUS', payload: s });
}

function buildActionToast(p: SyncUpdatePayload & { action?: string }): string | null {
  const n = p.triggeredByName;
  const t = (s: number) => { const m = Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; };
  switch (p.action) {
    case 'PLAY':   return `▶ ${n} resumed`;
    case 'PAUSE':  return `⏸ ${n} paused`;
    case 'SEEK':   return `⏩ ${n} skipped to ${t(p.videoState.currentTime)}`;
    case 'VIDEO_CHANGE': return `🎬 ${n} changed the video`;
    case 'AD_START': return '📺 Ad — sync paused';
    case 'AD_END':   return '✓ Ad done — resuming';
    case 'PLAYBACK_RATE_CHANGE': {
      const rate = p.videoState?.playbackRate ?? 1;
      return `⚡ ${n} set speed to ${rate}×`;
    }
    default: return null;
  }
}

async function sendToYouTubeTabs(message: unknown) {
  const tabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });
  for (const tab of tabs) {
    if (tab.id != null) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
  }
}

function broadcastToContent(message: unknown) {
  sendToYouTubeTabs(message);
}

function broadcastToPopup(message: unknown) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

async function persistState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function restoreState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) state = { ...state, ...stored[STORAGE_KEY] };
}

// ─── MV3 keepalive ────────────────────────────────────────────────────────────

chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM && state.room) {
    socket?.emit(CLIENT_EVENTS.PING, { clientTime: Date.now() });
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

restoreState().then(() => { getSocket(); });
