const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const connectDB = require('./utils/dbConnect');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const studentRoutes = require('./routes/studentRoutes');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// 1. GLOBAL CORS CONFIGURATION
// Reflect the request origin so CORS stays valid with/without credentials.
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// 2. BODY PARSING MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentRoutes);

// 4. TEST HEALTH CHECK ROUTE
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Server is healthy and reachable!' });
});

// 5. STARTUP
connectDB().then(() => {
    // Bound strictly to 127.0.0.1 to avoid Windows localhost binding issues.
    app.listen(PORT, '127.0.0.1', () => {
        console.log(`===================================================`);
        console.log(`🚀 Server successfully running on Windows!`);
        console.log(`🔗 Local Link: http://127.0.0.1:${PORT}`);
        console.log(`===================================================`);
    });
});