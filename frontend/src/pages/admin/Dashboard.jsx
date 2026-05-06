import AdminLayout from '../../components/Layout/AdminLayout';
import PriorityPanel from '../../components/Dashboard/PriorityPanel';
import AtRiskPanel from '../../components/dashboard/AtRiskPanel';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import QuickManagement from '../../components/dashboard/QuickManagement';
import QuickAccessGrid from '../../components/student/QuickAccessGrid';
import { Users, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

const AdminDashboard = () => {
  return (
    <AdminLayout>
      <QuickAccessGrid variant="admin" />
      {/* 1. COMPACT STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {[
          { label: 'Active Students', value: '14,284', icon: Users, trend: '+124 this week' },
          { label: 'Active Modules', value: '412', icon: BookOpen, trend: 'Autumn Semester' },
          { label: 'Pending Approvals', value: '28', icon: AlertCircle, trend: 'Requires attention', alert: true },
          { label: 'System Uptime', value: '99.9%', icon: CheckCircle2, trend: 'All systems operational' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
              <div className={`p-2 rounded-lg ${stat.alert ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                <stat.icon size={18} />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-gray-800 tracking-tight">{stat.value}</h3>
              <p className={`text-xs mt-1 font-medium ${stat.alert ? 'text-orange-500' : 'text-gray-400'}`}>
                {stat.trend}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. THE 70/30 SPLIT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* LEFT COLUMN (70%) */}
        <div className="lg:col-span-8 flex flex-col gap-6 lg:gap-8">
          <PriorityPanel />
          <AtRiskPanel />
        </div>

        {/* RIGHT COLUMN (30%) */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:gap-8">
          <div className="flex-1 max-h-[450px]">
            <ActivityFeed />
          </div>
          <QuickManagement />
        </div>
        
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;