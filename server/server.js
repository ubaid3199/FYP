require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./utils/dbConnect');

// Initialize Express
const app = express();

// Connect to Database
connectDB();

// Middleware
// This explicitly allows your frontend (usually port 5173 for Vite) to bypass security
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes')); // Your new Auth Guards!

// Routes for Students
app.use('/api/students', require('./routes/studentRoutes')); 

// Routes For Dashboard
app.use('/api/dashboard', require('./routes/dashboardRoutes')); 

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'MyUni API is running smoothly!' });
});

// Start the Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});