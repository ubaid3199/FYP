import { motion } from 'framer-motion';
import { BookOpen, Users, Calendar, Clock, FileText } from 'lucide-react';
import Layout from '../../components/Layout/Layout';

const MyCourses = () => {
  const courses = [
    { 
      id: 1, 
      name: 'Introduction to Computer Science', 
      code: 'CS101', 
      instructor: 'Dr. Smith', 
      progress: 65, 
      nextLesson: 'Functions & Scope',
      nextDeadline: 'Assignment 3 due tomorrow'
    },
    { 
      id: 2, 
      name: 'Mathematics for Engineers', 
      code: 'MATH201', 
      instructor: 'Prof. Johnson', 
      progress: 40, 
      nextLesson: 'Calculus Review',
      nextDeadline: 'Problem Set 5 due in 3 days'
    },
    { 
      id: 3, 
      name: 'Physics Fundamentals', 
      code: 'PHY101', 
      instructor: 'Dr. Williams', 
      progress: 80, 
      nextLesson: 'Motion Laws',
      nextDeadline: 'Lab Report due in 5 days'
    },
    { 
      id: 4, 
      name: 'English Literature', 
      code: 'ENG102', 
      instructor: 'Prof. Brown', 
      progress: 30, 
      nextLesson: 'Shakespeare Analysis',
      nextDeadline: 'Essay due next week'
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Courses</h1>
          <p className="text-white/50 mt-1">Continue learning where you left off</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((course) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-lg">{course.name}</h3>
                  <p className="text-white/50 text-sm">{course.code} • {course.instructor}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-roeGreen/20 flex items-center justify-center">
                  <BookOpen className="text-roeGreen" size={24} />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/70">Progress</span>
                  <span className="text-white">{course.progress}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-roeGreen rounded-full"></div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Clock size={14} />
                  <span>{course.nextLesson}</span>
                </div>
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <FileText size={14} />
                  <span>{course.nextDeadline}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default MyCourses;