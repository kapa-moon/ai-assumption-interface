// Client-side Azure OpenAI utilities
// Note: Main chat and mental model inference now happen via serverless API (api/chat)
// This file can be removed or kept for future client-side utilities

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// This file is kept minimal as all Azure calls are now server-side
// See api/chat/route.ts for the secure implementation
