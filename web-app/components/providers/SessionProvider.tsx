"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface UserSession {
  userId: string;
  role: 'student' | 'admin' | 'teacher';
  lastVisitedTool: string | null;
  lastVisitedPath: string | null;
  isAuthenticated: boolean;
  previewMode: boolean;
}

interface SessionContextType {
  session: UserSession;
  updateSession: (updates: Partial<UserSession>) => void;
  login: (userId: string, role: UserSession['role']) => void;
  logout: () => void;
  isLoaded: boolean;
}

const defaultSession: UserSession = {
  userId: "student_default",
  role: 'student',
  lastVisitedTool: null,
  lastVisitedPath: null,
  isAuthenticated: false,
  previewMode: false,
};

const SessionContext = createContext<SessionContextType>({
  session: defaultSession,
  updateSession: () => {},
  login: () => {},
  logout: () => {},
  isLoaded: false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession>(defaultSession);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Hydrate the auth/session snapshot once during app boot.
    const saved = localStorage.getItem("myuni_session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse session", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const updateSession = (updates: Partial<UserSession>) => {
    setSession((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem("myuni_session", JSON.stringify(updated));
      return updated;
    });
  };

  const login = (userId: string, role: UserSession['role']) => {
    updateSession({ userId, role, isAuthenticated: true, previewMode: false });
  };

  const logout = () => {
    updateSession({ ...defaultSession, isAuthenticated: false });
  };

  return (
    <SessionContext.Provider value={{ session, updateSession, login, logout, isLoaded }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
