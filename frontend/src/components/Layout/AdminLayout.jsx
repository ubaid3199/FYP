import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, BookOpen, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminUniBot from '../../pages/admin/AdminUniBot'; 

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 🔥 Restored to your official University Green!
  const adminTheme = "bg-[#0B4C3A]"; 

  const navLinks = [
    { name: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Students', path: '/admin/students', icon: Users },
    { name: 'Assignments', path: '/admin/assignments', icon: FileText },
    { name: 'Courses', path: '/admin/courses', icon: BookOpen },
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

            {/* Right side: Profile & Logout */}
            <div className="hidden md:flex items-center gap-4">
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
      </header>

      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
        {children}
      </main>

      <AdminUniBot />
    </div>
  );
};

export default AdminLayout;