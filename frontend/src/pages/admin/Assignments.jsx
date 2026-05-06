import { useMemo, useState } from 'react';
import { Search, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import AdminLayout from '../../components/Layout/AdminLayout';

const AdminAssignments = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const assignments = useMemo(
    () => [
      {
        id: 'ASG-1024',
        title: 'Web Development Portfolio',
        module: 'CS201 • Web Development',
        dueDate: 'May 12, 2026',
        submissions: 38,
        totalStudents: 45,
        status: 'pending',
      },
      {
        id: 'ASG-1025',
        title: 'Data Structures Quiz 3',
        module: 'CS202 • Data Structures',
        dueDate: 'May 09, 2026',
        submissions: 52,
        totalStudents: 52,
        status: 'submitted',
      },
      {
        id: 'ASG-1026',
        title: 'Operating Systems Lab Report',
        module: 'CS301 • Operating Systems',
        dueDate: 'May 06, 2026',
        submissions: 19,
        totalStudents: 33,
        status: 'overdue',
      },
      {
        id: 'ASG-1027',
        title: 'AI Ethics Reflection',
        module: 'CS350 • AI & Society',
        dueDate: 'May 20, 2026',
        submissions: 7,
        totalStudents: 41,
        status: 'pending',
      },
      {
        id: 'ASG-1028',
        title: 'Database Normalization Worksheet',
        module: 'CS210 • Databases',
        dueDate: 'May 14, 2026',
        submissions: 26,
        totalStudents: 35,
        status: 'pending',
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const hay = `${a.title} ${a.module} ${a.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [assignments, searchQuery]);

  const statusMeta = (status) => {
    if (status === 'submitted') {
      return {
        label: 'Submitted',
        pill: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        icon: CheckCircle2,
        iconWrap: 'bg-emerald-50 text-emerald-700',
      };
    }
    if (status === 'overdue') {
      return {
        label: 'Overdue',
        pill: 'bg-orange-50 text-orange-700 border-orange-100',
        icon: AlertCircle,
        iconWrap: 'bg-orange-50 text-orange-700',
      };
    }
    return {
      label: 'Pending',
      pill: 'bg-gray-50 text-gray-700 border-gray-100',
      icon: Clock,
      iconWrap: 'bg-gray-50 text-gray-500',
    };
  };

  return (
    <AdminLayout>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header / Toolbar */}
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Assignments</h2>
            <p className="text-sm text-gray-500 mt-1">Review submissions and track deadlines</p>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search title, module, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A] transition-all"
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-gray-50">
          {filtered.map((a) => {
            const meta = statusMeta(a.status);
            const MetaIcon = meta.icon;
            const completionPct = Math.min(100, Math.round((a.submissions / Math.max(1, a.totalStudents)) * 100));

            return (
              <div
                key={a.id}
                className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconWrap}`}>
                    <FileText size={18} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-gray-800 font-semibold truncate max-w-[28rem]">{a.title}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.pill}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{a.module}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span className="font-medium text-gray-400">{a.id}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <MetaIcon size={14} />
                        Due {a.dueDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-[22rem] flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-500">Submissions</span>
                    <span className="text-gray-600">
                      {a.submissions}/{a.totalStudents}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0B4C3A]/70"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-gray-500">No assignments match your search.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAssignments;
