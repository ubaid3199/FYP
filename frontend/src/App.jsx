import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login'; 
import AdminDashboard from './pages/admin/Dashboard';
import AdminLayout from './components/Layout/AdminLayout';
import StudentDashboard from './pages/student/Dashboard';
import AdminStudents from './pages/admin/Students';
import AdminAssignments from './pages/admin/Assignments';
import AdminCourses from './pages/admin/Courses';

// Placeholder components (keep until those pages are implemented)
const StudentProfile = () => <AdminLayout><div className="p-8"><h1>Student Profile</h1></div></AdminLayout>;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        
        {/* Core Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/students/:id" element={<StudentProfile />} />
        <Route path="/admin/assignments" element={<AdminAssignments />} />
        <Route path="/admin/courses" element={<AdminCourses />} />
        
        {/* 🔥 FIX: Changed this to just "/dashboard" to match your login redirect */}
        <Route path="/dashboard" element={<StudentDashboard />} />
        
        {/* Optional but recommended: Catch-all for random URLs */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;