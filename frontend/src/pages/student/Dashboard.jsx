import StudentLayout from '../../components/Layout/StudentLayout';
import TodayEngine from "../../components/student/TodayEngine";
import QuickAccessGrid from "../../components/student/QuickAccessGrid";
import UnifiedTaskPanel from "../../components/student/UnifiedTaskPanel";
import ActiveAlertsPanel from "../../components/student/ActiveAlertsPanel"; 
import { BookOpen, Clock, CheckCircle, ChevronRight } from 'lucide-react';

const StudentDashboard = () => {
  const brandBg = "bg-[#0B4C3A]";
  const brandText = "text-[#0B4C3A]";

  return (
    <StudentLayout>
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-8">
        
        {/* 1. TOP FOCUS: The Today Engine */}
        <TodayEngine />

        {/* 2. NAVIGATION: Quick Access Grid */}
        <QuickAccessGrid />

        {/* 3. THE NEW PRIORITY ROW: Tasks and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <div className="lg:col-span-2 xl:col-span-3">
            <UnifiedTaskPanel />
          </div>
          <div className="lg:col-span-1 xl:col-span-1">
            <ActiveAlertsPanel />
          </div>
        </div>

        {/* 4. QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Clock size={22} /></div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Upcoming Deadlines</p>
              <p className="text-2xl font-bold text-gray-800">2 Tasks</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><BookOpen size={22} /></div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Active Modules</p>
              <p className="text-2xl font-bold text-gray-800">4 Modules</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle size={22} /></div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Overall Attendance</p>
              <p className="text-2xl font-bold text-gray-800">92%</p>
            </div>
          </div>
        </div>

        {/* 5. BOTTOM SECTION: Modules (Now full-width and grid-based!) */}
        <div className="w-full space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen size={18} className={brandText} /> My Modules
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 'CS201', name: 'Data Structures & Algorithms', progress: 75, instructor: 'Dr. Alan Smith' },
              { id: 'CS202', name: 'Web Application Development', progress: 60, instructor: 'Prof. Sarah Jenkins' },
              { id: 'CS203', name: 'Database Systems', progress: 85, instructor: 'Dr. Emily Chen' },
            ].map(module => (
              <div key={module.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-100 transition-all group cursor-pointer flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">{module.id}</span>
                      <h3 className="text-lg font-bold text-gray-800 mt-2.5 group-hover:text-[#0B4C3A] transition-colors">{module.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{module.instructor}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors shrink-0">
                      <ChevronRight size={18} className="text-gray-400 group-hover:text-[#0B4C3A]" />
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
                    <span>Course Progress</span>
                    <span>{module.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className={`${brandBg} h-full rounded-full transition-all duration-1000`} style={{ width: `${module.progress}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </StudentLayout>
  );
};

export default StudentDashboard;