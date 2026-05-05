import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Mail, Eye } from 'lucide-react';

const AtRiskPanel = () => {
  const navigate = useNavigate();

  const atRiskStudents = [
    { id: 'STU-1', name: "Emma Thompson", issue: "Missed last 2 assignments", lastActive: "Active 5 days ago", severity: "high", actionType: "contact", email: "emma@test.com" },
    { id: 'STU-2', name: "James Wilson", issue: "Failed midterm exam (34%)", lastActive: "Active today", severity: "high", actionType: "profile" },
    { id: 'STU-3', name: "Sophia Patel", issue: "No login activity for 7 days", lastActive: "Active 1 week ago", severity: "medium", actionType: "contact", email: "sophia@test.com" },
    { id: 'STU-4', name: "Oliver Brown", issue: "Low engagement in forum discussions", lastActive: "Active 2 days ago", severity: "medium", actionType: "profile" }
  ];

  const handleAction = (student) => {
    if (student.actionType === 'profile') {
      navigate(`/admin/students/${student.id}`);
    } else {
      window.location.href = `mailto:${student.email}?subject=Checking In`;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 bg-white">
        <h2 className="text-lg font-bold text-gray-800">At-Risk Students</h2>
        <p className="text-sm text-gray-500 mt-0.5">Early intervention required</p>
      </div>
      <div className="divide-y divide-gray-50">
        {atRiskStudents.map((student) => (
          <div key={student.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors group">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm shrink-0">
                  {student.name.charAt(0)}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${student.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`}>
                  <AlertTriangle size={8} className="text-white" strokeWidth={3} />
                </div>
              </div>
              <div>
                <h4 className="text-gray-800 font-semibold mb-0.5">{student.name}</h4>
                <p className="text-gray-600 text-sm font-medium">{student.issue}</p>
                <p className="text-gray-400 text-xs mt-1">{student.lastActive}</p>
              </div>
            </div>
            <button onClick={() => handleAction(student)} className="w-full sm:w-auto px-4 py-2 bg-[#0B4C3A]/5 text-[#0B4C3A] hover:bg-[#0B4C3A] hover:text-white border border-[#0B4C3A]/20 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2">
              {student.actionType === 'contact' ? <Mail size={16} /> : <Eye size={16} />}
              {student.actionType === 'contact' ? 'Contact' : 'Profile'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AtRiskPanel;