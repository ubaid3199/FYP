import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#021816]">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed}
        userRole={user?.role}
      />
      <Header isSidebarCollapsed={isSidebarCollapsed} />
      <main
        className={`pt-24 pb-12 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        } pr-8 pl-8`}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;