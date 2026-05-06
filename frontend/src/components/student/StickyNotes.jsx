import React, { useState, useEffect } from 'react';
import { StickyNote, X, Plus, Pin, PinOff, Trash2, Clock } from 'lucide-react';

export default function StickyNotes() {
  const [isOpen, setIsOpen] = useState(false);
  
  // 1. Initialize from LocalStorage
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('myuni_student_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore corrupted storage
      }
    }
    return [
      { id: 1, title: 'Quick Note', content: '', pinned: false, lastEdited: Date.now() }
    ];
  });

  const [activeNoteId, setActiveNoteId] = useState(notes[0]?.id || 1);

  // 2. Auto-Save to LocalStorage whenever notes change
  useEffect(() => {
    localStorage.setItem('myuni_student_notes', JSON.stringify(notes));
  }, [notes]);

  // Sort notes: Pinned first, then by newest
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned === b.pinned) return b.lastEdited - a.lastEdited;
    return a.pinned ? -1 : 1;
  });

  // Keep activeTabId valid if notes are deleted
  useEffect(() => {
    if (!notes.find(n => n.id === activeNoteId) && notes.length > 0) {
      setActiveNoteId(sortedNotes[0].id);
    }
  }, [notes, activeNoteId, sortedNotes]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  // --- Handlers ---
  const createNewNote = () => {
    const newId = Date.now();
    setNotes([{ id: newId, title: 'New Note', content: '', pinned: false, lastEdited: Date.now() }, ...notes]);
    setActiveNoteId(newId);
  };

  const updateActiveNote = (field, value) => {
    setNotes(notes.map(note => 
      note.id === activeNoteId 
        ? { ...note, [field]: value, lastEdited: Date.now() } 
        : note
    ));
  };

  const togglePin = () => {
    setNotes(notes.map(note => 
      note.id === activeNoteId 
        ? { ...note, pinned: !note.pinned, lastEdited: Date.now() } 
        : note
    ));
  };

  const deleteActiveNote = () => {
    if (notes.length === 1) {
      setNotes([{ id: Date.now(), title: 'Quick Note', content: '', pinned: false, lastEdited: Date.now() }]);
      return;
    }
    setNotes(notes.filter(note => note.id !== activeNoteId));
  };

  const formatTimeAgo = (timestamp) => {
    const diffMins = Math.floor((Date.now() - timestamp) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-[5.5rem] right-6 w-12 h-12 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 z-40 group ${isOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
        title="Quick Notes"
      >
        <StickyNote size={20} className="group-hover:rotate-12 transition-transform duration-300" />
      </button>

      <div 
        className={`fixed bottom-24 right-6 w-[22rem] sm:w-96 h-[28rem] z-50 flex flex-col rounded-3xl shadow-[0_15px_40px_rgb(0,0,0,0.15)] border border-white/60 bg-white/70 backdrop-blur-2xl transition-all duration-400 ease-out origin-bottom-right ${
          isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95 pointer-events-none'
        }`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-200/50 bg-amber-50/60 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-amber-950 shadow-sm">
              <StickyNote size={14} />
            </div>
            <h3 className="font-bold text-gray-800 leading-tight">My Workspace</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* TAB SYSTEM */}
        <div className="flex items-center px-3 py-2 bg-white/40 border-b border-amber-100/50">
          <div className="flex flex-1 overflow-x-auto scrollbar-hide">
            {sortedNotes.map(note => (
              <button
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 mr-2 border shadow-sm ${
                  activeNoteId === note.id 
                    ? 'bg-amber-100 text-amber-900 border-amber-300' 
                    : 'bg-white/80 text-gray-500 border-gray-200 hover:bg-amber-50'
                }`}
              >
                {note.pinned && <Pin size={10} className={activeNoteId === note.id ? "text-amber-700" : "text-gray-400"} />}
                <span className="truncate max-w-[80px]">{note.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
          <button 
            onClick={createNewNote}
            className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-200 shadow-sm ml-1 shrink-0 transition-colors"
            title="New Note"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* ACTIVE NOTE EDITOR */}
        {activeNote && (
          <div className="flex-1 flex flex-col p-5 bg-amber-50/30 rounded-b-3xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => updateActiveNote('title', e.target.value)}
                placeholder="Note Title..."
                className="flex-1 bg-transparent text-lg font-bold text-gray-800 placeholder-gray-400 outline-none border-b border-transparent focus:border-amber-300 transition-colors px-1"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={togglePin}
                  className={`p-1.5 rounded-md transition-colors ${activeNote.pinned ? 'text-amber-600 bg-amber-100' : 'text-gray-400 hover:bg-amber-100/50 hover:text-amber-600'}`}
                  title={activeNote.pinned ? "Unpin Note" : "Pin Note"}
                >
                  {activeNote.pinned ? <Pin size={16} /> : <PinOff size={16} />}
                </button>
                <button 
                  onClick={deleteActiveNote}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete Note"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <textarea
              value={activeNote.content}
              onChange={(e) => updateActiveNote('content', e.target.value)}
              placeholder="Jot down your thoughts, reminders, or revision plans here..."
              className="flex-1 w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none resize-none px-1 scrollbar-thin"
            />

            <div className="pt-3 mt-2 border-t border-amber-200/40 flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
              <Clock size={12} />
              <span>Auto-saved {formatTimeAgo(activeNote.lastEdited)}</span>
            </div>
          </div>
        )}

      </div>
    </>
  );
}