import { motion } from 'framer-motion';
import { BookOpen, Users, Calendar, MoreVertical, Search } from 'lucide-react';
import Layout from '../../components/Layout/Layout';

const Courses = () => {
  const courses = [
    { id: 1, name: 'Introduction to Computer Science', code: 'CS101', instructor: 'Dr. Smith', students: 45, duration: '12 weeks' },
    { id: 2, name: 'Mathematics for Engineers', code: 'MATH201', instructor: 'Prof. Johnson', students: 38, duration: '16 weeks' },
    { id: 3, name: 'Physics Fundamentals', code: 'PHY101', instructor: 'Dr. Williams', students: 52, duration: '14 weeks' },
    { id: 4, name: 'English Literature', code: 'ENG102', instructor: 'Prof. Brown', students: 29, duration: '10 weeks' },
    { id: 5, name: 'Data Structures & Algorithms', code: 'CS201', instructor: 'Dr. Davis', students: 35, duration: '12 weeks' },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Courses</h1>
            <p className="text-white/50 mt-1">Manage all courses</p>
          </div>
          <button className="px-4 py-2 bg-roeGreen rounded-lg text-white hover:bg-emerald-500 transition-colors">
            Add Course
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-roeGreen/20 flex items-center justify-center">
                  <BookOpen className="text-roeGreen" size={24} />
                </div>
                <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <MoreVertical size={16} className="text-white/60" />
                </button>
              </div>
              <h3 className="text-white font-semibold mb-1">{course.name}</h3>
              <p className="text-white/50 text-sm mb-4">{course.code}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Users size={14} />
                  <span>{course.students} students</span>
                </div>
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Calendar size={14} />
                  <span>{course.duration}</span>
                </div>
                <p className="text-white/40 text-xs">{course.instructor}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Courses;