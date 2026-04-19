"use client";

import React from 'react';
import { X, Home, ChevronRight } from 'lucide-react';
import { useWindowManager } from '@/components/providers';

export function TabBar() {
  const { windows, activeTabId, setActiveTab, closeWindow } = useWindowManager();

  return (
    <div className="flex h-14 w-full items-center gap-1 overflow-x-auto border-b border-white/10 bg-black/45 px-3 backdrop-blur-xl no-scrollbar sm:px-4">
      {/* Home Tab */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex min-h-11 items-center gap-2 rounded-t-xl px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          activeTabId === 'dashboard' 
            ? 'bg-white/10 text-blue-400 border-b-2 border-blue-500' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
        <Home size={14} />
        Dashboard
      </button>

      {windows.map((win) => (
        <div key={win.id} className="relative group flex items-center">
          <button
            onClick={() => setActiveTab(win.id)}
            className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-t-xl px-4 pr-9 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              activeTabId === win.id 
                ? 'bg-white/10 text-white border-b-2 border-white' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <span className="opacity-50 text-[10px]">#</span> {win.title}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
            className="absolute right-2 rounded-md p-1.5 text-slate-500 opacity-0 transition-all hover:bg-white/20 hover:text-white group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
