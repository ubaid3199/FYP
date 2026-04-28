"use client";

import { useSession } from './SessionProvider';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

type ChatModel = string;
const DEFAULT_CHAT_MODEL: ChatModel = 'automatic';
const FALLBACK_MODELS: ChatModel[] = [
  'automatic',
  'gemma3:1b',
  'gemma3:latest',
  'gemma4:e2b',
  'gemma4:e4b',
  'llava:llava',
  'llava:latest',
  'gpt-oss:20b',
  'llama3',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: ChatModel;
}

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  isRestricted: boolean;
  setIsRestricted: (value: boolean) => void;
  selectedModel: ChatModel;
  setSelectedModel: (value: ChatModel) => void;
  availableModels: ChatModel[];
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestricted, setIsRestricted] = useState(true); // Default to restricted from Phase 9/12
  const [selectedModel, setSelectedModel] = useState<ChatModel>(DEFAULT_CHAT_MODEL);
  const [availableModels, setAvailableModels] = useState<ChatModel[]>(FALLBACK_MODELS);
  const { session, isLoaded } = useSession();
  const isMounted = useRef(true);

  // Persist chat history per user so account switches never leak conversations.
  const historyKey = `uni-chat-history-${session.userId}`;
  const modelKey = `uni-chat-model-${session.userId}`;

  // 1. Load history from LocalStorage when user changes or app loads
  useEffect(() => {
    if (!isLoaded) return;
    
    isMounted.current = true;
    const saved = localStorage.getItem(historyKey);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load chat history:", err);
        setMessages([]); // Reset on error
      }
    } else {
      setMessages([]); // Start fresh for new user
    }
    return () => { isMounted.current = false; };
  }, [session.userId, isLoaded, historyKey]);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    const loadModels = async () => {
      try {
        const res = await fetch('/api/assistant/models', { method: 'GET' });
        const data = await res.json().catch(() => null) as any;
        const models = Array.isArray(data?.models) ? data.models.filter((m: any) => typeof m === 'string' && m.trim()) : [];
        const nextAvailable = Array.from(new Set(['automatic', ...models]));
        if (cancelled) return;
        setAvailableModels(nextAvailable);

        const savedModel = localStorage.getItem(modelKey);
        if (savedModel && nextAvailable.includes(savedModel)) {
          setSelectedModel(savedModel);
        } else {
          setSelectedModel(DEFAULT_CHAT_MODEL);
        }
      } catch (err) {
        if (cancelled) return;
        setAvailableModels(FALLBACK_MODELS);

        const savedModel = localStorage.getItem(modelKey);
        if (savedModel && FALLBACK_MODELS.includes(savedModel)) {
          setSelectedModel(savedModel);
        } else {
          setSelectedModel(DEFAULT_CHAT_MODEL);
        }
      }
    };

    loadModels();
    return () => { cancelled = true; };
  }, [isLoaded, modelKey]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(modelKey, selectedModel);
  }, [isLoaded, modelKey, selectedModel]);

  // 2. Save history to LocalStorage
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      localStorage.setItem(historyKey, JSON.stringify(messages));
    }
  }, [messages, historyKey, isLoaded]);

  const clearChat = () => {
    if (confirm("Are you sure you want to clear your chat history?")) {
      setMessages([]);
      localStorage.removeItem(historyKey);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;
    
    console.log("[MyUni Chat] sendMessage called:", content);
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setIsLoading(true);

    try {
      console.log("[MyUni Chat] Fetching /api/assistant/chat...");
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          userId: session.userId,
          isRestricted: isRestricted,
          model: selectedModel,
        }),
      });

      console.log("[MyUni Chat] Fetch response status:", response.status);

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      // Add a placeholder message and stream tokens into it incrementally.
      setMessages(prev => [
        ...prev,
        { id: 'assistant-' + Date.now(), role: 'assistant', content: '', model: selectedModel },
      ]);

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep any incomplete trailing line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                if (lastIndex >= 0 && newMessages[lastIndex].role === 'assistant') {
                  newMessages[lastIndex] = { 
                    ...newMessages[lastIndex], 
                    content: newMessages[lastIndex].content + data.message.content 
                  };
                }
                return newMessages;
              });
            }
          } catch (err) {
            // Ignore partial/invalid JSON lines
          }
        }
      }

      // Process any remaining complete data in the buffer
      if (buffer.trim()) {
        const remainingLines = buffer.split('\n');
        for (const line of remainingLines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                if (lastIndex >= 0 && newMessages[lastIndex].role === 'assistant') {
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: newMessages[lastIndex].content + data.message.content
                  };
                }
                return newMessages;
              });
            }
          } catch (err) {
            console.warn("[MyUni Chat] Could not parse remaining buffer line:", err);
          }
        }
      }
    } catch (error: any) {
      console.error("[MyUni Chat] Detailed Error:", error);
      setMessages(prev => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: `Connection Error: ${error.message || "Unknown error"}. Is the AI server (Ollama) running locally and responding?`,
        model: selectedModel,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        isRestricted,
        setIsRestricted,
        selectedModel,
        setSelectedModel,
        availableModels,
        sendMessage,
        clearChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within a ChatProvider");
  return context;
};
