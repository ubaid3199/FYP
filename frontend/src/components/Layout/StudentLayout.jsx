import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, CheckSquare, MessageSquare, Bell, LogOut, Menu, X, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import UniBot from '../student/UniBot';
import StickyNotes from '../student/StickyNotes';

const StudentLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const brandTheme = "bg-[#0B4C3A]";

  // Student-specific navigation links
  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: BookOpen },
    { name: 'My Modules', path: '/modules', icon: CheckSquare },
    { name: 'Schedule', path: '/schedule', icon: Calendar },
    { name: 'UniBot Help', path: '/chat', icon: MessageSquare },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      
      {/* TOP NAVIGATION BAR */}
      <header className={`${brandTheme} text-white sticky top-0 z-50 shadow-md`}>
        {/* 🔥 FIX 1: Made header fluid width with dynamic padding */}
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="flex justify-between items-center h-16">
            
            {/* Left side: Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-bold text-[#0B4C3A]">R</div>
              <span className="font-semibold tracking-wide text-lg">MyUni</span>
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

            {/* Right side: Notifications & Profile */}
            <div className="hidden md:flex items-center gap-4">
              <button className="relative text-emerald-100 hover:text-white transition-colors">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center gap-3 pl-4 border-l border-white/20">
                <div className="text-right">
                  <p className="text-sm font-medium leading-tight">{user?.name || 'Student'}</p>
                  <p className="text-xs text-emerald-200">Year 2 • BSc</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-700 border border-white/30 flex items-center justify-center">
                  <User size={16} />
                </div>
                <button onClick={handleLogout} className="ml-2 text-emerald-200 hover:text-white transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-emerald-100 hover:text-white">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-emerald-900 px-2 pt-2 pb-3 space-y-1 sm:px-3 shadow-inner">
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
              className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium text-orange-300 hover:bg-emerald-800"
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        )}
      </header>

      
    {/* PAGE CONTENT CONTAINER */}
      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
        {children}
      </main>

      {/* THE FLOATING WIDGETS */}
      <StickyNotes />
      <UniBot />

    </div>
  );
};

export default StudentLayout;