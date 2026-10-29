import { handleGroqVoiceWarRoomChat } from '@/lib/server/groq-voice-war-room-chat';

// Next.js 16 with cacheComponents:true does not allow route-segment `runtime` exports.
// Node.js is the default runtime, so do not export `runtime` here.
export async function POST(request) {
  return handleGroqVoiceWarRoomChat(request);
}
