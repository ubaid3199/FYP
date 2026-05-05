import { Bell, Search, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Header = ({ isSidebarCollapsed }) => {
  const { user } = useAuth();

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white/[0.02] backdrop-blur-2xl border-b border-white/[0.08] z-40 transition-all duration-300 ${
        isSidebarCollapsed ? 'left-20' : 'left-64'
      }`}
    >
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-roeGreen/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <Bell size={20} className="text-white/70" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-roeGreen rounded-full"></span>
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right">
              <p className="text-white font-medium text-sm">{user?.name || 'User'}</p>
              <p className="text-white/40 text-xs capitalize">{user?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-roeGreen to-emerald-400 flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;