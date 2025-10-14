import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Prisma Client
const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      message: 'Server and database are running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Simple connection test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is connected!',
    timestamp: new Date().toISOString(),
    frontend: 'You can reach me!'
  });
});

// Test endpoint to create a sample customer for testing duplicates
app.post('/api/test-customer', async (req, res) => {
  try {
    const sampleCustomer = await prisma.customer.create({
      data: {
        name: "Test Customer",
        phone: "+92 99999 99999",
        whatsapp: "+92 99999 99999",
        bottleCount: 2,
        city: "Test City"
      }
    });
    
    res.json({
      success: true,
      message: 'Test customer created successfully',
      data: sampleCustomer
    });
  } catch (error) {
    console.log('Test customer creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test customer',
      error: error.message
    });
  }
});

// Test endpoint to directly test duplicate error
app.post('/api/test-duplicate', async (req, res) => {
  try {
    // Try to create a customer with the same phone twice
    const customer1 = await prisma.customer.create({
      data: {
        name: "First Customer",
        phone: "+92 88888 88888",
        bottleCount: 1
      }
    });
    
    // This should fail
    const customer2 = await prisma.customer.create({
      data: {
        name: "Second Customer", 
        phone: "+92 88888 88888", // Same phone - should fail
        bottleCount: 1
      }
    });
    
    res.json({
      success: true,
      message: 'Both customers created (this should not happen)',
      data: [customer1, customer2]
    });
  } catch (error) {
    console.log('Duplicate test error:', error);
    console.log('Error code:', error.code);
    
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Client with this phone number already exists',
        error: 'DUPLICATE_ENTRY',
        details: {
          field: 'phone',
          value: '+92 88888 88888'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

// API routes
import apiRoutes from './routes/index.js';
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SmartSupply API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SmartSupply Backend Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

export default app;

