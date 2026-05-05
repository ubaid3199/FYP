import { Bell, FileCheck, Clock, MapPin, ChevronRight } from 'lucide-react';

const ActiveAlertsPanel = () => {
  const brandText = "text-[#0B4C3A]";

  // Mock data: Mixing unread and read alerts to show the visual difference
  const alerts = [
    {
      id: 1,
      type: 'feedback',
      message: 'Feedback released for Web Development coursework',
      time: '2 hours ago',
      icon: FileCheck,
      unread: true,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100'
    },
    {
      id: 2,
      type: 'deadline',
      message: 'Deadline extended: React Components Lab',
      time: '5 hours ago',
      icon: Clock,
      unread: true,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      id: 3,
      type: 'update',
      message: 'Room Change: Seminar now in Duchesne B204',
      time: 'Yesterday',
      icon: MapPin,
      unread: false,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100'
    }
  ];

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Bell size={18} className={brandText} /> Active Alerts
        </h2>
        <button className="text-xs font-semibold text-gray-500 hover:text-[#0B4C3A] transition-colors">
          Mark all read
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        {alerts.map((alert) => (
          <div 
            key={alert.id} 
            className={`p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors group flex gap-4 ${
              alert.unread ? 'bg-emerald-50/30' : 'opacity-80'
            }`}
          >
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${alert.bgColor} ${alert.color}`}>
              <alert.icon size={20} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm tracking-tight leading-snug mb-1 ${
                  alert.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                }`}>
                  {alert.message}
                </p>
                {/* Unread dot */}
                {alert.unread && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5 animate-pulse"></span>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-gray-400">
                  {alert.time}
                </span>
                <button className="text-xs font-bold text-[#0B4C3A] bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                  View <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ActiveAlertsPanel;