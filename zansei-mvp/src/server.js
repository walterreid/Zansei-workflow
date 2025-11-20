import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './models/database.js';
import { initializeAssistants } from './services/openai.service.js';
import conversationRoutes from './routes/conversation.routes.js';
import reportRoutes from './routes/report.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const DB_PATH = process.env.DATABASE_PATH || './data/zansei.db';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/generated_reports', express.static(path.join(__dirname, '../generated_reports')));

// Routes
app.use('/api/conversation', conversationRoutes);
app.use('/api/report', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database and assistants on startup
async function initialize() {
  try {
    console.log('Initializing Zansei MVP...');
    
    // Initialize database
    await initializeDatabase(DB_PATH);
    console.log('Database initialized');

    // Initialize OpenAI assistants
    await initializeAssistants();
    console.log('OpenAI assistants initialized');

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Zansei MVP Server running on http://localhost:${PORT}`);
      console.log(`📊 Database: ${DB_PATH}`);
      console.log(`🌐 Open http://localhost:${PORT} in your browser\n`);
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

// Start the application
initialize();

