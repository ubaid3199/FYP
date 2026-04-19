"use client";

import React, { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat";
import { TabBar } from "@/components/layout";
import { useSession, useWindowManager } from "@/components/providers";
import { Bot, ShieldCheck, EyeOff } from "lucide-react";
import { Login } from "@/components/auth";

const CHAT_WIDTH_STORAGE_KEY = "myuni.chatPanelWidth";
const CHAT_DEFAULT_WIDTH = 400;
const CHAT_MIN_WIDTH = 320;
const CHAT_MAX_WIDTH = 900;

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [chatWidth, setChatWidth] = useState(() => {
    if (typeof window === "undefined") return CHAT_DEFAULT_WIDTH;

    const stored = window.localStorage.getItem(CHAT_WIDTH_STORAGE_KEY);
    if (!stored) return CHAT_DEFAULT_WIDTH;

    const parsed = Number(stored);
    if (Number.isNaN(parsed)) return CHAT_DEFAULT_WIDTH;

    return Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, parsed));
  });
  const { windows, activeTabId } = useWindowManager();
  const { session, logout, updateSession, isLoaded } = useSession();

  const activeWindow = windows.find(w => w.id === activeTabId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsEmbedded(window.self !== window.top);
  }, []);

  if (!isLoaded) return null;

  if (!session.isAuthenticated) {
    return <Login />;
  }

  // When rendered inside an iframe (tool view), avoid drawing the full shell
  // to prevent nested tabs and chat panes inside an existing tab.
  if (isEmbedded) {
    return <div className="h-screen overflow-hidden bg-transparent">{children}</div>;
  }

  const handleChatWidthChange = (nextWidth: number) => {
    const clamped = Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, nextWidth));
    setChatWidth(clamped);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(clamped));
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-transparent selection:bg-blue-500/30">
      {/* Admin Preview Banner */}
      {session.role === 'admin' && session.previewMode && (
        <div className="bg-purple-600 text-white py-1 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-xl z-[1100]">
          <ShieldCheck size={12} /> Viewing as Student (Simulation Mode)
          <button 
            onClick={() => updateSession({ previewMode: false })}
            className="bg-white/20 hover:bg-white/30 px-3 py-0.5 rounded-full transition-all flex items-center gap-1"
          >
            <EyeOff size={10} /> Exit Preview
          </button>
        </div>
      )}
      {/* Top Tab Bar */}
      <TabBar />
      
      <div className="flex-grow flex overflow-hidden relative">
        <main className="flex-grow overflow-auto">
          {/* Dashboard View */}
          <div className={activeTabId === 'dashboard' ? 'block min-h-full' : 'hidden'}>
            {children}
          </div>

          {/* Active Tool View */}
          {activeTabId !== 'dashboard' && activeWindow && (
            <div className="h-full w-full bg-white animate-in fade-in zoom-in-95 duration-200">
              <iframe 
                src={activeWindow.url} 
                className="h-full w-full border-none"
                title={activeWindow.title}
              />
            </div>
          )}
        </main>

        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          width={chatWidth}
          minWidth={CHAT_MIN_WIDTH}
          maxWidth={CHAT_MAX_WIDTH}
          onWidthChange={handleChatWidthChange}
        />

        {/* Persistent Chat Toggle Button */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-8 right-8 z-[1000] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl transition-all hover:bg-blue-500 hover:scale-110 active:scale-95 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Bot size={28} />
            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold border-2 border-[#0a0a0b] animate-bounce">
              AI
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

