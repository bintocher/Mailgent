import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import type { SystemStatus } from '@mailgent/shared';
import type { AgentRegistry } from '../../agents/agent-registry';
import type { AgentManager } from '../../agents/agent-manager';
import type { MailQueue } from '../../mail/mail-queue';
import type { MailServer } from '../../mail/mail-server';

interface SystemRoutesDeps {
  agentRegistry: AgentRegistry;
  agentManager: AgentManager;
  mailQueue: MailQueue;
  mailServer: MailServer;
  getWorkDir: () => string;
  switchProject: (newWorkDir: string) => Promise<void>;
}

const startTime = Date.now();

export function createSystemRoutes(deps: SystemRoutesDeps): Router {
  const router = Router();
  const { agentRegistry, agentManager, mailQueue, mailServer, getWorkDir, switchProject } = deps;

  // GET /health - Simple health check
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // GET /system/status - Detailed system status
  router.get('/system/status', (_req, res) => {
    try {
      const allAgents = agentRegistry.getAll();
      const activeAgents = agentRegistry.getActiveCount();
      const queueStats = mailQueue.getStats();
      const memUsage = process.memoryUsage();

      const status: SystemStatus = {
        uptime: Math.floor((Date.now() - startTime) / 1000),
        activeAgents,
        totalAgents: allAgents.length,
        queueSize: queueStats.totalItems,
        queuePaused: mailQueue.getIsPaused(),
        smtpRunning: mailServer.getStatus(),
        connectedClients: 0,
        memoryUsageMb: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        workDir: getWorkDir(),
      };

      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /system/browse - List directories for folder picker
  router.get('/system/browse', (req, res) => {
    try {
      const requestedPath = (req.query.path as string) || '/';
      const resolved = path.resolve(requestedPath);

      if (!fs.existsSync(resolved)) {
        res.status(404).json({ error: 'Path not found' });
        return;
      }

      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        res.status(400).json({ error: 'Path is not a directory' });
        return;
      }

      const entries: Array<{ name: string; path: string; isDirectory: boolean }> = [];
      try {
        const items = fs.readdirSync(resolved, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith('.')) continue; // skip hidden
          if (item.isDirectory()) {
            entries.push({
              name: item.name,
              path: path.join(resolved, item.name),
              isDirectory: true,
            });
          }
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
      } catch {
        // permission denied — return empty
      }

      res.json({
        path: resolved,
        parent: path.dirname(resolved),
        entries,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /system/freeze - Pause queue processing (running tasks finish, no new ones start)
  router.post('/system/freeze', (_req, res) => {
    try {
      mailQueue.pause();
      res.json({ status: 'frozen', paused: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /system/resume - Resume queue processing
  router.post('/system/resume', (_req, res) => {
    try {
      mailQueue.resume();
      res.json({ status: 'running', paused: false });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /system/stop-all - Stop all agents and clear the queue
  router.post('/system/stop-all', (_req, res) => {
    try {
      agentManager.stopAll();
      mailQueue.clear();
      res.json({ status: 'stopped', agentsStopped: true, queueCleared: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /project/open - Switch to a different working directory
  router.post('/project/open', async (req, res) => {
    try {
      const { workDir } = req.body;
      if (!workDir || typeof workDir !== 'string') {
        res.status(400).json({ error: 'workDir is required and must be a string' });
        return;
      }

      const resolved = path.resolve(workDir);

      // Validate path exists or can be created
      if (!fs.existsSync(resolved)) {
        try {
          fs.mkdirSync(resolved, { recursive: true });
        } catch (err) {
          res.status(400).json({ error: `Cannot create directory: ${resolved}` });
          return;
        }
      }

      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        res.status(400).json({ error: `Path is not a directory: ${resolved}` });
        return;
      }

      await switchProject(resolved);

      res.json({ workDir: resolved, status: 'switched' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
