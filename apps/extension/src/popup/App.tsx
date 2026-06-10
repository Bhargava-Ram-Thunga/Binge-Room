import React, { useEffect, useState } from 'react';
import { useRoomStore } from '../store/room.store.js';
import { roomService }  from '../services/room.service.js';
import CreateRoom from './components/CreateRoom.js';
import JoinRoom   from './components/JoinRoom.js';
import RoomInfo   from './components/RoomInfo.js';
import type { Room, User } from '../types/index.js';

type View = 'home' | 'create' | 'join';

export default function App() {
  const store = useRoomStore();
  const [view, setView]       = useState<View>('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    roomService.getRoomState().then((res) => {
      if (res.success && res.data) {
        if (res.data.room)   store.setRoom(res.data.room);
        if (res.data.user)   store.setCurrentUser(res.data.user);
        if (res.data.status) store.applyConnectionStatus(res.data.status);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handler = (msg: { type: string; payload: { room?: Room | null; user?: User | null; connected?: boolean; message?: string } }) => {
      if (msg.type === 'ROOM_UPDATE') {
        store.setRoom(msg.payload.room ?? null);
        if (msg.payload.user !== undefined) store.setCurrentUser(msg.payload.user ?? null);
        setView('home');
        store.setError(null);
      }
      if (msg.type === 'CONNECTION_STATUS') store.setConnected(msg.payload.connected ?? false);
      if (msg.type === 'ERROR') store.setError(msg.payload.message ?? 'Something went wrong');
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  if (loading) return <Loader />;
  if (store.room && store.currentUser)
    return <RoomInfo room={store.room} user={store.currentUser} />;

  return (
    <div className="flex flex-col" style={{ minHeight: 480 }}>
      <Header connected={store.isConnected} />
      <main className="flex-1 px-4 pb-4">
        {view === 'home'   && <HomeView   onCreate={() => setView('create')} onJoin={() => setView('join')} />}
        {view === 'create' && <CreateRoom onBack={() => setView('home')} />}
        {view === 'join'   && <JoinRoom   onBack={() => setView('home')} />}
      </main>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ connected }: { connected: boolean }) {
  return (
    <header className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: 'rgba(99,102,241,.15)' }}>
      {/* Logo */}
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </div>
      <span className="text-sm font-bold tracking-tight text-white">Binge-Room</span>

      {/* Status */}
      <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full"
           style={{ background: connected ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${connected ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}` }}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: connected ? '#22c55e' : '#ef4444', boxShadow: connected ? '0 0 0 0 rgba(34,197,94,.5)' : 'none', animation: connected ? 'pulse-ring 1.8s infinite' : 'none' }} />
        <span className="text-[10px] font-medium" style={{ color: connected ? '#4ade80' : '#f87171' }}>
          {connected ? 'Connected' : 'Offline'}
        </span>
      </div>
    </header>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function HomeView({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="animate-fadeSlideUp" style={{ paddingTop: 20 }}>
      {/* Hero */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.2),rgba(168,85,247,.2))', border: '1px solid rgba(99,102,241,.25)' }}>
          <span style={{ fontSize: 26 }}>🎬</span>
        </div>
        <h2 className="text-base font-bold text-white mb-1">Watch together, in sync</h2>
        <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
          Create a room or join with a 6-digit code.<br/>Everyone stays perfectly in sync.
        </p>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn-primary" onClick={onCreate}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Room
          </span>
        </button>
        <button className="btn-secondary" onClick={onJoin}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Join with Code
          </span>
        </button>
      </div>

      {/* Feature tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 20, justifyContent: 'center' }}>
        {['⚡ ±500ms Drift Fix', '📺 Ad Sync', '🔗 Invite Links', '🔄 Auto Reconnect'].map(f => (
          <span key={f} className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(30,41,59,.8)', border: '1px solid rgba(99,102,241,.15)', color: '#64748b' }}>
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Loader ───────────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 480 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#a855f7)', margin: '0 auto 10px', animation: 'pulse-ring 1.5s infinite' }} />
        <p style={{ fontSize: 11, color: '#475569' }}>Loading…</p>
      </div>
    </div>
  );
}
