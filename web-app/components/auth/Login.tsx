"use client";

import React, { useState } from 'react';
import { LogIn, ShieldCheck, User, Loader2, AlertCircle } from 'lucide-react';
import { useSession, useUserStore } from '@/components/providers';

export function Login() {
  const { login } = useSession();
  const { users } = useUserStore();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !password) return;

    setIsLoggingIn(true);
    setError('');

    // Simulate a small delay for premium feel
    setTimeout(() => {
      const user = users.find(u => u.id === selectedUserId);
      
      if (user && user.password === password) {
        login(user.id, user.role);
      } else {
        setError('Invalid credentials. Please contact your administrator.');
        setIsLoggingIn(false);
      }
    }, 800);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0b] p-4 sm:p-6">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />

      <div className="z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-400 mb-6 shadow-2xl ring-1 ring-blue-500/20">
            <LogIn size={32} />
          </div>
          <h1 className="mb-2 text-4xl font-black tracking-tight text-white sm:text-5xl">MyUni Portal</h1>
          <p className="text-sm text-slate-300">Secure Institutional Access Gateway</p>
        </div>

        <form onSubmit={handleLogin} className="glass-panel space-y-6 p-8 ring-1 ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
                <User size={12} className="text-blue-400" /> Account Identity
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-white/15 bg-black/40 p-3.5 text-sm text-white outline-none transition-all focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/25"
                disabled={isLoggingIn}
              >
                <option value="" disabled className="bg-slate-900">Select your account...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-900">
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
                <ShieldCheck size={12} className="text-purple-400" /> Secret Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 p-3.5 text-base tracking-wider text-white outline-none transition-all focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/25"
                disabled={isLoggingIn}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold animate-in bounce-in duration-300">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedUserId || !password || isLoggingIn}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-white py-4 text-sm font-black uppercase tracking-[0.12em] text-black shadow-xl transition-all hover:bg-slate-200 active:scale-[0.98] disabled:grayscale disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {isLoggingIn ? <><Loader2 size={18} className="animate-spin" /> Authenticating...</> : 'Sign In to MyUni'}
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          Authorized Users Only • Encryption Enabled
        </p>
      </div>
    </div>
  );
}
