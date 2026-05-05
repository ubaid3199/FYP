import { AlertCircle, Calendar, ChevronRight, Clock, FileText } from 'lucide-react';

const UnifiedTaskPanel = () => {
  const brandBg = "bg-[#0B4C3A]";
  const brandText = "text-[#0B4C3A]";

  // Mock data grouped by urgency
  const tasks = {
    today: [
      { id: 1, title: 'React Project Submission', module: 'Web Application Development', time: '23:59', type: 'assignment' },
      { id: 2, title: 'Chapter 4 Reading Quiz', module: 'Database Systems', time: '14:00', type: 'quiz' }
    ],
    tomorrow: [
      { id: 3, title: 'Algorithm Analysis Essay', module: 'Data Structures & Algorithms', time: '17:00', type: 'assignment' }
    ],
    upcoming: [
      { id: 4, title: 'Midterm Portfolio Draft', module: 'UI/UX Design', date: 'Friday, 24 Oct', time: '23:59', type: 'project' }
    ]
  };

  return (
    <section className="w-full mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <AlertCircle size={20} className={brandText} />
          Priority Tasks
        </h2>
        <button className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition-colors">
          View All Tasks →
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* DUE TODAY SECTION */}
        <div className="bg-orange-50/50 px-6 py-3 border-b border-orange-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
          <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider">Due Today</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {tasks.today.map(task => (
            <div key={task.id} className="p-6 hover:bg-orange-50/30 transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-1 sm:mt-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-orange-700 transition-colors">{task.title}</h4>
                  <p className="text-sm text-gray-500 mt-0.5">{task.module}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:pl-4 sm:border-l border-gray-100 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-1.5 text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg">
                  <Clock size={16} /> {task.time}
                </div>
                <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 font-semibold py-2 px-4 rounded-xl text-sm transition-all shadow-sm flex items-center gap-1">
                  Open <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* DUE TOMORROW SECTION */}
        <div className="bg-gray-50 px-6 py-3 border-y border-gray-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Due Tomorrow</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {tasks.tomorrow.map(task => (
            <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 mt-1 sm:mt-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-[#0B4C3A] transition-colors">{task.title}</h4>
                  <p className="text-sm text-gray-500 mt-0.5">{task.module}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:pl-4 sm:border-l border-gray-100 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
                  <Clock size={16} /> {task.time}
                </div>
                <button className={`bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-[#0B4C3A] hover:text-white hover:border-[#0B4C3A] font-semibold py-2 px-4 rounded-xl text-sm transition-all shadow-sm flex items-center gap-1`}>
                  Open <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* UPCOMING SECTION */}
        <div className="bg-gray-50 px-6 py-3 border-y border-gray-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Upcoming</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {tasks.upcoming.map(task => (
            <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 mt-1 sm:mt-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 group-hover:text-[#0B4C3A] transition-colors">{task.title}</h4>
                  <p className="text-sm text-gray-500 mt-0.5">{task.module}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:pl-4 sm:border-l border-gray-100 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                  <Calendar size={16} /> {task.date}
                </div>
                <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold py-2 px-4 rounded-xl text-sm transition-all shadow-sm flex items-center gap-1">
                  Open <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default UnifiedTaskPanel;