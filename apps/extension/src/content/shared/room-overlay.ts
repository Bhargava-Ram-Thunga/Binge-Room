/**
 * RoomOverlay
 *
 * A minimal in-video status indicator showing sync status + participant count.
 * Rendered inside a shadow DOM so it never conflicts with YouTube's CSS.
 */

import type { Room } from '../../types/index.js';

const CSS = `
  :host {
    all: initial;
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: none;
  }

  .overlay {
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 10px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    transition: opacity 0.3s;
  }

  .overlay.hidden {
    opacity: 0;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
    animation: pulse 2s infinite;
  }

  .dot.disconnected {
    background: #ef4444;
    animation: none;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .info {
    font-size: 12px;
    color: #e2e8f0;
    line-height: 1.3;
  }

  .code {
    font-weight: 700;
    letter-spacing: 1px;
    color: #818cf8;
  }

  .users {
    color: #94a3b8;
    font-size: 11px;
  }

  .logo {
    font-size: 11px;
    font-weight: 800;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.3px;
  }
`;

export class RoomOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;

  show(room: Room, connected: boolean): void {
    this.init();
    if (!this.shadow) return;

    const overlayEl = this.shadow.querySelector('.overlay');
    const dotEl = this.shadow.querySelector('.dot');
    const codeEl = this.shadow.querySelector('.code');
    const usersEl = this.shadow.querySelector('.users');

    if (overlayEl) overlayEl.classList.toggle('hidden', !connected);
    if (dotEl) dotEl.classList.toggle('disconnected', !connected);
    if (codeEl) codeEl.textContent = room.code;
    if (usersEl) usersEl.textContent = `${room.users.length} watching`;
  }

  hide(): void {
    this.host?.remove();
    this.host = null;
    this.shadow = null;
  }

  private init(): void {
    if (this.host) return;

    this.host = document.createElement('div');
    this.host.id = 'binge-room-overlay';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = CSS;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="dot"></div>
      <div class="info">
        <span class="logo">Binge-Room</span>
        <div>Room <span class="code">------</span></div>
        <div class="users">0 watching</div>
      </div>
    `;

    this.shadow.appendChild(style);
    this.shadow.appendChild(overlay);
    document.documentElement.appendChild(this.host);
  }
}
