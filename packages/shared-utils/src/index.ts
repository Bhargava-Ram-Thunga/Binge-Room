// ─── Room ID / Code Generation ────────────────────────────────────────────────

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function generateUserId(): string {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Time Formatting ──────────────────────────────────────────────────────────

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Debounce ─────────────────────────────────────────────────────────────────

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── Throttle ─────────────────────────────────────────────────────────────────

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ─── Drift Correction ─────────────────────────────────────────────────────────

export function computeExpectedTime(
  videoState: { currentTime: number; isPlaying: boolean; lastUpdated: number; playbackRate?: number },
  serverTime: number,
): number {
  if (!videoState.isPlaying) return videoState.currentTime;
  const rate = videoState.playbackRate ?? 1;
  const elapsed = (serverTime - videoState.lastUpdated) / 1000;
  return videoState.currentTime + elapsed * rate;
}

export function isDriftExceeded(
  actual: number,
  expected: number,
  thresholdMs: number,
): boolean {
  return Math.abs(actual - expected) * 1000 > thresholdMs;
}

// ─── YouTube URL Helpers ──────────────────────────────────────────────────────

export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?#]+)/,
    /embed\/([^?#]+)/,
    /shorts\/([^?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function buildYouTubeUrl(videoId: string, time?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return time !== undefined ? `${base}&t=${Math.floor(time)}s` : base;
}

// ─── String Sanitization ──────────────────────────────────────────────────────

export function sanitizeUsername(name: string): string {
  return name.trim().replace(/[<>&"'/]/g, '').slice(0, 32) || 'Anonymous';
}

// ─── Invite Link ──────────────────────────────────────────────────────────────

export function buildInviteLink(code: string, baseUrl = 'https://bingeroom.app'): string {
  return `${baseUrl}/join/${code}`;
}

// ─── Unique ID (for toasts, etc.) ────────────────────────────────────────────

export function nanoid(length = 8): string {
  return Math.random().toString(36).slice(2, 2 + length);
}
