import { Link } from 'react-router-dom';
import { UserPlus, BookOpen, FileText, Megaphone } from 'lucide-react';

const QuickManagement = () => {
  const actions = [
    { name: "Add Student", icon: UserPlus, path: "/admin/students" },
    { name: "Add Module", icon: BookOpen, path: "/admin/courses" },
    { name: "Create Assignment", icon: FileText, path: "/admin/assignments" },
    { name: "Send Announcement", icon: Megaphone, path: "/admin/announcements" }
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 shrink-0">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, idx) => (
          <Link key={idx} to={action.path} className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-[#0B4C3A]/5 hover:border-[#0B4C3A]/30 hover:shadow-sm border border-gray-100 transition-all text-gray-700 group">
            <action.icon size={24} className="mb-2 text-gray-400 group-hover:text-[#0B4C3A] transition-colors" />
            <span className="text-sm font-medium text-center">{action.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default QuickManagement;