import { getServiceById } from "@/lib/domains/services";
import { AppIcon } from "@/lib/ui";
import { StickyNotesWorkspace } from "@/components";
import { CalendarDays, CircleCheckBig, Clock3, ExternalLink, Search, Sparkles, Users2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface ToolSampleContent {
  intro: string;
  stats: Array<{ label: string; value: string; hint: string }>;
  quickActions: string[];
  table: {
    title: string;
    columns: string[];
    rows: string[][];
  };
}

function getSampleContent(serviceId: string): ToolSampleContent {
  const contentByService: Record<string, ToolSampleContent> = {
    moodle: {
      intro: "Track coursework, deadlines, and instructor updates in one place.",
      stats: [
        { label: "Active Modules", value: "6", hint: "This semester" },
        { label: "Pending Tasks", value: "14", hint: "Due this week" },
        { label: "Average Grade", value: "82%", hint: "Across assessments" },
      ],
      quickActions: [
        "Open latest assignment brief",
        "Download lecture slides",
        "Post a question in class forum",
      ],
      table: {
        title: "Upcoming Deadlines",
        columns: ["Course", "Task", "Due Date", "Status"],
        rows: [
          ["Data Structures", "Lab 4 Submission", "Apr 12, 2026", "In Progress"],
          ["AI Fundamentals", "Quiz 3", "Apr 14, 2026", "Not Started"],
          ["HCI", "Prototype Report", "Apr 18, 2026", "Draft Ready"],
        ],
      },
    },
    seats: {
      intro: "Preview live occupancy patterns and recommended study spots.",
      stats: [
        { label: "Available Seats", value: "142", hint: "Across 4 zones" },
        { label: "Peak Occupancy", value: "87%", hint: "Today 11:30 AM" },
        { label: "Quiet Rooms", value: "9", hint: "Bookable now" },
      ],
      quickActions: [
        "Reserve a quiet pod",
        "Find power-outlet seating",
        "Set occupancy alerts",
      ],
      table: {
        title: "Library Zones",
        columns: ["Zone", "Capacity", "Occupied", "Recommendation"],
        rows: [
          ["Silent Floor A", "80", "52", "Best availability"],
          ["Collaborative Hub", "120", "108", "Nearly full"],
          ["Media Lab", "40", "22", "Good for group work"],
        ],
      },
    },
    nest: {
      intro: "Manage student services, requests, and personalized campus updates.",
      stats: [
        { label: "Open Requests", value: "3", hint: "Awaiting response" },
        { label: "Documents", value: "11", hint: "Ready to download" },
        { label: "Upcoming Events", value: "5", hint: "Next 7 days" },
      ],
      quickActions: [
        "Submit council query",
        "Request enrollment letter",
        "View fee statement",
      ],
      table: {
        title: "Recent Service Requests",
        columns: ["Request", "Department", "Submitted", "Progress"],
        rows: [
          ["ID Card Renewal", "Student Office", "Apr 07, 2026", "Approved"],
          ["Council Tax Letter", "Registry", "Apr 08, 2026", "Under Review"],
          ["Timetable Adjustment", "Academic Admin", "Apr 09, 2026", "Pending"],
        ],
      },
    },
    handshake: {
      intro: "Discover internships, graduate roles, and employer events tailored to your profile.",
      stats: [
        { label: "Matched Roles", value: "28", hint: "Based on skills" },
        { label: "Applications", value: "4", hint: "In pipeline" },
        { label: "Career Events", value: "6", hint: "This month" },
      ],
      quickActions: [
        "Update resume profile",
        "Apply to shortlisted roles",
        "Book a career coaching slot",
      ],
      table: {
        title: "Recommended Opportunities",
        columns: ["Role", "Company", "Location", "Deadline"],
        rows: [
          ["Junior Frontend Intern", "NeoLearn", "London", "Apr 21, 2026"],
          ["Data Analyst Trainee", "CityMetrics", "Remote", "Apr 25, 2026"],
          ["Product Design Intern", "Studio North", "Manchester", "Apr 29, 2026"],
        ],
      },
    },
  };

  return (
    contentByService[serviceId] ?? {
      intro: "Explore tools and updates tailored to this service.",
      stats: [
        { label: "Items", value: "12", hint: "Available" },
        { label: "Updates", value: "3", hint: "Today" },
        { label: "Actions", value: "5", hint: "Quick access" },
      ],
      quickActions: ["Review summary", "Open latest update", "Manage preferences"],
      table: {
        title: "Recent Items",
        columns: ["Name", "Category", "Updated", "State"],
        rows: [
          ["Overview", "General", "Apr 09, 2026", "Active"],
          ["Notifications", "System", "Apr 08, 2026", "Active"],
          ["Settings", "Configuration", "Apr 07, 2026", "Draft"],
        ],
      },
    }
  );
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const resolvedParams = await params;
  const service = getServiceById(resolvedParams.service);

  if (!service) {
    notFound();
  }

  const sampleContent = getSampleContent(service.id);

  if (service.id === "sticky-notes") {
    return (
      <div className="flex h-screen flex-col bg-[#0f172a]">
        <header className="flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              ← Back to Dashboard
            </Link>
            <div className="h-4 w-px bg-white/20"></div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-blue-300">
                <AppIcon iconName={service.icon} size={18} />
              </span>
              {service.name}
            </h1>
          </div>
        </header>

        <StickyNotesWorkspace />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0f172a]">
      {/* Top Navigation Bar */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            ← Back to Dashboard
          </Link>
          <div className="h-4 w-px bg-white/20"></div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-blue-300">
              <AppIcon iconName={service.icon} size={18} />
            </span>
            {service.name}
          </h1>
        </div>
        <div>
          <a
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-400 underline underline-offset-4 hover:text-blue-300"
          >
            Open official site <ExternalLink size={14} />
          </a>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <section className="glass-panel rounded-2xl border border-white/10 p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{service.name} Workspace</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">{sampleContent.intro}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                <Sparkles size={14} className="text-blue-300" /> Sample data mode
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {sampleContent.stats.map((stat) => (
              <article key={stat.label} className="glass-panel rounded-2xl border border-white/10 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-xs text-slate-400">{stat.hint}</p>
              </article>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <article className="glass-panel rounded-2xl border border-white/10 p-6 lg:col-span-1">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <CircleCheckBig size={18} className="text-emerald-400" /> Quick Actions
              </h3>
              <ul className="space-y-3">
                {sampleContent.quickActions.map((action) => (
                  <li key={action} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    {action}
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                Replace this with real API-backed content when integration is ready.
              </div>
            </article>

            <article className="glass-panel rounded-2xl border border-white/10 p-6 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{sampleContent.table.title}</h3>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Clock3 size={14} /> Updated just now
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-300">
                    <tr>
                      {sampleContent.table.columns.map((column) => (
                        <th key={column} className="px-4 py-3 font-semibold">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleContent.table.rows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="border-t border-white/10 text-slate-200">
                        {row.map((cell, cellIndex) => (
                          <td key={`cell-${rowIndex}-${cellIndex}`} className="px-4 py-3">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="glass-panel rounded-2xl border border-white/10 p-5">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <CalendarDays size={16} className="text-indigo-300" /> Weekly Focus
              </h4>
              <p className="text-sm text-slate-300">Complete top-priority tasks and keep your dashboard queue below 10 items.</p>
            </article>
            <article className="glass-panel rounded-2xl border border-white/10 p-5">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Users2 size={16} className="text-cyan-300" /> Collaboration
              </h4>
              <p className="text-sm text-slate-300">Invite peers, staff, or mentors based on workflow role and permission level.</p>
            </article>
            <article className="glass-panel rounded-2xl border border-white/10 p-5">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Search size={16} className="text-amber-300" /> Smart Filters
              </h4>
              <p className="text-sm text-slate-300">Filter by date, status, or relevance to quickly focus on what matters today.</p>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
