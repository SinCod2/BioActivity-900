import serverless from 'serverless-http';
import 'dotenv/config';
import express from 'express';
import { registerRoutes } from '../server/routes.js';

const app = express();
app.set('etag', false);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Register API routes
registerRoutes(app);

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ message });
});

export const handler = serverless(app);
