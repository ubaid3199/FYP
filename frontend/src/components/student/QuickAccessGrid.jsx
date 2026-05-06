import { useEffect, useMemo, useState } from 'react';
import { Plus, X, ExternalLink, GraduationCap, Layout, Calendar, Library, ClipboardCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const QuickAccessGrid = ({ variant = 'student' }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canManageLinks = variant === 'admin' && isAdmin;

  const STORAGE_KEY = useMemo(() => {
    // Cache key (fallback only) to avoid losing links if API is down.
    return `myuni.quicklinks.cache.student`; 
  }, []);

  // Default quick links (exactly as requested)
  const defaultLinks = useMemo(
    () => [
      { id: 'moodle', name: 'Moodle', icon: GraduationCap, href: 'https://moodle.roehampton.ac.uk/' },
      { id: 'nest', name: 'Nest Portal', icon: Layout, href: 'https://roehamptonprod.sharepoint.com/sites/portal/nest/Pages/default.aspx' },
      { id: 'timetable', name: 'Timetable', icon: Calendar, href: 'https://roehamptonprod.sharepoint.com/sites/portal/nest/timetable/Pages/default.aspx' },
      { id: 'seats', name: 'SEAtS', icon: ClipboardCheck, href: 'https://rulattendance.seats.cloud/#/' },
      { id: 'library', name: 'Library', icon: Library, href: 'https://roehamptonprod.sharepoint.com/sites/portal/nest/library/Pages/opening-hours.aspx' },
    ],
    []
  );

  const [customLinks, setCustomLinks] = useState([]);
  const [activeLinkId, setActiveLinkId] = useState('dashboard');

  const [linksStatus, setLinksStatus] = useState({ loading: false, error: '' });
  const [createStatus, setCreateStatus] = useState({ loading: false });
  const [deleteStatus, setDeleteStatus] = useState({ loadingId: '' });
  const [deleteError, setDeleteError] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTab, setNewTab] = useState({ name: '', href: '' });
  const [addError, setAddError] = useState('');

  const links = useMemo(() => {
    return [...defaultLinks, ...customLinks];
  }, [defaultLinks, customLinks]);

  const activeLink = useMemo(() => {
    if (activeLinkId === 'dashboard') return null;
    return links.find((l) => l.id === activeLinkId) || null;
  }, [activeLinkId, links]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) return;
      setLinksStatus({ loading: true, error: '' });
      try {
        const { data } = await api.get('/quicklinks?audience=student');
        if (cancelled) return;

        const sanitized = (Array.isArray(data) ? data : [])
          .filter((x) => x && typeof x === 'object')
          .map((x) => ({
            id: String(x.id || ''),
            name: String(x.name || ''),
            href: String(x.href || ''),
            icon: ExternalLink,
          }))
          .filter((x) => x.id && x.name && x.href);

        setCustomLinks(sanitized);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        } catch {
          // ignore
        }
        setLinksStatus({ loading: false, error: '' });
      } catch (err) {
        if (cancelled) return;
        // Fallback to cache
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : [];
          const cached = (Array.isArray(parsed) ? parsed : [])
            .filter((x) => x && typeof x === 'object')
            .map((x) => ({
              id: String(x.id || ''),
              name: String(x.name || ''),
              href: String(x.href || ''),
              icon: ExternalLink,
            }))
            .filter((x) => x.id && x.name && x.href);
          setCustomLinks(cached);
        } catch {
          // ignore
        }
        setLinksStatus({ loading: false, error: 'Unable to load Quick Links from server' });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, STORAGE_KEY]);

  // Note: persistence is server-backed; localStorage is just a cache fallback.

  const defaultIds = useMemo(() => new Set(defaultLinks.map((l) => l.id)), [defaultLinks]);

  const openAdd = () => {
    if (!canManageLinks) return;
    setAddError('');
    setNewTab({ name: '', href: '' });
    setIsAddOpen(true);
  };

  const closeAdd = () => {
    setIsAddOpen(false);
  };

  const refetchLinks = async () => {
    if (!user) return;
    const { data } = await api.get('/quicklinks?audience=student');
    const sanitized = (Array.isArray(data) ? data : [])
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        id: String(x.id || ''),
        name: String(x.name || ''),
        href: String(x.href || ''),
        icon: ExternalLink,
      }))
      .filter((x) => x.id && x.name && x.href);
    setCustomLinks(sanitized);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore
    }
  };

  const submitAdd = async () => {
    setAddError('');
    if (!canManageLinks) {
      setAddError('Forbidden');
      return;
    }

    const name = newTab.name.trim();
    const hrefRaw = newTab.href.trim();
    if (!name || !hrefRaw) {
      setAddError('Tab Name and URL are required');
      return;
    }

    let url;
    try {
      // Be forgiving: allow users to paste without protocol.
      url = hrefRaw.startsWith('http://') || hrefRaw.startsWith('https://')
        ? new URL(hrefRaw)
        : new URL(`https://${hrefRaw}`);
      if (!['http:', 'https:'].includes(url.protocol)) {
        setAddError('URL must start with http:// or https://');
        return;
      }
    } catch {
      setAddError('Please enter a valid URL');
      return;
    }

    try {
      setCreateStatus({ loading: true });
      const { data } = await api.post('/quicklinks', {
        name,
        href: url.toString(),
        audience: 'student',
      });

      const created = {
        id: String(data?.id || ''),
        name: String(data?.name || name),
        href: String(data?.href || url.toString()),
        icon: ExternalLink,
      };

      if (!created.id) {
        setAddError('Failed to create quick link');
        return;
      }

      // Ensure UI shows the new link immediately (and stays consistent with DB)
      await refetchLinks();
      setActiveLinkId(created.id);
      setIsAddOpen(false);
    } catch (error) {
      setAddError(error?.response?.data?.message || 'Failed to create quick link');
    } finally {
      setCreateStatus({ loading: false });
    }
  };

  const removeLink = async (link) => {
    if (!canManageLinks) return;
    if (!link?.id) return;
    if (defaultIds.has(link.id)) return;

    setDeleteError('');

    const ok = window.confirm(`Remove "${link.name}" from Student Quick Links?`);
    if (!ok) return;

    try {
      setDeleteStatus({ loadingId: link.id });
      await api.delete(`/quicklinks/${encodeURIComponent(link.id)}`);
      if (activeLinkId === link.id) {
        setActiveLinkId('dashboard');
      }
      await refetchLinks();
    } catch (error) {
      setDeleteError(error?.response?.data?.message || 'Failed to remove quick link');
    } finally {
      setDeleteStatus({ loadingId: '' });
    }
  };

  const isPanelOpen = Boolean(activeLink);

  return (
    <section className="w-full mb-8">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Links</h2>

      {linksStatus.error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-orange-50 border border-orange-100 text-sm text-orange-700">
          {linksStatus.error}
        </div>
      )}

      {deleteError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Horizontal, scrollable quick-link tabs */}
      <div className={variant === 'admin' ? 'bg-white rounded-2xl shadow-sm border border-gray-100 p-3 overflow-x-auto scroll-smooth snap-x snap-mandatory' : 'overflow-x-auto scroll-smooth snap-x snap-mandatory'}>
        <div className={variant === 'admin' ? 'flex gap-2 min-w-max pr-1 pb-1' : 'flex gap-4 min-w-max pr-1 pb-1'}>
          {links.map((link) => {
            const isActive = activeLinkId === link.id;
            const Icon = link?.icon || ExternalLink;
            const isDeletable = canManageLinks && !defaultIds.has(link.id);
            const isDeleting = deleteStatus.loadingId === link.id;

            const baseClass = variant === 'admin'
              ? `snap-start flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 hover:bg-white hover:border-emerald-200 transition-colors cursor-pointer min-w-[190px] ${isActive ? 'ring-2 ring-[#0B4C3A]/15 border-emerald-200 bg-white' : ''}`
              : `snap-start flex flex-col items-center justify-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-200 hover:-translate-y-1 transition-all duration-200 group text-center cursor-pointer min-w-[150px] ${isActive ? 'ring-2 ring-[#0B4C3A]/20 border-emerald-200' : ''}`;

            const content = (
              <>
                <div className={variant === 'admin'
                  ? `w-10 h-10 bg-white text-gray-500 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 transition-colors ${isActive ? 'bg-emerald-50 text-[#0B4C3A] border-emerald-100' : ''}`
                  : `w-12 h-12 bg-gray-50 text-gray-500 rounded-xl flex items-center justify-center mb-3 transition-colors ${isActive ? 'bg-emerald-50 text-[#0B4C3A]' : 'group-hover:bg-emerald-50 group-hover:text-[#0B4C3A]'}`
                }>
                  <Icon size={variant === 'admin' ? 20 : 24} />
                </div>
                <span className={variant === 'admin'
                  ? `text-sm font-semibold transition-colors text-left ${isActive ? 'text-[#0B4C3A]' : 'text-gray-700'}`
                  : `text-sm font-semibold transition-colors ${isActive ? 'text-[#0B4C3A]' : 'text-gray-700 group-hover:text-[#0B4C3A]'}`
                }>
                  {link.name}
                </span>
              </>
            );

            if (!isDeletable) {
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => setActiveLinkId(link.id)}
                  className={baseClass}
                >
                  {content}
                </button>
              );
            }

            return (
              <div key={link.id} className="relative snap-start">
                <button
                  type="button"
                  onClick={() => setActiveLinkId(link.id)}
                  className={baseClass}
                >
                  {content}
                </button>

                {/* Remove (admin only, custom links only) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeLink(link);
                  }}
                  disabled={isDeleting}
                  title="Remove"
                  className={`absolute -top-2 -right-2 w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 shadow-sm flex items-center justify-center transition-colors ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}

          {/* + Add new tab (admin only) */}
          {canManageLinks && (
            <button
              type="button"
              onClick={openAdd}
              className={variant === 'admin'
                ? 'snap-start flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 hover:bg-white hover:border-emerald-200 transition-colors cursor-pointer min-w-[190px]'
                : 'snap-start flex flex-col items-center justify-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-200 hover:-translate-y-1 transition-all duration-200 group text-center cursor-pointer min-w-[150px]'
              }
            >
              <div className={variant === 'admin'
                ? 'w-10 h-10 bg-white text-gray-500 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-emerald-50 group-hover:text-[#0B4C3A] transition-colors'
                : 'w-12 h-12 bg-gray-50 text-gray-500 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-50 group-hover:text-[#0B4C3A] transition-colors'
              }>
                <Plus size={variant === 'admin' ? 20 : 24} />
              </div>
              {variant !== 'admin' && (
                <span className="text-sm font-semibold text-gray-700 group-hover:text-[#0B4C3A] transition-colors">
                  Add
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Live link opens in a separate right-side panel */}
      {isPanelOpen && activeLink && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setActiveLinkId('dashboard')}
          />

          <div className="absolute inset-y-0 right-0 w-full sm:w-[720px] bg-white shadow-xl border-l border-gray-100 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-gray-50 text-gray-500 rounded-xl flex items-center justify-center shrink-0">
                  {(() => {
                    const Icon = activeLink?.icon || ExternalLink;
                    return <Icon size={18} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{activeLink.name}</p>
                  <a
                    href={activeLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-[#0B4C3A] inline-flex items-center gap-1 truncate"
                  >
                    Open in new tab <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLinkId('dashboard')}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 bg-white">
              <iframe
                src={activeLink.href}
                title={activeLink.name}
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add new tab modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeAdd} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Add Quick Link</h3>
              <p className="text-sm text-gray-500 mt-1">Paste a URL and name to create a live tab</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                submitAdd();
              }}
              className="p-6 space-y-4"
              autoComplete="off"
            >
              <input type="text" name="fake_username" autoComplete="username" className="hidden" tabIndex={-1} />
              <input type="password" name="fake_password" autoComplete="current-password" className="hidden" tabIndex={-1} />

              {addError && (
                <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tab Name</label>
                <input
                  type="text"
                  name="quicklink_name"
                  autoComplete="off"
                  value={newTab.name}
                  onChange={(e) => setNewTab((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A]"
                  placeholder="e.g. Careers Portal"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="text"
                  name="quicklink_url"
                  autoComplete="off"
                  value={newTab.href}
                  onChange={(e) => setNewTab((p) => ({ ...p, href: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A]"
                  placeholder="https://..."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAdd}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    submitAdd();
                  }}
                  disabled={createStatus.loading}
                  className={`px-4 py-2 bg-[#0B4C3A] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 ${createStatus.loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {createStatus.loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default QuickAccessGrid;