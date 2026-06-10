import React, { useState, useEffect, useRef } from 'react';
import { roomService } from '../../services/room.service.js';
import { useRoomStore } from '../../store/room.store.js';

interface Props { onBack: () => void; }

export default function JoinRoom({ onBack }: Props) {
  const { setError, error, isJoining, setJoining } = useRoomStore();
  const [name, setName]       = useState('');
  const [cells, setCells]     = useState(['','','','','','']);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const isPasting = useRef(false);

  useEffect(() => {
    setError(null);
    // Auto-fill from invite link if present in the current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? '';
      const m   = url.match(/binge-room\.app\/join\/([A-Z0-9]{6})/i);
      if (m) setCells(m[1].toUpperCase().split(''));
    });
  }, []);

  const code = cells.join('').toUpperCase();

  const setCellAt = (i: number, val: string) => {
    if (isPasting.current) return; // paste handler owns all cells during paste
    const ch = val.replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(-1);
    setCells(prev => { const n=[...prev]; n[i]=ch; return n; });
    if (ch && i < 5) refs.current[i+1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !cells[i] && i > 0) refs.current[i-1]?.focus();
    if (e.key === 'Enter') handleJoin();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,6);
    if (text.length === 6) {
      isPasting.current = true;
      setCells(text.split(''));
      refs.current[5]?.focus();
      // Release after React has flushed state so onChange skips during this tick
      setTimeout(() => { isPasting.current = false; }, 0);
    }
  };

  const handleJoin = async () => {
    if (!name.trim())        { setError('Enter your display name'); return; }
    if (code.length !== 6)   { setError('Enter the full 6-digit code'); return; }
    setJoining(true); setError(null);
    const res = await roomService.joinRoom(name.trim(), code);
    setJoining(false);
    if (!res.success) setError(res.error === 'ROOM_NOT_FOUND' ? 'Room not found — check the code' : res.error ?? 'Failed to join');
  };

  const filled = code.length;

  return (
    <div className="animate-fadeSlideUp" style={{ paddingTop: 16, display:'flex', flexDirection:'column', gap:14 }}>
      {/* Back */}
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, color:'#64748b', fontSize:12, background:'none', border:'none', cursor:'pointer', width:'fit-content' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div>
        <h2 style={{ fontSize:15, fontWeight:700, color:'#f1f5f9', marginBottom:2 }}>Join a Room</h2>
        <p style={{ fontSize:12, color:'#475569' }}>Enter the code your friend shared.</p>
      </div>

      {/* Name */}
      <div>
        <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Display Name</label>
        <input className="input" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Akhil" maxLength={32} autoFocus />
      </div>

      {/* OTP cells */}
      <div>
        <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748b', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>Room Code</label>
        <div style={{ display:'flex', gap:8 }} onPaste={onPaste}>
          {cells.map((ch, i) => (
            <input
              key={i}
              ref={el => { refs.current[i] = el; }}
              type="text" inputMode="text"
              value={ch} maxLength={2}
              onChange={e => setCellAt(i, e.target.value)}
              onKeyDown={e => onKeyDown(i, e)}
              onFocus={() => setFocusIdx(i)}
              onBlur={() => setFocusIdx(null)}
              style={{
                width: 44, height: 48, textAlign:'center',
                fontSize: 18, fontWeight: 700, letterSpacing: 1,
                background: ch ? 'rgba(99,102,241,.15)' : 'rgba(30,41,59,.8)',
                border: `1.5px solid ${focusIdx === i ? '#6366f1' : ch ? 'rgba(99,102,241,.5)' : 'rgba(99,102,241,.15)'}`,
                borderRadius: 10, color: '#f1f5f9', outline: 'none',
                boxShadow: focusIdx === i ? '0 0 0 3px rgba(99,102,241,.2)' : 'none',
                transition: 'border-color .15s, background .15s, box-shadow .15s',
                caretColor: 'transparent',
              }}
            />
          ))}
        </div>
        {/* Progress bar */}
        <div style={{ marginTop:8, height:2, borderRadius:1, background:'rgba(99,102,241,.15)', overflow:'hidden' }}>
          <div style={{ height:'100%', background:'linear-gradient(90deg,#6366f1,#a855f7)', width:`${(filled/6)*100}%`, transition:'width .2s', borderRadius:1 }} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding:'9px 12px', borderRadius:9, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)' }}>
          <p style={{ fontSize:12, color:'#f87171' }}>{error}</p>
        </div>
      )}

      {/* CTA */}
      <button className="btn-primary" onClick={handleJoin} disabled={isJoining || filled < 6 || !name.trim()}>
        {isJoining
          ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span style={{ width:13, height:13, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%' }} className="animate-spin-sm" />
              Joining &amp; redirecting…
            </span>
          : 'Join Room →'
        }
      </button>

      <p style={{ fontSize:11, color:'#475569', textAlign:'center' }}>
        You'll be taken directly to the shared video in sync.
      </p>
    </div>
  );
}
