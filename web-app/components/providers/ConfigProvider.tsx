"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface DashboardLink {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: string;
  disabled?: boolean;
}

const defaultLinks: DashboardLink[] = [
  { id: 'sticky-notes', name: 'Sticky Notes', description: 'Create categorized notes and annotated snippets', href: '/tools/sticky-notes', icon: 'sticky-note' },
  { id: 'moodle', name: 'Moodle', description: 'Access course materials and assignments', href: '/tools/moodle', icon: 'book-open' },
  { id: 'seats', name: 'Seats', description: 'Check seat availability in the library', href: '/tools/seats', icon: 'armchair' },
  { id: 'nest', name: 'Nest', description: 'Student portal and general services', href: '/tools/nest', icon: 'graduation-cap' },
  { id: 'handshake', name: 'Handshake', description: 'Find jobs and internships', href: '/tools/handshake', icon: 'handshake' },
  { id: 'interactive-map', name: 'Interactive Map', description: 'Find rooms and navigate the huge campus (Coming Soon)', href: '#', icon: 'map', disabled: true },
];

const legacyIconMap: Record<string, string> = {
  '📚': 'book-open',
  '🪑': 'armchair',
  '🏫': 'graduation-cap',
  '🤝': 'handshake',
  '🗺️': 'map',
  '🌟': 'grid-2x2',
  '📝': 'sticky-note',
};

function normalizeLinkIcon(icon: string): string {
  return legacyIconMap[icon] ?? icon;
}

function mergeWithDefaults(savedLinks: DashboardLink[]): DashboardLink[] {
  const byId = new Map<string, DashboardLink>();

  // Keep user-customized links first.
  for (const link of savedLinks) {
    byId.set(link.id, {
      ...link,
      icon: normalizeLinkIcon(link.icon),
    });
  }

  // Append any missing defaults introduced in newer app versions.
  for (const defaultLink of defaultLinks) {
    if (!byId.has(defaultLink.id)) {
      byId.set(defaultLink.id, defaultLink);
    }
  }

  return Array.from(byId.values());
}

interface ConfigContextType {
  links: DashboardLink[];
  showInfoWidget: boolean;
  addLink: (link: DashboardLink) => void;
  removeLink: (id: string) => void;
  setShowInfoWidget: (val: boolean) => void;
  isLoaded: boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [links, setLinks] = useState<DashboardLink[]>([]);
  const [showInfoWidget, setShowInfoWidget] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedLinks = localStorage.getItem('myuni_dashboard_links');
    if (savedLinks) {
      try {
        const parsedLinks = JSON.parse(savedLinks) as DashboardLink[];
        const migratedLinks = mergeWithDefaults(parsedLinks);
        setLinks(migratedLinks);
      } catch (e) {
        console.error("Failed to load dashboard links:", e);
        setLinks(defaultLinks);
      }
    } else {
      setLinks(defaultLinks);
    }

    const savedWidget = localStorage.getItem('myuni_show_infowidget');
    if (savedWidget !== null) {
      try {
        setShowInfoWidget(JSON.parse(savedWidget));
      } catch (e) {
        console.error("Failed to load info widget config:", e);
        setShowInfoWidget(true);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('myuni_dashboard_links', JSON.stringify(links));
    }
  }, [links, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('myuni_show_infowidget', JSON.stringify(showInfoWidget));
    }
  }, [showInfoWidget, isLoaded]);

  const addLink = (link: DashboardLink) => {
    setLinks(prev => [...prev, link]);
  };

  const removeLink = (id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  return (
    <ConfigContext.Provider value={{ links, showInfoWidget, addLink, removeLink, setShowInfoWidget, isLoaded }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error("useConfig must be used within a ConfigProvider");
  return context;
};

