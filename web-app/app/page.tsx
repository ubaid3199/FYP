"use client";

import {
  type AppearancePreset,
  type BackgroundStyle,
  type DashboardLink,
  InfoWidget,
  useAppearance,
  useConfig,
  useSession,
  useUserStore,
  useWindowManager,
} from '@/components';
import { useEffect, useRef, useState } from 'react';
import { Trash2, Plus, X, ShieldCheck, User as UserIcon, LayoutGrid, Eye, EyeOff, ChevronRight, Users, BrainCircuit, Upload, Loader2, CheckCircle2, AlertCircle, LogOut, BarChart3, RefreshCw, Palette } from 'lucide-react';
import { AppIcon } from '@/lib/ui';

interface RagMetricsPayload {
  success: boolean;
  metrics: {
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    totalLatencyMs: number;
    cacheHitRate: number;
    avgLatencyMs: number;
  };
  store: {
    parentDocumentsCount?: number;
    documentsCount: number;
    embeddingsCount: number;
    retrievalCacheSize: number;
  };
  config: {
    debugEnabled: boolean;
    retrievalCacheTtlMs: number;
    retrievalCacheMaxItems: number;
    minVectorSimilarity: number;
    minHybridScore: number;
  };
  timestamp: string;
}

interface TrainingSummaryStats {
  filesCount: number;
  linksCount: number;
  parentChunks: number;
  childChunks: number;
  embeddedChildChunks: number;
}

export default function Home() {
  const { links, addLink, removeLink, showInfoWidget, setShowInfoWidget, isLoaded } = useConfig();
  const { session, updateSession, logout } = useSession();
  const { settings: appearance, setPreset, setBackgroundStyle, setAccentColor, setTextColor, setBackgroundColor, resetAppearance } = useAppearance();
  const { openWindow } = useWindowManager();
  const { users, addUser, removeUser, resetPassword } = useUserStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showTrainPanel, setShowTrainPanel] = useState(false);
  const [showAppearancePanel, setShowAppearancePanel] = useState(false);
  const appearancePanelRef = useRef<HTMLDivElement | null>(null);
  
  const [newLink, setNewLink] = useState({ id: '', name: '', description: '', href: '', icon: 'grid-2x2' });
  const [newUser, setNewUser] = useState({ name: '', role: 'student' as 'student' | 'admin' | 'teacher', password: '' });
  
  // AI Training State
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [trainingLinksInput, setTrainingLinksInput] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [lastTrainingStats, setLastTrainingStats] = useState<TrainingSummaryStats | null>(null);
  const [lastTrainingAt, setLastTrainingAt] = useState<string | null>(null);
  const [ragMetrics, setRagMetrics] = useState<RagMetricsPayload | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');

  const normalize = (value: string) => value.trim().toLowerCase();

  const isValidToolHref = (href: string) => {
    const value = href.trim();
    if (!value) return false;
    if (value.startsWith('/')) return true;
    if (value === '#') return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const fetchRagMetrics = async () => {
    setIsMetricsLoading(true);
    setMetricsError('');
    try {
      const res = await fetch('/api/admin/rag-metrics');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load RAG metrics');
      setRagMetrics(data);
    } catch (err: any) {
      setMetricsError(err.message || 'Unable to load RAG metrics.');
    } finally {
      setIsMetricsLoading(false);
    }
  };

  useEffect(() => {
    if (showTrainPanel) {
      fetchRagMetrics();
    }
  }, [showTrainPanel]);

  useEffect(() => {
    if (!showAppearancePanel) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (appearancePanelRef.current?.contains(target)) return;
      setShowAppearancePanel(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showAppearancePanel]);

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newLink.name.trim();
    const href = newLink.href.trim();
    if (!name || !href) {
      alert('Tool name and service URL are required.');
      return;
    }
    if (!isValidToolHref(href)) {
      alert('Use a valid URL (http/https), a local path starting with /, or # for placeholder tools.');
      return;
    }

    const id = name.toLowerCase().replace(/\s+/g, '-');
    if (links.some((link) => link.id === id)) {
      alert('A tool with this name already exists. Please choose a different name.');
      return;
    }

    addLink({ ...newLink, id, name, href });
    setNewLink({ id: '', name: '', description: '', href: '', icon: 'grid-2x2' });
    setShowAddForm(false);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newUser.name.trim();
    const password = newUser.password.trim();

    if (!name) {
      alert('Full name is required.');
      return;
    }
    if (password.length < 4) {
      alert('Password should be at least 4 characters long.');
      return;
    }
    if (users.some((u) => normalize(u.name) === normalize(name))) {
      alert('A user with this name already exists.');
      return;
    }

    addUser({ ...newUser, name, password });
    setNewUser({ name: '', role: 'student', password: '' });
    setShowUserForm(false);
  };

  const handleRemoveUserRequest = (userId: string, userName: string, role: 'student' | 'admin' | 'teacher') => {
    if (userId === session.userId) {
      alert('You cannot remove your own active account.');
      return;
    }

    if (role === 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        alert('Cannot remove the last admin account.');
        return;
      }
    }

    const ok = window.confirm(`Remove user "${userName}" (${role})? This action cannot be undone.`);
    if (!ok) return;
    removeUser(userId);
  };

  const handleResetPasswordRequest = (userId: string, userName: string) => {
    const confirmed = window.confirm(`Reset password for "${userName}"?`);
    if (!confirmed) return;

    const pass = prompt(`Enter new password for ${userName}`)?.trim() || '';
    if (!pass) return;
    if (pass.length < 4) {
      alert('Password should be at least 4 characters long.');
      return;
    }
    resetPassword(userId, pass);
  };

  const handleRemoveToolRequest = (id: string, name: string) => {
    const ok = window.confirm(`Remove tool "${name}" from the dashboard?`);
    if (!ok) return;
    removeLink(id);
  };

  const handleTrainWithConfirm = (isIncremental: boolean) => {
    const action = isIncremental ? 'incremental add' : 'full re-train';
    const warning = isIncremental
      ? 'This will add selected files and links to the current Parent-Child RAG index.'
      : 'This may overwrite previously indexed knowledge and rebuild the Parent-Child RAG index.';
    const confirmed = window.confirm(`Start ${action}?\n\n${warning}`);
    if (!confirmed) return;
    handleTrainAI(isIncremental);
  };

  const handleTrainAI = async (isIncremental: boolean) => {
    const links = trainingLinksInput
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);

    if ((!selectedFiles || selectedFiles.length === 0) && links.length === 0) {
      setTrainingStatus({ type: 'error', message: 'Please select files or provide at least one valid link.' });
      return;
    }

    setIsTraining(true);
    setTrainingStatus({ type: null, message: '' });
    setLastTrainingStats(null);
    setLastTrainingAt(null);

    const formData = new FormData();
    if (selectedFiles) {
      Array.from(selectedFiles).forEach(file => formData.append('files', file));
    }
    if (links.length > 0) {
      formData.append('links', JSON.stringify(links));
    }
    formData.append('isIncremental', isIncremental.toString());

    try {
      const res = await fetch('/api/admin/train', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Training failed');

      const standardTag = data.trainingStandard ? ` [${data.trainingStandard}]` : '';
      setTrainingStatus({ type: 'success', message: `${data.message}${standardTag}` });
      setLastTrainingStats({
        filesCount: Number(data.stats?.filesCount ?? selectedFiles?.length ?? 0),
        linksCount: Number(data.stats?.linksCount ?? links.length ?? 0),
        parentChunks: Number(data.stats?.parentChunks ?? 0),
        childChunks: Number(data.stats?.childChunks ?? 0),
        embeddedChildChunks: Number(data.stats?.embeddedChildChunks ?? 0),
      });
      setLastTrainingAt(new Date().toISOString());
      setSelectedFiles(null);
      setTrainingLinksInput('');
    } catch (err: any) {
      setTrainingStatus({ type: 'error', message: err.message });
      setLastTrainingStats(null);
      setLastTrainingAt(null);
    } finally {
      setIsTraining(false);
    }
  };

  const hasFilesSelected = Boolean(selectedFiles && selectedFiles.length > 0);
  const hasLinksProvided = trainingLinksInput
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .some(Boolean);
  const hasTrainingInput = hasFilesSelected || hasLinksProvided;

  const isAdmin = session.role === 'admin';
  const isPreview = session.previewMode;
  const showAdminUI = isAdmin && !isPreview;

  if (!isLoaded) return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-blue-400 animate-pulse font-mono tracking-widest">LOADING MYUNI...</div>;

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-transparent px-4 pb-16 pt-20 sm:px-6 md:px-10 md:pt-10 lg:px-14 lg:pt-12">
      <div ref={appearancePanelRef} className="fixed right-4 top-4 z-50 flex items-start gap-2">
        {showAppearancePanel && (
          <div className="w-[min(92vw,560px)] rounded-2xl border border-white/10 bg-slate-950/85 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2 text-sm font-black uppercase tracking-[0.2em] text-slate-200">
              <span className="flex items-center gap-2">
                <Palette size={16} className="text-blue-300" /> Appearance
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAppearance}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-bold text-slate-200 hover:bg-white/10"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowAppearancePanel(false)}
                  className="rounded-full border border-white/20 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10"
                  aria-label="Close appearance panel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Mood Preset</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'chill', label: 'Chill' },
                    { id: 'focus', label: 'Focus' },
                    { id: 'sunset', label: 'Sunset' },
                    { id: 'light', label: 'Light' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPreset(preset.id as AppearancePreset)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                        appearance.preset === preset.id
                          ? 'text-white shadow-lg'
                          : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                      style={appearance.preset === preset.id ? { backgroundColor: 'var(--primary)', boxShadow: '0 10px 24px var(--primary-glow)' } : undefined}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Background</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'aurora', label: 'Aurora' },
                    { id: 'paper', label: 'Paper' },
                    { id: 'minimal', label: 'Minimal' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setBackgroundStyle(style.id as BackgroundStyle)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                        appearance.backgroundStyle === style.id
                          ? 'text-white shadow-lg'
                          : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                      style={appearance.backgroundStyle === style.id ? { backgroundColor: 'var(--primary)', boxShadow: '0 10px 24px var(--primary-glow)' } : undefined}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Accent Color</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={appearance.accentColor || '#38bdf8'}
                    onChange={(event) => setAccentColor(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
                    aria-label="Choose accent color"
                  />
                  <button
                    type="button"
                    onClick={() => setAccentColor(null)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Use preset
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Text Color</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={appearance.textColor || '#e2e8f0'}
                    onChange={(event) => setTextColor(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
                    aria-label="Choose text color"
                  />
                  <button
                    type="button"
                    onClick={() => setTextColor(null)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Use preset
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Background Color</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={appearance.backgroundColor || '#0f172a'}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
                    aria-label="Choose background color"
                  />
                  <button
                    type="button"
                    onClick={() => setBackgroundColor(null)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Use preset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAppearancePanel((prev) => !prev)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/80 text-slate-100 shadow-lg backdrop-blur-xl hover:bg-slate-900/90"
          aria-label="Open appearance options"
          title="Appearance"
        >
          <Palette size={18} />
        </button>
      </div>

      {/* Dynamic Background Elements */}
      <div
        className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.16)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 h-[600px] w-[600px] rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.11)' }}
      />

      {/* Header Area */}
      <div className="z-20 mb-10 w-full max-w-6xl items-center justify-between text-sm lg:flex">
        <div className="fixed left-0 top-0 flex w-full items-center justify-between border-b border-white/10 bg-black/60 p-4 backdrop-blur-xl sm:p-5 lg:static lg:w-auto lg:rounded-2xl lg:border lg:bg-white/5 lg:p-3">
          <p className="flex items-center gap-2 text-slate-200">
            Welcome to&nbsp;<code className="font-bold text-blue-400">MyUni</code>
          </p>
        </div>

        {/* Desktop Controls */}
        <div className="flex items-center gap-4 z-20 mt-20 lg:mt-0">
          {isAdmin && (
            <button
              onClick={() => updateSession({ previewMode: !isPreview })}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                isPreview 
                  ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' 
                  : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {isPreview ? <Eye size={14} /> : <EyeOff size={14} />}
              {isPreview ? 'Exit Preview' : 'Preview Student View'}
            </button>
          )}

          <button
            onClick={() => logout()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all font-mono"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative z-10 my-8 flex place-items-center flex-col text-center sm:my-10">
        <h1 className="mb-4 bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-2xl sm:text-5xl lg:text-6xl xl:text-7xl">
          Empowering Your <br />
          <span className="text-blue-500 decoration-blue-500/30 underline underline-offset-8">Academic Journey.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          The central hub for <span className="text-white">MyUni</span> students. Access all your tools and AI support in one integrated experience.
        </p>
      </div>

      <div className="z-10 w-full max-w-6xl">
        <InfoWidget />

        {/* Admin Panel Controls */}
        {showAdminUI && (
          <div className="mb-12">
            <div className="flex flex-wrap gap-4 items-center mb-6">
              <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2 opacity-80 mr-auto">
                <ShieldCheck size={18} className="text-purple-400" /> Administrative Portal
              </h2>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => { setShowUserForm(!showUserForm); setShowAddForm(false); setShowTrainPanel(false); }}
                  className={`flex items-center gap-2 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${showUserForm ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'}`}
                >
                  <Users size={14} /> User Management
                </button>
                <button 
                  onClick={() => { setShowTrainPanel(!showTrainPanel); setShowAddForm(false); setShowUserForm(false); }}
                  className={`flex items-center gap-2 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${showTrainPanel ? 'bg-green-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'}`}
                >
                  <BrainCircuit size={14} /> AI Training Studio
                </button>
                <button 
                  onClick={() => { setShowAddForm(!showAddForm); setShowUserForm(false); setShowTrainPanel(false); }}
                  className={`flex items-center gap-2 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${showAddForm ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'}`}
                >
                  <Plus size={14} /> Tool Manager
                </button>
              </div>
            </div>

            {/* User Management Panel */}
            {showUserForm && (
              <div className="glass-panel p-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-500 ring-1 ring-white/10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Plus size={14} /> Create New Account
                    </h3>
                    <form onSubmit={handleAddUser} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Full Name</label>
                        <input 
                          type="text" placeholder="e.g. John Doe" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500/50"
                          value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Role</label>
                        <select 
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500/50"
                          value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                        >
                          <option value="student" className="bg-slate-900">Student</option>
                          <option value="teacher" className="bg-slate-900">Teacher</option>
                          <option value="admin" className="bg-slate-900">Administrator</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Secret Password</label>
                        <input 
                          type="text" placeholder="Set password..." 
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500/50"
                          value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                        />
                      </div>
                      <button type="submit" className="w-full bg-purple-600 text-white rounded-xl py-3 text-[11px] font-black uppercase tracking-widest hover:bg-purple-500 transition-all shadow-xl active:scale-95">
                        Register Account
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Users size={14} /> Existing Directory ({users.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                      {users.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 
                              u.role === 'teacher' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{u.name}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{u.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleResetPasswordRequest(u.id, u.name)}
                              className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                              title="Reset Password"
                            >
                              <ShieldCheck size={14} />
                            </button>
                            {u.id !== 'admin_1' && (
                              <button
                                onClick={() => handleRemoveUserRequest(u.id, u.name, u.role)}
                                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                                title="Remove user"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showTrainPanel && (
              <div className="glass-panel p-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-500 ring-1 ring-white/10">
                <div className="max-w-3xl mx-auto space-y-8">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-black text-white tracking-tight flex items-center justify-center gap-2">
                      <BrainCircuit size={24} className="text-green-500" /> AI Knowledge Studio
                    </h3>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Training Standard: Parent-Child Hybrid RAG v3
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className={`relative border-2 border-dashed rounded-2xl p-12 transition-all text-center ${hasFilesSelected ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 hover:border-blue-500/30 bg-white/5'}`}>
                      <input type="file" multiple onChange={(e) => setSelectedFiles(e.target.files)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <div className="flex flex-col items-center gap-4">
                        <Upload size={32} className={hasFilesSelected ? 'text-green-400' : 'text-slate-500'} />
                        <p className="text-sm font-bold text-white">{hasFilesSelected && selectedFiles ? `${selectedFiles.length} files selected` : 'Drag & drop institutional files'}</p>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Knowledge Links (Optional)</label>
                      <textarea
                        value={trainingLinksInput}
                        onChange={(e) => setTrainingLinksInput(e.target.value)}
                        placeholder="https://example.edu/policies\nhttps://example.edu/announcements"
                        className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-blue-500/50"
                      />
                      <p className="text-[10px] text-slate-400">Add one URL per line or separate with commas. Supported schemes: http and https.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button onClick={() => handleTrainWithConfirm(true)} disabled={isTraining || !hasTrainingInput} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all disabled:opacity-50">
                        <p className="text-xs font-black text-white uppercase tracking-widest">Incremental Add</p>
                      </button>
                      <button onClick={() => handleTrainWithConfirm(false)} disabled={isTraining || !hasTrainingInput} className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 hover:border-red-500/50 transition-all disabled:opacity-50">
                        <p className="text-xs font-black text-white uppercase tracking-widest">Full Re-Train</p>
                      </button>
                    </div>

                    {isTraining && (
                      <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-blue-500/10 text-blue-400 animate-pulse">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-[11px] font-bold uppercase tracking-widest">Building Parent-Child Index...</span>
                      </div>
                    )}

                    {trainingStatus.type && (
                      <div
                        className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                          trainingStatus.type === 'success'
                            ? 'border-green-500/30 bg-green-500/10 text-green-300'
                            : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }`}
                      >
                        {trainingStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <span>{trainingStatus.message}</span>
                      </div>
                    )}

                    {trainingStatus.type === 'success' && lastTrainingStats && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Last Training Summary</p>
                          {lastTrainingAt && (
                            <p className="text-[10px] text-emerald-100/80">{new Date(lastTrainingAt).toLocaleString()}</p>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                          <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Files</p>
                            <p className="text-sm font-bold text-white">{lastTrainingStats.filesCount}</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Links</p>
                            <p className="text-sm font-bold text-white">{lastTrainingStats.linksCount}</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Parent</p>
                            <p className="text-sm font-bold text-white">{lastTrainingStats.parentChunks}</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Child</p>
                            <p className="text-sm font-bold text-white">{lastTrainingStats.childChunks}</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 col-span-2 sm:col-span-1">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Embedded</p>
                            <p className="text-sm font-bold text-white">{lastTrainingStats.embeddedChildChunks}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                          <BarChart3 size={14} className="text-blue-400" /> RAG Performance Metrics
                        </h4>
                        <button
                          onClick={fetchRagMetrics}
                          disabled={isMetricsLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10 transition-all disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isMetricsLoading ? 'animate-spin' : ''} /> Refresh
                        </button>
                      </div>

                      {metricsError && (
                        <p className="text-xs text-red-300">{metricsError}</p>
                      )}

                      {!ragMetrics && !metricsError && isMetricsLoading && (
                        <p className="text-xs text-slate-400">Loading metrics...</p>
                      )}

                      {ragMetrics && (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Total Queries</p>
                              <p className="text-lg font-bold text-white">{ragMetrics.metrics.totalQueries}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Cache Hit Rate</p>
                              <p className="text-lg font-bold text-white">{Math.round(ragMetrics.metrics.cacheHitRate * 100)}%</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Avg Retrieval Latency</p>
                              <p className="text-lg font-bold text-white">{ragMetrics.metrics.avgLatencyMs}ms</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Parent Chunks</p>
                              <p className="text-lg font-bold text-white">{ragMetrics.store.parentDocumentsCount ?? 'n/a'}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Child Chunks</p>
                              <p className="text-lg font-bold text-white">{ragMetrics.store.documentsCount}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Embeddings</p>
                              <p className="text-lg font-bold text-white">{ragMetrics.store.embeddingsCount}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">Cache Size</p>
                              <p className="text-lg font-bold text-white">{ragMetrics.store.retrievalCacheSize}</p>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-400">
                            Last updated: {new Date(ragMetrics.timestamp).toLocaleTimeString()} • Thresholds: vector {ragMetrics.config.minVectorSimilarity}, hybrid {ragMetrics.config.minHybridScore}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showAddForm && (
              <form onSubmit={handleAddLink} className="glass-panel p-8 mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-500 ring-1 ring-white/10">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tool Name</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500/50" value={newLink.name} onChange={e => setNewLink({...newLink, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Service URL</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500/50" value={newLink.href} onChange={e => setNewLink({...newLink, href: e.target.value})} />
                </div>
                <button type="submit" className="bg-white text-black rounded-xl px-6 py-3 text-[11px] font-black uppercase tracking-widest mt-auto hover:bg-slate-200 transition-all active:scale-95 shadow-xl">Add Tool</button>
              </form>
            )}
          </div>
        )}

        {/* Links Grid Area */}
        <div className="flex items-center gap-2 mb-8 text-xs font-black text-slate-500 uppercase tracking-[0.3em]">
          <LayoutGrid size={14} className="text-blue-500" /> My Applications
        </div>

        <div className="grid grid-cols-1 gap-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link: DashboardLink) => (
            <div key={link.id} className="relative group">
              <button
                onClick={() => !link.disabled && openWindow(link.name, link.href)}
                className={`glass-panel relative block w-full overflow-hidden p-7 text-left ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-1 hover:ring-blue-400/40 hover:shadow-[0_12px_40px_rgba(37,99,235,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${link.disabled ? 'cursor-not-allowed opacity-45 grayscale' : ''}`}
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-blue-300 shadow-xl transition-transform duration-300 group-hover:scale-105">
                  <AppIcon iconName={link.icon} size={22} strokeWidth={2} />
                </div>
                <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-white transition-colors group-hover:text-blue-300 sm:text-xl">
                  {link.name}
                  {!link.disabled && <ChevronRight size={18} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />}
                </h2>
                <p className="text-sm leading-relaxed text-slate-300">{link.description}</p>
              </button>
              
              {showAdminUI && (
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemoveToolRequest(link.id, link.name);
                  }}
                  className="absolute -top-3 -right-3 p-3 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-2xl z-30 scale-75 group-hover:scale-100"
                  title="Remove tool"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
