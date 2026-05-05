import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import Layout from '../../components/Layout/Layout';

const Assignments = () => {
  const assignments = [
    { 
      id: 1, 
      title: 'Programming Assignment 3', 
      course: 'CS101', 
      due: 'Tomorrow', 
      status: 'pending',
      points: 100
    },
    { 
      id: 2, 
      title: 'Math Problem Set 5', 
      course: 'MATH201', 
      due: '3 days', 
      status: 'in-progress',
      points: 50
    },
    { 
      id: 3, 
      title: 'Physics Lab Report', 
      course: 'PHY101', 
      due: '5 days', 
      status: 'not-started',
      points: 75
    },
    { 
      id: 4, 
      title: 'Essay on Shakespeare', 
      course: 'ENG102', 
      due: '1 week', 
      status: 'completed',
      points: 85
    },
  ];

  const statusConfig = {
    pending: { label: 'Due Soon', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: AlertCircle },
    'in-progress': { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Clock },
    'not-started': { label: 'Not Started', color: 'text-white/50', bg: 'bg-white/5', icon: FileText },
    completed: { label: 'Completed', color: 'text-roeGreen', bg: 'bg-roeGreen/10', icon: CheckCircle },
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Assignments</h1>
          <p className="text-white/50 mt-1">Track your coursework</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const config = statusConfig[assignment.status];
              const Icon = config.icon;
              return (
                <motion.div
                  key={assignment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-roeGreen/20 flex items-center justify-center">
                    <FileText className="text-roeGreen" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{assignment.title}</h3>
                    <p className="text-white/50 text-sm">{assignment.course} • {assignment.points} points</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white/70 text-sm">{assignment.due}</span>
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs ${config.bg} ${config.color}`}>
                      <Icon size={12} />
                      {config.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Assignments;