import { useState, useEffect } from 'react';
import api from '../../api/axios';
import AdminLayout from '../../components/Layout/AdminLayout';
import { Search, Plus, MoreVertical, Edit, Trash2 } from 'lucide-react';

const AdminStudents = () => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Keep the same Admin theme color used in AdminLayout
  const adminThemeBg = "bg-[#0B4C3A]";

  // Fetch real data from your backend
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await api.get('/students');
        setStudents(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching students:", error);
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const filteredStudents = students.filter((student) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(student.name || '').toLowerCase().includes(q) ||
      String(student.email || '').toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setCreateError('');
    setCreateForm({ name: '', email: '', password: '', role: 'student' });
    setEditingUserId(null);
    setIsCreateOpen(true);
  };

  const openEdit = (user) => {
    if (!user?._id) return;
    setCreateError('');
    setCreateForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'student',
    });
    setEditingUserId(user._id);
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    setEditingUserId(null);
    setCreateForm({ name: '', email: '', password: '', role: 'student' });
    setCreateError('');
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
      };
      if (createForm.password) {
        payload.password = createForm.password;
      }

      if (editingUserId) {
        const res = await api.put(`/users/${editingUserId}`, payload);
        setStudents((prev) => prev.map((s) => (s._id === editingUserId ? { ...s, ...res.data } : s)));
      } else {
        // For create: password is required
        if (!payload.password) {
          setCreateError('Password is required');
          return;
        }
        const res = await api.post('/users', payload);

        // If a student was created, reflect it immediately in this table.
        if (res.data?.role === 'student') {
          setStudents((prev) => [res.data, ...prev]);
        }
      }

      setIsCreateOpen(false);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        (typeof error?.response?.data === 'string' ? error.response.data : null) ||
        error?.message ||
        'Failed to create user';
      setCreateError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteStudent = async (student) => {
    if (!student?._id) return;
    const ok = window.confirm(`Delete ${student.name} (${student.email})?`);
    if (!ok) return;

    setDeletingId(student._id);
    try {
      await api.delete(`/users/${student._id}`);
      setStudents((prev) => prev.filter((s) => s._id !== student._id));
    } catch (error) {
      console.error('Error deleting user:', error);
      window.alert(error?.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

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
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A] transition-all"
              />
            </div>
            <button
              onClick={openCreate}
              className={`flex items-center gap-2 px-4 py-2 ${adminThemeBg} text-white text-sm font-medium rounded-lg hover:bg-opacity-90 transition-colors shadow-sm`}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Student</span>
            </button>
          </div>
        </div>

        {/* Create User Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={closeCreate} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">{editingUserId ? 'Edit User' : 'Add User'}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {editingUserId ? 'Update user details' : 'Create a student, lecturer, or admin account'}
                </p>
              </div>

              <form onSubmit={submitCreate} className="p-6 space-y-4" autoComplete="off">
                {/* Autofill traps (hidden) to keep browsers from pre-filling the real fields */}
                <input type="text" name="fake_username" autoComplete="username" className="hidden" tabIndex={-1} />
                <input type="password" name="fake_password" autoComplete="current-password" className="hidden" tabIndex={-1} />
                {createError && (
                  <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                    {createError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      name={editingUserId ? 'edit_user_name' : 'create_user_name'}
                      autoComplete="off"
                      value={createForm.name}
                      onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A]"
                      placeholder="Full name"
                      required
                      disabled={isCreating}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name={editingUserId ? 'edit_user_email' : 'create_user_email'}
                      autoComplete="off"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A]"
                      placeholder="name@university.ac.uk"
                      required
                      disabled={isCreating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      name={editingUserId ? 'edit_user_role' : 'create_user_role'}
                      value={createForm.role}
                      onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A]"
                      disabled={isCreating}
                    >
                      <option value="student">student</option>
                      <option value="lecturer">lecturer</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      name={editingUserId ? 'edit_user_password' : 'create_user_password'}
                      autoComplete="new-password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B4C3A]/20 focus:border-[#0B4C3A]"
                      placeholder={editingUserId ? 'Leave blank to keep' : 'Set a password'}
                      required={!editingUserId}
                      disabled={isCreating}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeCreate}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 ${adminThemeBg} text-white rounded-lg text-sm font-medium hover:bg-opacity-90 disabled:opacity-60`}
                    disabled={isCreating}
                  >
                    {isCreating ? (editingUserId ? 'Saving…' : 'Creating…') : (editingUserId ? 'Save' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
              {!isLoading && filteredStudents.map((student) => (
                <tr key={student._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0B4C3A]/10 text-[#0B4C3A] flex items-center justify-center font-bold text-xs">
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
                      <button
                        onClick={() => openEdit(student)}
                        className="p-1.5 text-gray-400 hover:text-[#0B4C3A] transition-colors rounded"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteStudent(student)}
                        disabled={deletingId === student._id}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded disabled:opacity-50"
                      >
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
          <span>Showing {filteredStudents.length} students</span>
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