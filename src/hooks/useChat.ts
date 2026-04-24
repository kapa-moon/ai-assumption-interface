// Main chat hook managing messages, streaming, and mental models
// Now calls secure serverless API (api/chat) instead of Azure directly
import { useState, useCallback, useRef } from 'react';
import { sendTurnData, signalCompletion } from '../services/qualtrics';
import type { Message, CombinedMentalModel, TurnData, Highlight, QualtricsParams } from '../types';

interface UseChatProps {
  qualtricsParams: QualtricsParams;
}

export function useChat({ qualtricsParams }: UseChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  // const [lastFeedbackAt, setLastFeedbackAt] = useState(0);

  // Mental model state
  const [mentalModel, setMentalModel] = useState<CombinedMentalModel | null>(null);
  const [mentalModelsByTurn, setMentalModelsByTurn] = useState<CombinedMentalModel[]>([]);
  const [isLoadingMentalModel, setIsLoadingMentalModel] = useState(false);
  const [liveInductUser, setLiveInductUser] = useState<Record<string, number> | null>(null);
  const [liveTypesSupportUser, setLiveTypesSupportUser] = useState<Record<string, number> | null>(null);

  // Highlights state
  const [highlightsByMessage, setHighlightsByMessage] = useState<Record<number, number>>({});
  const turnHighlights = useRef<Highlight[]>([]);

  // Handle sending a message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    setInput('');
    setIsLoading(true);
    setIsLoadingMentalModel(true);

    const userMessage: Message = { role: 'user', content: question, createdAt: new Date().toISOString() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setStreamingText('');

    try {
      // Build prior mental models for context
      const priorMentalModels = mentalModelsByTurn.map((mm) => ({
        induct: mm.induct,
        typesSupport: mm.typesSupport,
      }));
      
      const userAdjustedMentalModels = mentalModelsByTurn.map((mm) => ({
        inductUser: mm.inductUser,
        typesSupportUser: mm.typesSupportUser,
      }));

      // Call secure serverless API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          alias: 'User', // Can be customized based on qualtricsParams
          priorMentalModels,
          userAdjustedMentalModels,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let receivedMentalModel: CombinedMentalModel | null = null;

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
              } else if (parsed.type === 'mental_model' && parsed.data) {
                receivedMentalModel = {
                  induct: parsed.data.induct,
                  typesSupport: parsed.data.typesSupport,
                };
                setMentalModel(receivedMentalModel);
                setIsLoadingMentalModel(false);
              } else if (parsed.type === 'done') {
                // Stream complete
              }
            } catch {
              // Ignore invalid JSON
            }
          }
        }
      }

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: fullResponse,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingText('');

      // Update mental models history
      if (receivedMentalModel) {
        setMentalModelsByTurn((prev) => [...prev, receivedMentalModel!]);
      }

      // Build turn data
      const currentMM = receivedMentalModel || mentalModel;
      const turnData: TurnData = {
        turnIndex: mentalModelsByTurn.length,
        userMessage: question,
        assistantMessage: fullResponse,
        inductAI: currentMM?.induct,
        typesSupportAI: currentMM?.typesSupport,
        inductUser: liveInductUser ? { ...liveInductUser } : undefined,
        typesSupportUser: liveTypesSupportUser ? { ...liveTypesSupportUser } : undefined,
        highlights: [...turnHighlights.current],
      };

      // Send to Qualtrics (stores in chat_data_N field)
      sendTurnData(turnData);

      // Reset live state
      setLiveInductUser(null);
      setLiveTypesSupportUser(null);
      turnHighlights.current = [];

    } catch (err) {
      console.error('Error in chat:', err);
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your message. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsLoadingMentalModel(false);
    }
  }, [input, isLoading, messages, mentalModelsByTurn, mentalModel, liveInductUser, liveTypesSupportUser]);

  // Handle induct score change
  const handleInductChange = useCallback((key: string, score: number) => {
    setLiveInductUser((prev) => {
      const base = prev ?? mentalModelsByTurn[mentalModelsByTurn.length - 1]?.inductUser ?? {};
      return { ...base, [key]: score };
    });
  }, [mentalModelsByTurn]);

  // Handle types support score change
  const handleTypesSupportChange = useCallback((key: string, score: number) => {
    setLiveTypesSupportUser((prev) => {
      const base = prev ?? mentalModelsByTurn[mentalModelsByTurn.length - 1]?.typesSupportUser ?? {};
      return { ...base, [key]: score };
    });
  }, [mentalModelsByTurn]);

  // Handle induct cancel - remove the key from live state without saving
  const handleInductCancel = useCallback((key: string) => {
    setLiveInductUser((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[key];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, []);

  // Handle types support cancel - remove the key from live state without saving
  const handleTypesSupportCancel = useCallback((key: string) => {
    setLiveTypesSupportUser((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[key];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, []);

  // Handle induct confirm
  const handleInductConfirmDimension = useCallback((key: string, reason: string) => {
    const score = liveInductUser?.[key];
    if (score == null) return;

    setMentalModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;

      const currentMM = prev[lastIdx];
      const newInductUser = { ...(currentMM.inductUser ?? {}), [key]: score };
      const newInductUserReasons = {
        ...(currentMM.inductUserReasons ?? {}),
        ...(reason ? { [key]: reason } : {}),
      };

      return prev.map((mm, i) =>
        i === lastIdx
          ? { ...mm, inductUser: newInductUser, inductUserReasons: newInductUserReasons }
          : mm
      );
    });

    setLiveInductUser((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[key];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, [liveInductUser]);

  // Handle types support confirm
  const handleTypesSupportConfirmDimension = useCallback((key: string, reason: string) => {
    const score = liveTypesSupportUser?.[key];
    if (score == null) return;

    setMentalModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;

      const currentMM = prev[lastIdx];
      const newTypesSupportUser = { ...(currentMM.typesSupportUser ?? {}), [key]: score };
      const newTypesSupportUserReasons = {
        ...(currentMM.typesSupportUserReasons ?? {}),
        ...(reason ? { [key]: reason } : {}),
      };

      return prev.map((mm, i) =>
        i === lastIdx
          ? { ...mm, typesSupportUser: newTypesSupportUser, typesSupportUserReasons: newTypesSupportUserReasons }
          : mm
      );
    });

    setLiveTypesSupportUser((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[key];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, [liveTypesSupportUser]);

  // Handle induct reaction
  const handleInductReactionChange = useCallback((key: string, dir: 'up' | 'down' | null) => {
    setMentalModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;

      const currentMM = prev[lastIdx];
      const newReactions = dir == null
        ? (() => {
            const r = { ...(currentMM.inductUserReactions ?? {}) };
            delete r[key];
            return Object.keys(r).length > 0 ? r : null;
          })()
        : { ...(currentMM.inductUserReactions ?? {}), [key]: dir };

      return prev.map((mm, i) =>
        i === lastIdx ? { ...mm, inductUserReactions: newReactions } : mm
      );
    });
  }, []);

  // Handle types support reaction
  const handleTypesSupportReactionChange = useCallback((key: string, dir: 'up' | 'down' | null) => {
    setMentalModelsByTurn((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx < 0) return prev;

      const currentMM = prev[lastIdx];
      const newReactions = dir == null
        ? (() => {
            const r = { ...(currentMM.typesSupportUserReactions ?? {}) };
            delete r[key];
            return Object.keys(r).length > 0 ? r : null;
          })()
        : { ...(currentMM.typesSupportUserReactions ?? {}), [key]: dir };

      return prev.map((mm, i) =>
        i === lastIdx ? { ...mm, typesSupportUserReactions: newReactions } : mm
      );
    });
  }, []);

  // Handle highlight save
  const handleSaveHighlight = useCallback((text: string, msgIdx: number, reaction: 'up' | 'down' | null, comment: string) => {
    const highlight: Highlight = {
      selectedText: text,
      messageIndex: msgIdx,
      reaction,
      comment,
    };
    turnHighlights.current.push(highlight);
    setHighlightsByMessage((prev) => ({ ...prev, [msgIdx]: (prev[msgIdx] ?? 0) + 1 }));
  }, []);

  // Signal completion
  const signalChatComplete = useCallback(() => {
    signalCompletion(qualtricsParams.sessionId, mentalModelsByTurn.length);
  }, [qualtricsParams.sessionId, mentalModelsByTurn.length]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    streamingText,
    mentalModel,
    mentalModelsByTurn,
    isLoadingMentalModel,
    liveInductUser,
    liveTypesSupportUser,
    highlightsByMessage,
    handleSend,
    handleInductChange,
    handleTypesSupportChange,
    handleInductConfirmDimension,
    handleTypesSupportConfirmDimension,
    handleInductCancel,
    handleTypesSupportCancel,
    handleInductReactionChange,
    handleTypesSupportReactionChange,
    handleSaveHighlight,
    signalChatComplete,
  };
}
