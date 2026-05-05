import { Upload, CheckCircle, UserPlus, FileEdit, Clock } from 'lucide-react';

const ActivityFeed = () => {
  const activities = [
    { id: 1, description: "Web Dev assignment uploaded", time: "10 min ago", icon: Upload, colorClass: "text-blue-600 bg-blue-50" },
    { id: 2, description: "Sarah Jenkins submitted 'Final Essay'", time: "45 min ago", icon: CheckCircle, colorClass: "text-green-600 bg-green-50" },
    { id: 3, description: "New student registration: ID 210499", time: "2 hours ago", icon: UserPlus, colorClass: "text-purple-600 bg-purple-50" },
    { id: 4, description: "CS101 Midterms grades published", time: "3 hours ago", icon: FileEdit, colorClass: "text-[#0B4C3A] bg-[#0B4C3A]/10" }
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2 bg-white shrink-0">
        <Clock size={18} className="text-[#0B4C3A]" />
        <h2 className="text-lg font-bold text-gray-800">Today's Activity</h2>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        <div className="divide-y divide-gray-50">
          {activities.map((activity) => (
            <div key={activity.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/80 transition-colors group">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activity.colorClass}`}>
                <activity.icon size={14} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate group-hover:text-gray-900 transition-colors">{activity.description}</p>
              </div>
              <div className="shrink-0">
                <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityFeed;