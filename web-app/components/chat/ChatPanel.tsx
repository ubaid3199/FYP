"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Trash2, X, ChevronRight, ShieldCheck, Globe, Info, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat, useSession, useUserStore } from '@/components/providers';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (nextWidth: number) => void;
}

export function ChatPanel({
  isOpen,
  onClose,
  width,
  minWidth,
  maxWidth,
  onWidthChange,
}: ChatPanelProps) {
  const { messages, isLoading, isRestricted, setIsRestricted, sendMessage, clearChat } = useChat();
  const { session, updateSession } = useSession();
  const { users } = useUserStore();
  const [input, setInput] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isResizing) return;

    // Keep the panel responsive while preserving desktop min/max width constraints.
    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      const responsiveMax = Math.min(maxWidth, Math.max(minWidth, Math.floor(window.innerWidth * 0.85)));
      const clamped = Math.min(responsiveMax, Math.max(minWidth, nextWidth));
      onWidthChange(clamped);
    };

    const stopResize = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, minWidth, maxWidth, onWidthChange]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const content = input;
    setInput('');
    await sendMessage(content);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-24 right-4 top-16 z-[500] flex flex-col rounded-2xl border border-white/10 bg-[#0f172a]/95 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-right duration-300 md:right-8 md:top-20"
      style={{ width: `min(${width}px, calc(100vw - 2rem))` }}
    >
      <button
        type="button"
        aria-label="Resize chat panel"
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={width}
        onMouseDown={() => setIsResizing(true)}
        className={`absolute left-0 top-0 h-full w-2 -translate-x-1/2 cursor-col-resize touch-none ${isResizing ? 'bg-blue-400/30' : 'bg-transparent hover:bg-white/10'}`}
      />
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-white/5 px-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Bot size={22} />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white">MyUni AI</h1>
            <p className="text-[10px] text-green-400 font-medium">● Local Engine Online</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
        >
          <X size={20} />
        </button>
      </header>

      <div className="flex items-center justify-between border-b border-white/5 bg-black/20 p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 border border-white/10">
            <User size={12} className="text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              {users.find(u => u.id === session.userId)?.name || 'Guest User'}
            </span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRestricted(!isRestricted)}
              className={`flex min-h-9 items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-bold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isRestricted 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
              }`}
            >
              {isRestricted ? <ShieldCheck size={12} /> : <Globe size={12} />}
              {isRestricted ? 'RESTRICTED' : 'UNRESTRICTED'}
            </button>
            <div className="group relative">
              <Info size={12} className="text-slate-500 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 scale-0 rounded bg-slate-800 p-2 text-[9px] text-white shadow-xl transition-all group-hover:scale-100 z-[600]">
                {isRestricted 
                  ? "Restricted Mode: AI only answers university-related questions."
                  : "Unrestricted Mode: AI can talk about anything (Coding, History, etc.)."
                }
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all border border-transparent hover:border-red-400/20"
          title="Clear Chat"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-grow space-y-5 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 sm:p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
            <div className="mb-4 rounded-full bg-blue-500/10 p-6 animate-pulse">
              <Bot size={48} className="text-blue-400" />
            </div>
            <p className="max-w-[200px] text-sm font-medium italic">Ask me anything about your university life!</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-xl sm:max-w-[88%] ${
                m.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white/10 text-slate-100 rounded-tl-none border border-white/5'
              }`}>
                {m.content ? (
                  m.role === 'assistant' ? (
                    <div className="chat-markdown">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: (props) => <a {...props} target="_blank" rel="noreferrer" />, 
                          code: ({ className, children, ...props }) => {
                            const isInline = !className;
                            if (isInline) {
                              return (
                                <code className="rounded bg-black/40 px-1.5 py-0.5 text-[0.92em] text-blue-200" {...props}>
                                  {children}
                                </code>
                              );
                            }

                            return (
                              <code className="block whitespace-pre overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-slate-100" {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )
                ) : (isLoading && (
                  <div className="flex flex-col gap-1">
                    <span className="flex gap-1 animate-pulse font-black">● ● ●</span>
                    <span className="text-[9px] opacity-70 uppercase tracking-tighter font-bold">AI is thinking... (Model may take 60s to load)</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 bg-white/5 p-4 sm:p-5">
        <form onSubmit={handleChatSubmit} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="min-h-12 w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-4 pr-12 text-base text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 group-hover:border-white/20"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-400 hover:text-blue-300 disabled:text-slate-600 transition-all hover:scale-110 active:scale-95"
          >
            <Send size={20} />
          </button>
        </form>
        <p className="mt-2 text-[10px] text-center text-slate-500 font-medium">Powered by MyUni Local LLM Engine</p>
      </div>
    </div>
  );
}
