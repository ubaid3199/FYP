const User = require('../models/User');
const Course = require('../models/Course');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');

const getDashboardData = async (req, res) => {
  try {
    // 🚀 Promise.all allows us to fetch all 5 queries at the EXACT SAME TIME, 
    // making your dashboard load blazingly fast.
    const [
      totalStudents,
      activeModules,
      pendingTasksCount,
      priorityTasks,
      atRiskStudents,
      recentActivity
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Course.countDocuments({ status: 'active' }),
      Task.countDocuments({ isCompleted: false }),
      Task.find({ isCompleted: false }).limit(4),
      User.find({ role: 'student', enrollmentStatus: 'at-risk' }).select('-password').limit(4),
      ActivityLog.find().sort({ createdAt: -1 }).limit(6)
    ]);

    // Bundle it into one clean JSON response
    res.status(200).json({
      stats: {
        totalStudents,
        activeModules,
        pendingTasks: pendingTasksCount,
        uptime: '99.9%' // Typically comes from a server monitoring tool, hardcoded for now
      },
      priorityTasks,
      atRiskStudents,
      recentActivity
    });

  } catch (error) {
    console.error('🔥 Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Server error loading dashboard' });
  }
};

module.exports = { getDashboardData };