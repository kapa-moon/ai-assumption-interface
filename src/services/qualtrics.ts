// Qualtrics integration via postMessage API
import type { TurnData } from '../types';

const QUALTRICS_ORIGIN = import.meta.env.VITE_QUALTRICS_PARENT_ORIGIN || '*';

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

// Send a single turn data to Qualtrics (stores in chat_data_N field)
export function sendTurnData(turn: TurnData): void {
  const fieldName = `chat_data_${turn.turnIndex + 1}`; // 1-based indexing
  const data = JSON.stringify(turn);
  
  sendToQualtrics('SET_EMBEDDED_DATA', {
    field: fieldName,
    value: data,
  });
}

// Keep for backward compatibility - sends all turns as individual fields
export function sendTurnsToQualtrics(turns: TurnData[]): void {
  turns.forEach((turn) => {
    sendTurnData(turn);
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

// Send a single turn update (stores in chat_data_N field)
export function sendTurnUpdate(turn: TurnData): void {
  sendTurnData(turn);
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
