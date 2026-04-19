"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface MyUniUser {
  id: string;
  name: string;
  role: 'student' | 'admin' | 'teacher';
  password: string;
}

interface UserStoreType {
  users: MyUniUser[];
  addUser: (user: Omit<MyUniUser, 'id'>) => void;
  removeUser: (id: string) => void;
  resetPassword: (id: string, newPassword: string) => void;
  isLoaded: boolean;
}

const defaultUsers: MyUniUser[] = [
  { id: 'admin_1', name: 'Master Admin', role: 'admin', password: 'admin' },
  { id: 'student_default', name: 'Default Student', role: 'student', password: 'password' },
];

const UserContext = createContext<UserStoreType>({
  users: defaultUsers,
  addUser: () => {},
  removeUser: () => {},
  resetPassword: () => {},
  isLoaded: false,
});

export function UserStoreProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<MyUniUser[]>(defaultUsers);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("myuni_users");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Migration: Ensure all legacy users have a password field
          const migrated = parsed.map((u: any) => ({
            ...u,
            password: u.password || (u.role === 'admin' ? 'admin' : 'password')
          }));
          setUsers(migrated);
        } catch (e) {
          console.error("Failed to parse users", e);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("myuni_users", JSON.stringify(users));
    }
  }, [users, isLoaded]);

  const addUser = (user: Omit<MyUniUser, 'id'>) => {
    const newUser = { 
      ...user, 
      id: `${user.role}_${Date.now()}`,
      password: user.password || (user.role === 'admin' ? 'admin' : 'password')
    };
    setUsers(prev => [...prev, newUser]);
  };

  const removeUser = (id: string) => {
    // Prevent deleting the master admin
    if (id === 'admin_1') return;
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const resetPassword = (id: string, newPassword: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, password: newPassword } : u));
  };

  return (
    <UserContext.Provider value={{ users, addUser, removeUser, resetPassword, isLoaded }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserStore = () => useContext(UserContext);
