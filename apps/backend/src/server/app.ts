import express from 'express';
import cors from 'cors';
import path from 'path';
import { API_PREFIX } from '@mailgent/shared';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('app');

export function createApp(routes: Record<string, express.Router>, serveStatic?: string): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      log.debug({
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: Date.now() - start,
      }, 'HTTP request');
    });
    next();
  });

  // API routes
  for (const [routePath, router] of Object.entries(routes)) {
    app.use(`${API_PREFIX}${routePath}`, router);
  }

  // Serve frontend static files in production
  if (serveStatic) {
    app.use(express.static(serveStatic));
    app.get('*', (req, res) => {
      if (!req.path.startsWith(API_PREFIX)) {
        res.sendFile(path.join(serveStatic, 'index.html'));
      }
    });
  }

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.error({ error: err.message, stack: err.stack }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
