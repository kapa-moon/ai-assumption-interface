// Qualtrics integration via postMessage API
import type { TurnData } from '../types';
import LZString from 'lz-string';

const QUALTRICS_ORIGIN = import.meta.env.VITE_QUALTRICS_PARENT_ORIGIN || '*';

// Chunk size for Qualtrics Embedded Data (~12KB to stay under 16KB limit)
const CHUNK_SIZE = 12000;

export interface QualtricsParams {
  participantId: string;
  condition: string;
  sessionId: string;
}

// Parse URL parameters from Qualtrics
export function parseQualtricsParams(): QualtricsParams {
  const params = new URLSearchParams(window.location.search);
  const participantId = params.get('pid') || `anon_${Date.now()}`;
  const condition = params.get('cond') || 'control';
  const sessionId = params.get('sid') || `sess_${Date.now()}`;
  
  return { participantId, condition, sessionId };
}

// Check if running inside Qualtrics iframe
export function isInQualtrics(): boolean {
  return window.parent !== window;
}

// Send message to Qualtrics parent
function sendToQualtrics(type: string, payload: Record<string, unknown>): void {
  if (window.parent !== window) {
    window.parent.postMessage({ type, ...payload }, QUALTRICS_ORIGIN);
  }
}

// Send a chunk of data to Qualtrics
export function sendChunk(
  fieldName: string,
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): void {
  sendToQualtrics('CHAT_DATA_CHUNK', {
    fieldName,
    chunk,
    chunkIndex,
    totalChunks,
  });
}

// Compress and chunk turn data for Qualtrics
export function sendTurnsToQualtrics(turns: TurnData[]): void {
  const data = JSON.stringify({ turns });
  
  // Try compression first
  const compressed = LZString.compressToBase64(data);
  
  // If compressed fits in one chunk, send it
  if (compressed.length < CHUNK_SIZE) {
    sendToQualtrics('CHAT_DATA_CHUNK', {
      fieldName: 'chat_data_1',
      chunk: compressed,
      chunkIndex: 0,
      totalChunks: 1,
      compressed: true,
    });
    return;
  }
  
  // Otherwise, split into chunks
  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
    chunks.push(compressed.slice(i, i + CHUNK_SIZE));
  }
  
  chunks.forEach((chunk, idx) => {
    sendChunk(`chat_data_${idx + 1}`, chunk, idx, chunks.length);
  });
}

// Signal completion to Qualtrics
export function signalCompletion(
  sessionId: string,
  turnCount: number,
  finalData?: string
): void {
  sendToQualtrics('CHAT_COMPLETE', {
    sessionId,
    turnCount,
    finalData,
  });
}

// Send a single turn update (for real-time logging)
export function sendTurnUpdate(turn: TurnData): void {
  const data = JSON.stringify(turn);
  const compressed = LZString.compressToBase64(data);
  
  sendToQualtrics('TURN_UPDATE', {
    turnIndex: turn.turnIndex,
    compressedData: compressed,
  });
}

// Listen for messages from Qualtrics (optional, for bidirectional)
export function listenToQualtrics(
  callback: (message: MessageEvent) => void
): () => void {
  const handler = (event: MessageEvent) => {
    // Verify origin if specified
    if (QUALTRICS_ORIGIN !== '*' && event.origin !== QUALTRICS_ORIGIN) {
      return;
    }
    callback(event);
  };
  
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
