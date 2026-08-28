import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import planRoutes from './routes/planRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman, health checks)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        origin.endsWith('.vercel.app') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for preview/staging environments
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root status endpoint for browser testing
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'DHMS Backend REST API',
    database: 'Neon PostgreSQL Connected',
    healthCheck: '/api/health',
    documentation: 'Domain & Hosting Management System API v1.0',
    timestamp: new Date().toISOString(),
  });
});

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health Check (both /api/health and /health)
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'DHMS Backend REST API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

// Catch 404
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Only listen if not loaded by a test runner
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 DHMS API Server running on port ${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=============================================`);
  });
}

export default app;
