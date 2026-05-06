import { useMemo, useState } from 'react';
import { Search, BookOpen, Users, Calendar, CheckCircle2 } from 'lucide-react';
import AdminLayout from '../../components/Layout/AdminLayout';

const AdminCourses = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const courses = useMemo(
    () => [
      {
        id: 'MOD-CS101',
        name: 'Introduction to Computer Science',
        code: 'CS101',
        instructor: 'Dr. Smith',
        students: 45,
        duration: '12 weeks',
        status: 'active',
      },
      {
        id: 'MOD-CS201',
        name: 'Data Structures & Algorithms',
        code: 'CS201',
        instructor: 'Dr. Davis',
        students: 35,
        duration: '12 weeks',
        status: 'active',
      },
      {
        id: 'MOD-DB210',
        name: 'Database Systems',
        code: 'CS210',
        instructor: 'Prof. Johnson',
        students: 38,
        duration: '10 weeks',
        status: 'active',
      },
      {
        id: 'MOD-AI350',
        name: 'AI & Society',
        code: 'CS350',
        instructor: 'Dr. Williams',
        students: 41,
        duration: '8 weeks',
        status: 'draft',
      },
      {
        id: 'MOD-OS301',
        name: 'Operating Systems',
        code: 'CS301',
        instructor: 'Prof. Brown',
        students: 33,
        duration: '14 weeks',
        status: 'active',
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => {
      const hay = `${c.name} ${c.code} ${c.instructor} ${c.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [courses, searchQuery]);

  const statusPill = (status) => {
    if (status === 'draft') return 'bg-gray-50 text-gray-600 border-gray-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  };

  return (
    <AdminLayout>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header / Toolbar */}
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Courses</h2>
            <p className="text-sm text-gray-500 mt-1">Manage modules and enrollment</p>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search course, code, or instructor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center shrink-0 border border-gray-100">
                      <BookOpen size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-gray-800 font-semibold truncate max-w-[14rem]">{course.name}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusPill(course.status)}`}>
                          {course.status === 'draft' ? 'Draft' : 'Active'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{course.code}</p>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0B4C3A] flex items-center justify-center border border-emerald-100 shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Users size={14} className="text-gray-400" />
                    <span>{course.students} students</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Calendar size={14} className="text-gray-400" />
                    <span>{course.duration}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{course.instructor}</p>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-500">No courses match your search.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminCourses;