import { useState, useCallback, useRef } from 'react';
import { sendTurnData, signalCompletion } from '../services/qualtrics';
import type {
  Message,
  CombinedTwoDimModel,
  TwoDimTurnData,
  Highlight,
  QualtricsParams,
  TurnIntentChoice,
} from '../types';

function buildCompleteTwoDimTurnData(
  turnIdx: number,
  messages: Message[],
  mm: CombinedTwoDimModel,
  highlights: Highlight[]
): TwoDimTurnData {
  return {
    turnIndex: turnIdx,
    userMessageAt: messages[turnIdx * 2]?.createdAt ?? undefined,
    assistantMessageAt: messages[turnIdx * 2 + 1]?.createdAt ?? undefined,
    userMessage: messages[turnIdx * 2]?.content ?? '',
    assistantMessage: messages[turnIdx * 2 + 1]?.content ?? '',
    twoDimAI: mm.twoDim,
    perspectiveUser: mm.perspectiveUser ?? undefined,
    perspectiveUserReasons: mm.perspectiveUserReasons ?? undefined,
    perspectiveReactions: mm.perspectiveUserReactions ?? undefined,
    turnIntentUser: mm.turnIntentUser ?? undefined,
    turnIntentUserReason: mm.turnIntentUserReason ?? undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}

type AiStyle = 'neutral' | 'challenging' | 'sycophantic';

interface UseChatTwoDimProps {
  qualtricsParams: QualtricsParams;
  aiStyle?: AiStyle;
}

export function useChatTwoDim({ qualtricsParams, aiStyle = 'neutral' }: UseChatTwoDimProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const [twoDimModel, setTwoDimModel] = useState<CombinedTwoDimModel | null>(null);
  const [twoDimModelsByTurn, setTwoDimModelsByTurn] = useState<CombinedTwoDimModel[]>([]);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [livePerspectiveUser, setLivePerspectiveUser] = useState<Record<string, number> | null>(null);

  const [highlightsByMessage, setHighlightsByMessage] = useState<Record<number, number>>({});
  const turnHighlights = useRef<Highlight[]>([]);

  const MAX_TURNS = 20;

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (twoDimModelsByTurn.length >= MAX_TURNS) return;

    const question = input.trim();
    setInput('');
    setIsLoading(true);
    setIsLoadingModel(true);

    // Flush previous turn with complete data
    if (twoDimModelsByTurn.length > 0) {
      const prevIdx = twoDimModelsByTurn.length - 1;
      sendTurnData(
        buildCompleteTwoDimTurnData(prevIdx, messages, twoDimModelsByTurn[prevIdx], turnHighlights.current) as any
      );
      turnHighlights.current = [];
    }

    setLivePerspectiveUser(null);

    const userMessage: Message = { role: 'user', content: question, createdAt: new Date().toISOString() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setStreamingText('');

    try {
      const priorTwoDimModels = twoDimModelsByTurn.map((mm) => ({ twoDim: mm.twoDim }));
      const userAdjustedTwoDimModels = twoDimModelsByTurn.map((mm) => ({
        perspectiveUser: mm.perspectiveUser,
        turnIntentUser: mm.turnIntentUser,
      }));

      const response = await fetch('/api/chat-two-dim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          alias: 'User',
          priorTwoDimModels,
          userAdjustedTwoDimModels,
          aiStyle,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let receivedModel: CombinedTwoDimModel | null = null;

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
              } else if (parsed.type === 'mental_model' && parsed.data?.twoDim) {
                receivedModel = { twoDim: parsed.data.twoDim };
                setTwoDimModel(receivedModel);
                setIsLoadingModel(false);
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

      if (receivedModel) {
        setTwoDimModelsByTurn((prev) => [...prev, receivedModel!]);
      }

      const currentMM = receivedModel || twoDimModel;
      sendTurnData({
        turnIndex: twoDimModelsByTurn.length,
        userMessage: question,
        assistantMessage: fullResponse,
        twoDimAI: currentMM?.twoDim,
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
      setIsLoadingModel(false);
    }
  }, [input, isLoading, messages, twoDimModelsByTurn, twoDimModel]);

  // Perspective slider handlers
  const handlePerspectiveChange = useCallback((key: string, score: number) => {
    setLivePerspectiveUser((prev) => {
      const base = prev ?? twoDimModelsByTurn[twoDimModelsByTurn.length - 1]?.perspectiveUser ?? {};
      return { ...base, [key]: score };
    });
  }, [twoDimModelsByTurn]);

  const handlePerspectiveCancel = useCallback((key: string) => {
    setLivePerspectiveUser((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[key];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, []);

  const handlePerspectiveConfirm = useCallback((key: string, reason: string) => {
    const score = livePerspectiveUser?.[key];
    if (score == null) return;

    setTwoDimModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      const mm = prev[lastIdx];
      const newUser = { ...(mm.perspectiveUser ?? {}), [key]: score };
      const newReasons = { ...(mm.perspectiveUserReasons ?? {}), ...(reason ? { [key]: reason } : {}) };
      return prev.map((m, i) => i === lastIdx ? { ...m, perspectiveUser: newUser, perspectiveUserReasons: newReasons } : m);
    });

    setLivePerspectiveUser((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[key];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, [livePerspectiveUser]);

  const handlePerspectiveReactionChange = useCallback((key: string, dir: 'up' | 'down' | null) => {
    setTwoDimModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      const mm = prev[lastIdx];
      const newReactions = dir == null
        ? (() => { const r = { ...(mm.perspectiveUserReactions ?? {}) }; delete r[key]; return Object.keys(r).length ? r : null; })()
        : { ...(mm.perspectiveUserReactions ?? {}), [key]: dir };
      return prev.map((m, i) => i === lastIdx ? { ...m, perspectiveUserReactions: newReactions } : m);
    });
  }, []);

  const handlePerspectiveSaveComment = useCallback((key: string, comment: string) => {
    if (!comment.trim()) return;
    setTwoDimModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      const mm = prev[lastIdx];
      const newReasons = { ...(mm.perspectiveUserReasons ?? {}), [key]: comment.trim() };
      return prev.map((m, i) => i === lastIdx ? { ...m, perspectiveUserReasons: newReasons } : m);
    });
  }, []);

  // Checkbox override handlers
  const handleTurnIntentChange = useCallback((choice: TurnIntentChoice) => {
    setTwoDimModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      // Clear reason when choice changes
      return prev.map((m, i) => i === lastIdx ? { ...m, turnIntentUser: choice, turnIntentUserReason: null } : m);
    });
  }, []);

  const handleTurnIntentReasonSave = useCallback((reason: string) => {
    if (!reason.trim()) return;
    setTwoDimModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;
      return prev.map((m, i) => i === lastIdx ? { ...m, turnIntentUserReason: reason.trim() } : m);
    });
  }, []);

  const handleSaveHighlight = useCallback((text: string, msgIdx: number, reaction: 'up' | 'down' | null, comment: string) => {
    const highlight: Highlight = { selectedText: text, messageIndex: msgIdx, reaction, comment };
    turnHighlights.current.push(highlight);
    setHighlightsByMessage((prev) => ({ ...prev, [msgIdx]: (prev[msgIdx] ?? 0) + 1 }));
  }, []);

  const signalChatComplete = useCallback(() => {
    if (twoDimModelsByTurn.length > 0) {
      const lastIdx = twoDimModelsByTurn.length - 1;
      sendTurnData(
        buildCompleteTwoDimTurnData(lastIdx, messages, twoDimModelsByTurn[lastIdx], turnHighlights.current) as any
      );
      turnHighlights.current = [];
    }
    signalCompletion(qualtricsParams.sessionId, twoDimModelsByTurn.length);
  }, [qualtricsParams.sessionId, twoDimModelsByTurn, messages]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    streamingText,
    twoDimModel,
    twoDimModelsByTurn,
    isLoadingModel,
    livePerspectiveUser,
    highlightsByMessage,
    isAtLimit: twoDimModelsByTurn.length >= MAX_TURNS,
    handleSend,
    handlePerspectiveChange,
    handlePerspectiveCancel,
    handlePerspectiveConfirm,
    handlePerspectiveReactionChange,
    handlePerspectiveSaveComment,
    handleTurnIntentChange,
    handleTurnIntentReasonSave,
    handleSaveHighlight,
    signalChatComplete,
  };
}
