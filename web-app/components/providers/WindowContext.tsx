"use client";

import React, { createContext, useContext, useState } from 'react';

export interface WindowInstance {
  id: string;
  title: string;
  url: string;
  zIndex: number;
}

interface WindowContextType {
  windows: WindowInstance[];
  activeTabId: string;
  openWindow: (title: string, url: string) => void;
  closeWindow: (id: string) => void;
  setActiveTab: (id: string) => void;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [activeTabId, setActiveTab] = useState('dashboard');

  const openWindow = (title: string, url: string) => {
    // Check if window with same title/url already exists to avoid duplicates
    const existing = windows.find(w => w.url === url);
    if (existing) {
      setActiveTab(existing.id);
      return;
    }

    const id = Math.random().toString(36).substr(2, 9);
    setWindows(prev => [
      ...prev,
      { id, title, url, zIndex: 0 } // zIndex is less important in tab mode
    ]);
    setActiveTab(id);
  };

  const closeWindow = (id: string) => {
    setWindows(prev => {
      const remaining = prev.filter(w => w.id !== id);
      if (activeTabId === id) {
        setActiveTab('dashboard');
      }
      return remaining;
    });
  };

  return (
    <WindowContext.Provider value={{ windows, activeTabId, openWindow, closeWindow, setActiveTab }}>
      {children}
    </WindowContext.Provider>
  );
}

export const useWindowManager = () => {
  const context = useContext(WindowContext);
  if (!context) throw new Error("useWindowManager must be used within a WindowProvider");
  return context;
};
