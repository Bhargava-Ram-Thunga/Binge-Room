/**
 * Zustand store — lives in the popup context.
 * The background service worker holds the canonical state;
 * this store is a local replica for rendering.
 */
import { create } from "zustand";
import type { Room, User, ConnectionStatus } from "../types/index.js";

interface RoomStore {
  // Connection
  isConnected: boolean;
  isConnecting: boolean;

  // Room
  room: Room | null;
  currentUser: User | null;
  isHost: boolean;

  // UI
  error: string | null;
  isCreating: boolean;
  isJoining: boolean;

  // Actions
  setConnected: (v: boolean) => void;
  setConnecting: (v: boolean) => void;
  setRoom: (room: Room | null) => void;
  setCurrentUser: (user: User | null) => void;
  setError: (err: string | null) => void;
  setCreating: (v: boolean) => void;
  setJoining: (v: boolean) => void;
  applyConnectionStatus: (status: ConnectionStatus) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  isConnecting: false,
  room: null,
  currentUser: null,
  isHost: false,
  error: null,
  isCreating: false,
  isJoining: false,
};

export const useRoomStore = create<RoomStore>((set) => ({
  ...initialState,

  setConnected: (v) => set({ isConnected: v }),
  setConnecting: (v) => set({ isConnecting: v }),
  setRoom: (room) => set({ room }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setError: (err) => set({ error: err }),
  setCreating: (v) => set({ isCreating: v }),
  setJoining: (v) => set({ isJoining: v }),

  applyConnectionStatus: (status) =>
    set({
      isConnected: status.connected,
      isHost: status.isHost,
    }),

  reset: () => set(initialState),
}));
