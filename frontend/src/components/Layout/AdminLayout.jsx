import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, BookOpen, LogOut, Menu, X, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminUniBot from '../../pages/admin/AdminUniBot'; 

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // 🔥 Restored to your official University Green!
  const adminTheme = "bg-[#0B4C3A]"; 

  const navLinks = [
    { name: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Students', path: '/admin/students', icon: Users },
    { name: 'Assignments', path: '/admin/assignments', icon: FileText },
    { name: 'Courses', path: '/admin/courses', icon: BookOpen },
  ];

  const notifications = useMemo(
    () => [
      {
        id: 'notif-1',
        title: 'Pending approvals',
        message: '12 student registrations require review.',
        time: '2h ago',
        unread: true,
      },
      {
        id: 'notif-2',
        title: 'Assignment submitted',
        message: 'New submission received for CS201 Portfolio.',
        time: '45m ago',
        unread: true,
      },
      {
        id: 'notif-3',
        title: 'Course updated',
        message: 'Autumn syllabus changes were published.',
        time: '1d ago',
        unread: false,
      },
    ],
    []
  );

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.unread ? 1 : 0), 0),
    [notifications]
  );

  useEffect(() => {
    if (!isNotifOpen) return;

    const onDocMouseDown = (e) => {
      if (!notifRef.current) return;
      if (notifRef.current.contains(e.target)) return;
      setIsNotifOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isNotifOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col">
      
      {/* TOP NAVIGATION BAR */}
      <header className={`${adminTheme} text-white sticky top-0 z-40 shadow-md`}>
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="flex justify-between items-center h-16">
            
            {/* Left side: Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-[#0B4C3A] shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <span className="font-semibold tracking-wide text-lg">MyUni Admin</span>
            </div>

            {/* Middle: Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {navLinks.map((link) => {
                const isActive = location.pathname.includes(link.path);
                return (
                  <Link 
                    key={link.name} 
                    to={link.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-white/20 text-white' : 'text-emerald-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <link.icon size={16} />
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            {/* Right side: Notifications + Profile & Logout */}
            <div className="hidden md:flex items-center gap-4">
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen((p) => !p)}
                  className="relative text-emerald-100 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Notifications</p>
                        <p className="text-[11px] text-gray-500">Latest system updates</p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                          {unreadCount} new
                        </span>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                      {notifications.map((n) => (
                        <div key={n.id} className="px-4 py-3 hover:bg-gray-50/80 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {n.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {n.message}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] text-gray-400 whitespace-nowrap">{n.time}</p>
                              {n.unread && (
                                <span className="inline-block mt-1 w-2 h-2 bg-orange-500 rounded-full" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{user?.name || 'Administrator'}</p>
                <p className="text-xs text-emerald-200">System Access</p>
              </div>
              <div className="h-8 w-px bg-white/20 mx-2"></div>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 text-emerald-100 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>

            {/* Mobile: Notifications + Menu */}
            <div className="md:hidden flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsNotifOpen((p) => !p)}
                className="relative text-emerald-100 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Notifications"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full" />
                )}
              </button>

              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-emerald-100 hover:text-white">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-emerald-900 px-2 pt-2 pb-3 space-y-1 sm:px-3 shadow-inner border-t border-emerald-800">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium text-white hover:bg-emerald-800"
              >
                <link.icon size={18} />
                {link.name}
              </Link>
            ))}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-3 mt-4 rounded-md text-base font-medium text-orange-300 hover:bg-emerald-800 border-t border-emerald-800"
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        )}

        {/* Mobile Notifications Dropdown */}
        {isNotifOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-inner">
            <div className="w-full mx-auto px-4 sm:px-6 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-800">Notifications</p>
                  <p className="text-[11px] text-gray-500">Latest system updates</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  aria-label="Close notifications"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {notifications.map((n) => (
                <div key={n.id} className="w-full mx-auto px-4 sm:px-6 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-gray-400 whitespace-nowrap">{n.time}</p>
                      {n.unread && <span className="inline-block mt-1 w-2 h-2 bg-orange-500 rounded-full" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
        {children}
      </main>

      <AdminUniBot />
    </div>
  );
};

export default AdminLayout;