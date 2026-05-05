import React from 'react';
import { Clock, MapPin, ArrowRight, FileText, PlayCircle } from 'lucide-react';

const TodayEngine = () => {
  // Format today's date cleanly (e.g., "Monday, 24 October")
  const todayDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const brandBg = "bg-[#0B4C3A]";
  const brandText = "text-[#0B4C3A]";

  return (
    <section className="w-full mb-8">
      {/* HEADER SECTION */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Welcome back, Emma 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm font-medium">
          {todayDate}
        </p>
      </div>

      {/* TODAY ENGINE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MAIN CARD: NEXT CLASS (Spans 2 columns on desktop) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none transition-opacity group-hover:opacity-80"></div>
          
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                Up Next
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">
                <Clock size={16} />
                Starts in 1h 20m
              </span>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                Web Application Development
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-gray-600 font-medium">
                <div className="flex items-center gap-2">
                  <Clock size={18} className={brandText} />
                  10:00 AM - 12:00 PM
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={18} className={brandText} />
                  Room B204, Duchesne Building
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative z-10 mt-auto">
            <button className={`${brandBg} text-white hover:bg-emerald-800 transition-colors px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-sm`}>
              Open Module
            </button>
            <button className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
              View Details
            </button>
          </div>
        </div>

        {/* SIDE CARD: TODAY'S TASKS (Spans 1 column) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Today's Tasks</h3>
            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">
              2 Due
            </span>
          </div>

          <div className="space-y-4 flex-1">
            {/* Task 1 */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition-colors group">
              <h4 className="text-sm font-bold text-gray-900 mb-1">React Components Lab</h4>
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                <Clock size={12} /> Due at 23:59
              </p>
              <button className={`w-full ${brandBg} text-white py-2 rounded-lg text-sm font-semibold hover:bg-emerald-800 transition-colors shadow-sm`}>
                Submit Work
              </button>
            </div>

            {/* Task 2 */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 transition-colors group">
              <h4 className="text-sm font-bold text-gray-900 mb-1">Read Chapter 4</h4>
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                <FileText size={12} /> Prep for seminar
              </p>
              <button className="w-full bg-white text-gray-700 border border-gray-200 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
                Open PDF
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default TodayEngine;