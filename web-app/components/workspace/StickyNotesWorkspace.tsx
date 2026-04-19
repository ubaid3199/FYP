"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, FolderPlus, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useSession } from "@/components/providers";

type StickySection = {
  id: string;
  name: string;
  createdAt: string;
};

type StickyNote = {
  id: string;
  sectionId: string;
  title: string;
  content: string;
  reactions: Record<string, number>;
  updatedAt: string;
};

type StickyStore = {
  sections: StickySection[];
  notes: StickyNote[];
};

const DEFAULT_SECTION: StickySection = {
  id: "section-general",
  name: "General",
  createdAt: new Date().toISOString(),
};

const DEFAULT_STORE: StickyStore = {
  sections: [DEFAULT_SECTION],
  notes: [],
};

const SECTION_THEMES = [
  "border-cyan-400/40 bg-cyan-500/10",
  "border-emerald-400/40 bg-emerald-500/10",
  "border-amber-400/40 bg-amber-500/10",
  "border-rose-400/40 bg-rose-500/10",
  "border-violet-400/40 bg-violet-500/10",
];

const NOTE_CARD_THEMES = [
  "border-amber-200/50 bg-amber-50/95 text-slate-900 shadow-[0_10px_25px_rgba(245,158,11,0.15)]",
  "border-sky-200/50 bg-sky-50/95 text-slate-900 shadow-[0_10px_25px_rgba(56,189,248,0.15)]",
  "border-emerald-200/50 bg-emerald-50/95 text-slate-900 shadow-[0_10px_25px_rgba(16,185,129,0.15)]",
  "border-rose-200/50 bg-rose-50/95 text-slate-900 shadow-[0_10px_25px_rgba(244,63,94,0.15)]",
];

const NOTE_REACTIONS = ["🔥", "💡", "🎯", "✅", "🧠"];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StickyNotesWorkspace() {
  const { session, isLoaded } = useSession();

  const storageKey = useMemo(() => {
    const user = session.userId || "guest";
    return `myuni.sticky-notes.${user}`;
  }, [session.userId]);

  const [store, setStore] = useState<StickyStore>(DEFAULT_STORE);
  const [activeSectionId, setActiveSectionId] = useState<string>(DEFAULT_SECTION.id);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    setIsHydrated(false);

    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      setStore(DEFAULT_STORE);
      setActiveSectionId(DEFAULT_SECTION.id);
      setActiveNoteId(null);
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as any;
      const sections = Array.isArray(parsed.sections) && parsed.sections.length ? parsed.sections : [DEFAULT_SECTION];
      const notes = Array.isArray(parsed.notes)
        ? parsed.notes.map((note: any) => ({
            id: note.id || uid("note"),
            sectionId: note.sectionId || sections[0].id,
            title: note.title || "Quick note",
            content: note.content || "",
            reactions: note.reactions || {},
            updatedAt: note.updatedAt || new Date().toISOString(),
          }))
        : [];

      setStore({ sections, notes });
      setActiveSectionId(sections[0].id);
      setActiveNoteId(notes[0]?.id ?? null);
      setIsHydrated(true);
    } catch {
      setStore(DEFAULT_STORE);
      setActiveSectionId(DEFAULT_SECTION.id);
      setActiveNoteId(null);
      setIsHydrated(true);
    }
  }, [isLoaded, storageKey]);

  useEffect(() => {
    if (!isLoaded || !isHydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(store));
  }, [store, storageKey, isLoaded, isHydrated]);

  useEffect(() => {
    if (!isLoaded || !isHydrated) return;

    const notesInActiveSection = store.notes.filter((note) => note.sectionId === activeSectionId);

    if (notesInActiveSection.length === 0) {
      const quickNote: StickyNote = {
        id: uid("note"),
        sectionId: activeSectionId,
        title: "Quick note",
        content: "",
        reactions: {},
        updatedAt: new Date().toISOString(),
      };

      setStore((prev) => ({ ...prev, notes: [quickNote, ...prev.notes] }));
      setActiveNoteId(quickNote.id);
      return;
    }

    if (!activeNoteId || !notesInActiveSection.some((note) => note.id === activeNoteId)) {
      setActiveNoteId(notesInActiveSection[0].id);
    }
  }, [activeSectionId, activeNoteId, isLoaded, isHydrated, store.notes]);

  const sectionNotes = store.notes.filter((note) => note.sectionId === activeSectionId);
  const activeNote = sectionNotes.find((note) => note.id === activeNoteId) ?? null;
  const activeNoteTheme = useMemo(() => {
    const activeIndex = sectionNotes.findIndex((note) => note.id === activeNoteId);
    const safeIndex = activeIndex === -1 ? 0 : activeIndex;
    return NOTE_CARD_THEMES[safeIndex % NOTE_CARD_THEMES.length];
  }, [sectionNotes, activeNoteId]);

  const addSection = () => {
    const name = newSectionName.trim();
    if (!name) return;

    const exists = store.sections.some((section) => section.name.toLowerCase() === name.toLowerCase());
    if (exists) return;

    const newSection: StickySection = {
      id: uid("section"),
      name,
      createdAt: new Date().toISOString(),
    };

    setStore((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setActiveSectionId(newSection.id);
    setNewSectionName("");
  };

  const addNote = () => {
    const newNote: StickyNote = {
      id: uid("note"),
      sectionId: activeSectionId,
      title: "Untitled note",
      content: "",
      reactions: {},
      updatedAt: new Date().toISOString(),
    };

    setStore((prev) => ({
      ...prev,
      notes: [newNote, ...prev.notes],
    }));
    setActiveNoteId(newNote.id);
  };

  const updateNote = (updates: Partial<StickyNote>) => {
    if (!activeNoteId) return;

    setStore((prev) => ({
      ...prev,
      notes: prev.notes.map((note) =>
        note.id === activeNoteId
          ? { ...note, ...updates, updatedAt: new Date().toISOString() }
          : note
      ),
    }));
  };

  const deleteNote = (noteId: string) => {
    const note = store.notes.find((item) => item.id === noteId);
    const ok = window.confirm(
      `Delete note${note?.title ? ` \"${note.title}\"` : ""}? This cannot be undone.`
    );
    if (!ok) return;

    setStore((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.id !== noteId),
    }));

    if (activeNoteId === noteId) {
      const fallback = sectionNotes.find((note) => note.id !== noteId);
      setActiveNoteId(fallback?.id ?? null);
    }
  };

  const deleteSection = (sectionId: string) => {
    if (store.sections.length <= 1) return;

    const section = store.sections.find((item) => item.id === sectionId);
    const ok = window.confirm(
      `Delete subject${section?.name ? ` \"${section.name}\"` : ""}? All notes in this subject will be removed.`
    );
    if (!ok) return;

    const fallbackSection = store.sections.find((section) => section.id !== sectionId);

    setStore((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
      notes: prev.notes.filter((note) => note.sectionId !== sectionId),
    }));

    if (activeSectionId === sectionId && fallbackSection) {
      setActiveSectionId(fallbackSection.id);
      setActiveNoteId(null);
    }
  };

  const renameSection = (sectionId: string) => {
    const current = store.sections.find((section) => section.id === sectionId);
    if (!current) return;

    const nextName = window.prompt("Rename subject", current.name)?.trim();
    if (!nextName || nextName.toLowerCase() === current.name.toLowerCase()) return;

    const duplicate = store.sections.some(
      (section) => section.id !== sectionId && section.name.toLowerCase() === nextName.toLowerCase()
    );
    if (duplicate) return;

    setStore((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, name: nextName } : section
      ),
    }));
  };

  const toggleReaction = (emoji: string) => {
    if (!activeNoteId) return;

    setStore((prev) => ({
      ...prev,
      notes: prev.notes.map((note) => {
        if (note.id !== activeNoteId) return note;
        const nextCount = (note.reactions?.[emoji] || 0) + 1;
        return {
          ...note,
          reactions: {
            ...note.reactions,
            [emoji]: nextCount,
          },
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  };

  const saveNow = () => {
    localStorage.setItem(storageKey, JSON.stringify(store));
    setSaveMessage("Saved");
    window.setTimeout(() => setSaveMessage(""), 1500);
  };

  return (
    <div className="h-full overflow-auto bg-[#0f172a] p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row">
        <aside className="glass-panel rounded-2xl border border-white/10 p-5 lg:w-80">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            <NotebookPen size={18} className="text-blue-300" /> Sticky Notes
          </h2>

          <p className="mb-4 text-xs text-slate-400">
            A clean notes board. Pick a subject, write freely, and react to your progress.
          </p>

          <div className="mb-4 flex gap-2">
            <input
              value={newSectionName}
              onChange={(event) => setNewSectionName(event.target.value)}
              placeholder="New subject (e.g. AI, HCI)"
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10"
            >
              <FolderPlus size={14} /> Add
            </button>
          </div>

          <div className="space-y-2">
            {store.sections.map((section, index) => {
              const isActive = activeSectionId === section.id;
              const theme = SECTION_THEMES[index % SECTION_THEMES.length];

              return (
                <div
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                    isActive ? theme : "border-white/10 bg-white/5"
                  } cursor-pointer`}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveSectionId(section.id);
                    }}
                    className="text-left text-sm font-semibold text-slate-100"
                  >
                    {section.name}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        renameSection(section.id);
                      }}
                      className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                      title="Rename subject"
                    >
                      <Pencil size={12} />
                    </button>
                    {store.sections.length > 1 && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteSection(section.id);
                        }}
                        className="rounded-md p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
                        title="Delete subject"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="flex-1 space-y-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Notes in this subject</h3>
              <button
                type="button"
                onClick={addNote}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-100 hover:bg-white/10"
              >
                <BookmarkPlus size={12} /> New note
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 lg:col-span-1">
                {sectionNotes.length === 0 && (
                  <p className="text-xs text-slate-400">No notes yet in this category.</p>
                )}
                {sectionNotes.map((note, noteIndex) => (
                  <div
                    key={note.id}
                    className={`rounded-lg border px-3 py-2 ${
                      activeNoteId === note.id
                        ? "border-blue-500/50 bg-blue-50/95 text-slate-900 shadow-[0_12px_28px_rgba(59,130,246,0.2)]"
                        : NOTE_CARD_THEMES[noteIndex % NOTE_CARD_THEMES.length]
                    }`}
                  >
                    <div className="mb-2 h-1.5 w-10 rounded-full bg-black/10" />
                    <button
                      type="button"
                      onClick={() => setActiveNoteId(note.id)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-semibold text-slate-900">{note.title || "Untitled note"}</p>
                      <p className="text-[11px] text-slate-700">
                        Updated {new Date(note.updatedAt).toLocaleString()}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(note.reactions || {}).map(([emoji, count]) => (
                          <span
                            key={`${note.id}-${emoji}`}
                            className="rounded-full border border-slate-300/70 bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-800"
                          >
                            {emoji} {count}
                          </span>
                        ))}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(note.id)}
                      className="mt-2 rounded-md px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>

              <div className={`rounded-xl border p-3 lg:col-span-2 ${activeNoteTheme}`}>
                {activeNote ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-end gap-2">
                      {saveMessage && (
                        <span className="text-xs text-slate-700">{saveMessage}</span>
                      )}
                      <button
                        type="button"
                        onClick={saveNow}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        Save
                      </button>
                    </div>
                    <div className="h-2 w-14 rounded-full bg-black/10" />
                    <input
                      value={activeNote.title}
                      onChange={(event) => updateNote({ title: event.target.value })}
                      className="w-full rounded-lg border border-slate-300/70 bg-white/70 px-3 py-2 text-base font-semibold text-slate-900"
                      placeholder="Note title"
                    />
                    <textarea
                      value={activeNote.content}
                      onChange={(event) => updateNote({ content: event.target.value })}
                      className="h-52 w-full rounded-lg border border-slate-300/70 bg-white/70 px-3 py-2 text-sm leading-relaxed text-slate-900"
                      placeholder="Write your note here..."
                    />
                    <div className="rounded-xl border border-slate-300/70 bg-white/70 p-3">
                      <p className="mb-2 text-xs text-slate-700">How does this note feel?</p>
                      <div className="flex flex-wrap gap-2">
                        {NOTE_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(emoji)}
                            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 hover:bg-slate-100"
                          >
                            {emoji} {activeNote.reactions?.[emoji] || 0}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Select or create a note to start writing.</p>
                )}
              </div>
            </div>
          </div>

        </section>
      </div>
    </div>
  );
}
