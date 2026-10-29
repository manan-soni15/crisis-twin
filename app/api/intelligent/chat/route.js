// Backward-compatible alias. The Voice War Room's canonical URL is
// /api/intelligence/chat. Keep this route only for any legacy callers.
import { handleGroqVoiceWarRoomChat } from '@/lib/server/groq-voice-war-room-chat';

// Do not export `runtime`: this project enables `cacheComponents: true` in
// Next.js 16, where Route Segment Config exports such as `runtime` are invalid.
export async function POST(request) {
  return handleGroqVoiceWarRoomChat(request);
}
