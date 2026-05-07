import { useState, useCallback, useRef } from 'react';
import { sendTurnData, signalCompletion } from '../services/qualtrics';
import type {
  Message,
  UserSelfReport,
  NeutralTurnData,
  Highlight,
  QualtricsParams,
  TurnIntentChoice,
} from '../types';

function buildNeutralTurnData(
  turnIdx: number,
  messages: Message[],
  selfReport: UserSelfReport,
  highlights: Highlight[]
): NeutralTurnData {
  return {
    turnIndex: turnIdx,
    userMessageAt: messages[turnIdx * 2]?.createdAt ?? undefined,
    assistantMessageAt: messages[turnIdx * 2 + 1]?.createdAt ?? undefined,
    userMessage: messages[turnIdx * 2]?.content ?? '',
    assistantMessage: messages[turnIdx * 2 + 1]?.content ?? '',
    selfReport,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}

interface UseChatNeutralProps {
  qualtricsParams: QualtricsParams;
}

export function useChatNeutral({ qualtricsParams }: UseChatNeutralProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // One self-report entry per completed turn (user-filled, no AI inference)
  const [selfReportsByTurn, setSelfReportsByTurn] = useState<UserSelfReport[]>([]);

  const [highlightsByMessage, setHighlightsByMessage] = useState<Record<number, number>>({});
  const turnHighlights = useRef<Highlight[]>([]);

  const MAX_TURNS = 20;

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (selfReportsByTurn.length >= MAX_TURNS) return;

    const question = input.trim();
    setInput('');
    setIsLoading(true);

    // Flush previous turn's complete data before this send
    if (selfReportsByTurn.length > 0) {
      const prevIdx = selfReportsByTurn.length - 1;
      sendTurnData(
        buildNeutralTurnData(prevIdx, messages, selfReportsByTurn[prevIdx], turnHighlights.current) as any
      );
      turnHighlights.current = [];
    }

    const userMessage: Message = { role: 'user', content: question, createdAt: new Date().toISOString() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setStreamingText('');

    try {
      const response = await fetch('/api/chat-neutral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          alias: 'User',
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text' && parsed.text) {
                fullResponse += parsed.text;
                setStreamingText(fullResponse);
              }
            } catch { /* ignore */ }
          }
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: fullResponse,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingText('');

      // Append a blank self-report entry for this new turn
      setSelfReportsByTurn((prev) => [...prev, {}]);

      // Write initial turn record (no self-report yet)
      sendTurnData({
        turnIndex: selfReportsByTurn.length,
        userMessage: question,
        assistantMessage: fullResponse,
      } as any);

    } catch (err) {
      console.error('Error in chat:', err);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your message. Please try again.',
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, selfReportsByTurn]);

  // Self-report field updaters — directly update the last turn's entry (no confirm step)
  const handleValidationSupportChange = useCallback((score: number) => {
    setSelfReportsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      return prev.map((r, i) => i === lastIdx ? { ...r, validationSupport: score } : r);
    });
  }, []);

  const handleObjectivityInformationChange = useCallback((score: number) => {
    setSelfReportsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      return prev.map((r, i) => i === lastIdx ? { ...r, objectivityInformation: score } : r);
    });
  }, []);

  const handleTurnIntentChange = useCallback((choice: TurnIntentChoice) => {
    setSelfReportsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      // Clear reason when choice changes
      return prev.map((r, i) => i === lastIdx ? { ...r, turnIntent: choice, turnIntentReason: undefined } : r);
    });
  }, []);

  const handleTurnIntentReasonSave = useCallback((reason: string) => {
    if (!reason.trim()) return;
    setSelfReportsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      return prev.map((r, i) => i === lastIdx ? { ...r, turnIntentReason: reason.trim() } : r);
    });
  }, []);

  const handleSaveHighlight = useCallback((text: string, msgIdx: number, reaction: 'up' | 'down' | null, comment: string) => {
    const highlight: Highlight = { selectedText: text, messageIndex: msgIdx, reaction, comment };
    turnHighlights.current.push(highlight);
    setHighlightsByMessage((prev) => ({ ...prev, [msgIdx]: (prev[msgIdx] ?? 0) + 1 }));
  }, []);

  const signalChatComplete = useCallback(() => {
    if (selfReportsByTurn.length > 0) {
      const lastIdx = selfReportsByTurn.length - 1;
      sendTurnData(
        buildNeutralTurnData(lastIdx, messages, selfReportsByTurn[lastIdx], turnHighlights.current) as any
      );
      turnHighlights.current = [];
    }
    signalCompletion(qualtricsParams.sessionId, selfReportsByTurn.length);
  }, [qualtricsParams.sessionId, selfReportsByTurn, messages]);

  const lastReport = selfReportsByTurn[selfReportsByTurn.length - 1];
  const currentTurn = selfReportsByTurn.length;
  const isMandatoryReviewTurn = currentTurn === 1 || (currentTurn > 1 && currentTurn % 4 === 0);
  const isReportComplete =
    lastReport != null &&
    lastReport.validationSupport != null &&
    lastReport.objectivityInformation != null &&
    lastReport.turnIntent != null;

  return {
    messages,
    input,
    setInput,
    isLoading,
    streamingText,
    selfReportsByTurn,
    highlightsByMessage,
    isAtLimit: selfReportsByTurn.length >= MAX_TURNS,
    currentTurn,
    isMandatoryReviewTurn,
    isReportComplete,
    handleSend,
    handleValidationSupportChange,
    handleObjectivityInformationChange,
    handleTurnIntentChange,
    handleTurnIntentReasonSave,
    handleSaveHighlight,
    signalChatComplete,
  };
}
