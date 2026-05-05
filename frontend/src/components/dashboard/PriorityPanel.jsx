import { useNavigate } from 'react-router-dom';
import { FileText, Users, BookOpen } from 'lucide-react';

const PriorityPanel = () => {
  const navigate = useNavigate();
  const brandBg = "bg-[#0B4C3A]";

  const priorityTasks = [
    { id: 1, title: "Assignments Pending", description: "5 submissions for Advanced Computing need grading.", urgency: "Due today", urgencyType: "critical", actionText: "Review", icon: FileText, targetRoute: "/admin/assignments" },
    { id: 2, title: "New Student Enrollments", description: "12 pending registrations await final approval.", urgency: "New", urgencyType: "info", actionText: "Approve", icon: Users, targetRoute: "/admin/students" },
    { id: 3, title: "Module Syllabus Update", description: "Dr. Smith submitted changes for the Autumn term.", urgency: "2 days ago", urgencyType: "neutral", actionText: "View", icon: BookOpen, targetRoute: "/admin/courses" }
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Priority Actions</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tasks requiring immediate attention</p>
        </div>
      </div>
      <div className="divide-y divide-gray-50 flex-1">
        {priorityTasks.map((task) => (
          <div key={task.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 text-gray-600 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                <task.icon size={20} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-gray-800 font-semibold">{task.title}</h4>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${task.urgencyType === 'critical' ? 'bg-orange-50 text-orange-600' : task.urgencyType === 'info' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {task.urgency}
                  </span>
                </div>
                <p className="text-gray-500 text-sm">{task.description}</p>
              </div>
            </div>
            <button onClick={() => navigate(task.targetRoute)} className={`w-full sm:w-auto px-5 py-2 ${brandBg} text-white text-sm font-medium rounded-lg hover:bg-opacity-90 transition-all shadow-sm`}>
              {task.actionText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PriorityPanel;