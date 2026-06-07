/**
 * useRoom — convenience hook for popup components.
 * Polls background for room state on mount and subscribes to live updates.
 */
import { useEffect } from 'react';
import { useRoomStore } from '../store/room.store.js';
import { roomService } from '../services/room.service.js';
import type { Room, User, ConnectionStatus } from '../types/index.js';

export function useRoom() {
  const store = useRoomStore();

  useEffect(() => {
    // Initial load
    roomService.getRoomState().then((res) => {
      if (res.success && res.data) {
        store.setRoom(res.data.room ?? null);
        store.setCurrentUser(res.data.user ?? null);
        if (res.data.status) store.applyConnectionStatus(res.data.status);
      }
    });

    // Live updates from background
    const handler = (message: { type: string; payload: Record<string, unknown> }) => {
      switch (message.type) {
        case 'ROOM_UPDATE':
          if ('room' in message.payload) store.setRoom((message.payload.room as Room) ?? null);
          if ('user' in message.payload) store.setCurrentUser((message.payload.user as User) ?? null);
          break;
        case 'CONNECTION_STATUS':
          store.applyConnectionStatus(message.payload as unknown as ConnectionStatus);
          store.setConnected((message.payload.connected as boolean) ?? false);
          break;
        case 'ERROR':
          store.setError((message.payload.message as string) ?? 'Unknown error');
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  return store;
}
