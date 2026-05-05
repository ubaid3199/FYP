const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env variables
dotenv.config();

// Import Models
const User = require('./models/User');
const Course = require('./models/Course');
const Task = require('./models/Task');
const ActivityLog = require('./models/ActivityLog');

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB...');

    console.log('🧹 Clearing old data...');
    await User.deleteMany();
    await Course.deleteMany();
    await Task.deleteMany();
    await ActivityLog.deleteMany();

    // 2. Create Admin (Raw password! User.js will hash it automatically)
    console.log('👤 Creating Admin...');
    await User.create({
      name: 'System Admin',
      email: 'admin@roehampton.ac.uk',
      password: 'Admin123!', 
      role: 'admin'
    });

    // 3. Create Students using a loop so the pre('save') hook fires for each one
    console.log('🎓 Creating Students...');
    const students = [
      { name: "Emma Thompson", email: "emma@roehampton.ac.uk", password: 'Student123!', role: 'student', enrollmentStatus: 'at-risk', lastActive: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { name: "James Wilson", email: "james@roehampton.ac.uk", password: 'Student123!', role: 'student', enrollmentStatus: 'at-risk', lastActive: new Date() },
      { name: "Sophia Patel", email: "sophia@roehampton.ac.uk", password: 'Student123!', role: 'student', enrollmentStatus: 'at-risk', lastActive: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { name: "Oliver Brown", email: "oliver@roehampton.ac.uk", password: 'Student123!', role: 'student', enrollmentStatus: 'at-risk', lastActive: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
    ];

    for (const student of students) {
      await User.create(student);
    }

    // 4. Create Active Courses
    console.log('📚 Creating Courses...');
    await Course.insertMany([
      { title: "Advanced Computing", code: "CS101", status: "active" },
      { title: "Data Structures", code: "CS201", status: "active" },
      { title: "Web Development", code: "CS301", status: "active" }
    ]);

    // 5. Create Priority Tasks
    console.log('⚠️ Creating Tasks...');
    await Task.insertMany([
      { title: "Assignments Pending", description: "5 submissions for Advanced Computing need grading.", urgency: "Due today", urgencyType: "critical", actionText: "Review", targetPath: "/admin/courses" },
      { title: "New Student Enrollments", description: "12 pending registrations await final approval.", urgency: "New", urgencyType: "info", actionText: "Approve", targetPath: "/admin/students" },
      { title: "Module Syllabus Update", description: "Dr. Smith submitted changes for the Autumn term.", urgency: "2 days ago", urgencyType: "neutral", actionText: "View", targetPath: "/admin/courses" }
    ]);

    // 6. Create Activity Logs
    console.log('📝 Creating Activity Logs...');
    await ActivityLog.insertMany([
      { type: "upload", description: "Web Dev assignment uploaded by Dr. Alan" },
      { type: "submission", description: "Sarah Jenkins submitted 'Final Essay'" },
      { type: "registration", description: "New student registration: ID 210499" },
      { type: "grading", description: "CS101 Midterms grades published" }
    ]);

    console.log('✅ Database Seeded Successfully!');
    process.exit(); 

  } catch (error) {
    console.error('🔥 Error Seeding Database:', error);
    process.exit(1);
  }
};

seedDatabase();