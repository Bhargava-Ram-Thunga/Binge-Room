/**
 * ToastManager
 *
 * Injects an isolated shadow DOM container into the YouTube page
 * and renders animated toast notifications that do not interfere
 * with YouTube's own styles.
 */

import type { ToastNotification, ToastType } from "../../types/index.js";
import { nanoid } from "@binge-room/shared-utils";

const TOAST_DURATION_MS = 4000;
const MAX_TOASTS = 5;

const ICONS: Record<ToastType, string> = {
  info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> =
  {
    info: { bg: "rgba(30, 41, 59, 0.95)", border: "#3b82f6", icon: "#60a5fa" },
    success: {
      bg: "rgba(20, 47, 33, 0.95)",
      border: "#22c55e",
      icon: "#4ade80",
    },
    warning: {
      bg: "rgba(55, 39, 12, 0.95)",
      border: "#f59e0b",
      icon: "#fbbf24",
    },
    error: { bg: "rgba(55, 18, 18, 0.95)", border: "#ef4444", icon: "#f87171" },
  };

const CSS = `
  :host {
    all: initial;
    position: fixed;
    top: 72px;
    right: 20px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    border-left: 3px solid transparent;
    max-width: 320px;
    min-width: 220px;
    pointer-events: auto;
    cursor: default;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3);
    transform: translateX(0);
    opacity: 1;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                opacity 0.3s ease;
  }

  .toast.entering {
    transform: translateX(110%);
    opacity: 0;
  }

  .toast.leaving {
    transform: translateX(110%);
    opacity: 0;
  }

  .toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-message {
    font-size: 13px;
    font-weight: 500;
    color: #f1f5f9;
    line-height: 1.4;
    word-break: break-word;
  }

  .toast-time {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
  }

  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: #64748b;
    padding: 2px;
    line-height: 1;
    border-radius: 4px;
    transition: color 0.2s;
    font-size: 16px;
  }

  .toast-close:hover {
    color: #cbd5e1;
  }

  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    border-radius: 0 0 0 10px;
    animation: shrink linear forwards;
  }

  @keyframes shrink {
    from { width: 100%; }
    to   { width: 0%; }
  }
`;

export class ToastManager {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private container: HTMLElement | null = null;
  private toasts: Map<string, HTMLElement> = new Map();

  init(): void {
    if (this.host) return;

    this.host = document.createElement("div");
    this.host.id = "binge-room-toasts";
    this.shadow = this.host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = CSS;

    this.container = document.createElement("div");
    this.container.setAttribute("part", "container");

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.container);
    document.documentElement.appendChild(this.host);
  }

  show(notification: Omit<ToastNotification, "id" | "timestamp">): void {
    this.init();
    if (!this.container) return;

    // Enforce max visible toasts
    if (this.toasts.size >= MAX_TOASTS) {
      const oldest = this.toasts.keys().next().value;
      if (oldest) this.dismiss(oldest);
    }

    const id = nanoid();
    const duration = notification.duration ?? TOAST_DURATION_MS;
    const type = notification.type ?? "info";
    const colors = COLORS[type];

    const el = document.createElement("div");
    el.className = "toast entering";
    el.setAttribute("role", "alert");
    el.style.cssText = `background:${colors.bg}; border-color:${colors.border}; position:relative; overflow:hidden;`;

    el.innerHTML = `
      <div class="toast-icon" style="color:${colors.icon}">${ICONS[type]}</div>
      <div class="toast-content">
        <div class="toast-message">${escapeHtml(notification.message)}</div>
        <div class="toast-time">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss">×</button>
      <div class="progress-bar" style="background:${colors.border}; animation-duration:${duration}ms"></div>
    `;

    el.querySelector(".toast-close")?.addEventListener("click", () =>
      this.dismiss(id),
    );

    this.container.appendChild(el);
    this.toasts.set(id, el);

    // Trigger enter animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.remove("entering"));
    });

    // Auto-dismiss
    setTimeout(() => this.dismiss(id), duration);
  }

  private dismiss(id: string): void {
    const el = this.toasts.get(id);
    if (!el) return;

    el.classList.add("leaving");
    el.addEventListener(
      "transitionend",
      () => {
        el.remove();
        this.toasts.delete(id);
      },
      { once: true },
    );
  }

  destroy(): void {
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.container = null;
    this.toasts.clear();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
