import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminLayout from '../../components/Layout/AdminLayout';
import { Search, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';

const AdminStudents = () => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // The Roehampton Brand Color
  const brandBg = "bg-[#8A1538]";
  const brandText = "text-[#8A1538]";

  // Fetch real data from your backend
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/students');
        setStudents(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching students:", error);
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, []);

  return (
    <AdminLayout>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Table Header / Toolbar */}
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Manage Students</h2>
            <p className="text-sm text-gray-500 mt-1">View and manage all enrolled students</p>
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search names or emails..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8A1538]/20 focus:border-[#8A1538] transition-all"
              />
            </div>
            <button className={`flex items-center gap-2 px-4 py-2 ${brandBg} text-white text-sm font-medium rounded-lg hover:bg-opacity-90 transition-colors shadow-sm`}>
              <Plus size={16} />
              <span className="hidden sm:inline">Add Student</span>
            </button>
          </div>
        </div>

        {/* The Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              
              {/* Loading State */}
              {isLoading && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    Loading student records...
                  </td>
                </tr>
              )}

              {/* Empty State (If no students exist yet) */}
              {!isLoading && students.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                        <Search size={24} className="text-gray-400" />
                      </div>
                      <p className="text-gray-800 font-medium">No students found</p>
                      <p className="text-sm text-gray-500 mt-1">Click "Add Student" to create the first record.</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data Rendering */}
              {!isLoading && students.map((student) => (
                <tr key={student._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#8A1538]/10 text-[#8A1538] flex items-center justify-center font-bold text-xs">
                        {student.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {student.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 text-gray-400 hover:text-[#8A1538] transition-colors rounded">
                        <Edit size={16} />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-sm text-gray-500">
          <span>Showing {students.length} students</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-gray-200 rounded hover:bg-white disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 border border-gray-200 rounded hover:bg-white disabled:opacity-50" disabled>Next</button>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
};

export default AdminStudents;