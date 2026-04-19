"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, CloudSun, Newspaper, Train, ChevronRight, MapPin, Activity } from 'lucide-react';

export function InfoWidget() {
  const [time, setTime] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Mock Data States
  const [weather, setWeather] = useState({ temp: 14, desc: "Mostly Cloudy" });
  const [news, setNews] = useState([
    { title: "Roehampton Campus Expansion", time: "2h ago" },
    { title: "Student Union Elections Start Friday", time: "5h ago" },
    { title: "New Coffee Shop in Digby Stuart", time: "1d ago" }
  ]);
  const [travel, setTravel] = useState([
    { line: "District Line", status: "Good Service", color: "bg-green-600" },
    { line: "SWR Rail", status: "Minor Delays", color: "bg-orange-500" },
    { line: "Bus 72 / 265", status: "Normal Service", color: "bg-red-600" }
  ]);

  // Clock Update (Seconds)
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Smart Refresh Logic (Every 5 minutes)
  const refreshData = useCallback(() => {
    console.log("[MyUni Widget] Refreshing smart data...");
    // Slightly randomize mock data to show "updates"
    setWeather(prev => ({ ...prev, temp: prev.temp + (Math.random() > 0.5 ? 1 : -1) }));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    const refreshInterval = setInterval(refreshData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(refreshInterval);
  }, [refreshData]);

  return (
    <div 
      className="fixed right-0 top-1/2 -translate-y-1/2 z-[600] flex group"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* The "Pulse" Trigger Area */}
      <div className={`flex h-36 w-2 cursor-pointer items-center justify-center overflow-hidden rounded-l-full transition-all duration-500 ${isExpanded ? 'bg-blue-500 opacity-0' : 'bg-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-500'}`}>
        <div className="whitespace-nowrap rotate-90 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
          STUDENT INFO
        </div>
      </div>

      {/* The Smart Panel */}
      <div className={`h-fit max-h-[80vh] overflow-hidden transition-all duration-700 ease-out ${isExpanded ? 'w-80 translate-x-0 opacity-100' : 'w-0 translate-x-10 opacity-0'}`}>
        <div className="glass-panel flex flex-col gap-6 rounded-l-3xl border-l-0 bg-black/60 p-6 shadow-[-20px_0_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-3xl">
          
          {/* Header & Clock */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <div className="text-3xl font-black tracking-tight text-white">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                {time.toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-300">
                <CloudSun size={16} /> {weather.temp}°C
              </div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                <Activity size={8} className="animate-pulse text-green-500" /> Refreshed {Math.floor((new Date().getTime() - lastUpdated.getTime()) / 60000)}m ago
              </div>
            </div>
          </div>

          {/* Travel Section */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
              <Train size={12} className="text-green-500" /> Travel Live
            </h3>
            <div className="space-y-2.5">
              {travel.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1 group/item cursor-default">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-300 group-hover/item:text-white transition-colors">{item.line}</span>
                    <span className={item.status === 'Good Service' || item.status === 'Normal Service' ? 'text-green-500' : 'text-orange-400'}>
                      {item.status}
                    </span>
                  </div>
                  <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} w-full opacity-60 group-hover/item:opacity-100 transition-opacity`} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* News Section */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
              <Newspaper size={12} className="text-blue-500" /> Campus News
            </h3>
            <div className="space-y-3">
              {news.map((item, idx) => (
                <div key={idx} className="hover:bg-white/5 p-2 -mx-2 rounded-xl transition-all cursor-pointer group/news">
                  <div className="text-xs font-semibold leading-snug text-slate-200 transition-colors group-hover/news:text-blue-300">
                    {item.title}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">{item.time}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer Footer */}
          <div className="mt-1 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <MapPin size={8} /> Roehampton Vicinity
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
