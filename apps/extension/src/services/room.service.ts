/**
 * Room service — thin wrapper over chrome.runtime.sendMessage
 * so popup components stay declarative.
 */
import type {
  ConnectionStatus,
  Room,
  User,
  CreateRoomPayload,
  JoinRoomPayload,
} from "../types/index.js";

interface BgResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function sendToBg<T>(
  type: string,
  payload?: unknown,
): Promise<BgResponse<T>> {
  return chrome.runtime.sendMessage({ type, payload });
}

export const roomService = {
  async createRoom(userName: string, videoUrl?: string): Promise<BgResponse> {
    const videoId = extractYouTubeId(videoUrl ?? "");
    return sendToBg("CREATE_ROOM", {
      userName,
      platform: "youtube",
      videoId,
      videoUrl: videoUrl ?? "",
    } satisfies CreateRoomPayload);
  },

  async joinRoom(userName: string, code: string): Promise<BgResponse> {
    return sendToBg("JOIN_ROOM", {
      code: code.toUpperCase().trim(),
      userName,
      platform: "youtube",
    } satisfies JoinRoomPayload);
  },

  async leaveRoom(): Promise<BgResponse> {
    return sendToBg("LEAVE_ROOM");
  },

  async getRoomState(): Promise<
    BgResponse<{
      room: Room | null;
      user: User | null;
      status: ConnectionStatus;
    }>
  > {
    return sendToBg("GET_ROOM_STATE");
  },

  async getConnectionStatus(): Promise<BgResponse<ConnectionStatus>> {
    return sendToBg("GET_CONNECTION_STATUS");
  },

  async toggleControls(locked: boolean): Promise<BgResponse> {
    return sendToBg("TOGGLE_CONTROLS", { locked });
  },
};

function extractYouTubeId(url: string): string {
  const match = url.match(/[?&]v=([^&#]+)/) ?? url.match(/youtu\.be\/([^?#]+)/);
  return match ? match[1] : "";
}
