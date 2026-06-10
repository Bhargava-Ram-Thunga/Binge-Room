# Adding a New Platform Adapter

## Steps

### 1. Create the adapter class

```ts
// apps/extension/src/content/netflix/netflix-adapter.ts
import { BaseAdapter } from '@binge-room/platform-sdk';
import type { VideoState } from '@binge-room/shared-types';

export class NetflixAdapter extends BaseAdapter {
  readonly platform = 'netflix' as const;

  isActive(): boolean {
    return window.location.hostname.includes('netflix.com');
  }

  getVideoId(): string | null {
    // Netflix uses /watch/<id> URL pattern
    const match = window.location.pathname.match(/\/watch\/(\d+)/);
    return match ? match[1] : null;
  }

  getVideoUrl(): string {
    return window.location.href;
  }

  getCurrentTime(): number {
    const video = document.querySelector('video');
    return video?.currentTime ?? 0;
  }

  isPlaying(): boolean {
    const video = document.querySelector('video');
    return video ? !video.paused : false;
  }

  isAdPlaying(): boolean {
    // Netflix doesn't have ads in the traditional sense,
    // but check for pre-roll / recap skippers
    return !!document.querySelector('.watch-video--skip-content');
  }

  play(): void {
    (document.querySelector('video') as HTMLVideoElement)?.play();
  }

  pause(): void {
    (document.querySelector('video') as HTMLVideoElement)?.pause();
  }

  seek(time: number): void {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (video) video.currentTime = time;
  }

  getVideoState(): Partial<VideoState> {
    return {
      videoId: this.getVideoId() ?? '',
      videoUrl: this.getVideoUrl(),
      currentTime: this.getCurrentTime(),
      isPlaying: this.isPlaying(),
      isAdPlaying: this.isAdPlaying(),
      lastUpdated: Date.now(),
    };
  }

  onPlay(callback: (time: number) => void) {
    const video = document.querySelector('video');
    if (!video) return () => {};
    const handler = () => callback(this.getCurrentTime());
    this.addDomListener(video, 'play', handler);
    return () => video.removeEventListener('play', handler);
  }

  // ... implement onPause, onSeeked, onVideoChange, onAdStart, onAdEnd
}
```

### 2. Register the adapter

```ts
// apps/extension/src/content/index.ts
import { AdapterRegistry } from '@binge-room/platform-sdk';
import { NetflixAdapter } from './netflix/netflix-adapter.js';

AdapterRegistry.register('netflix', () => new NetflixAdapter());
```

### 3. Add to manifest.json

```json
{
  "content_scripts": [
    {
      "matches": [
        "https://www.netflix.com/*"
      ],
      "js": ["content.js"]
    }
  ],
  "host_permissions": [
    "https://www.netflix.com/*"
  ]
}
```

### 4. Add to Platform type

In `packages/shared-types/src/index.ts`:
```ts
export type Platform = 'youtube' | 'netflix' | ...;
```

That's it — no changes to `SyncEngine`, `ToastManager`, `Gateway`, or any
server code.
