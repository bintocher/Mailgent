import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import fs from 'fs';

// Load .env from CWD first, then from monorepo root as fallback
dotenv.config();
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') });
import { loadConfig } from './config';
import { GlobalDatabase } from './db/global-db';
import { ProjectDatabase } from './db/project-db';
import { AgentRepository } from './db/repositories/agent.repo';
import { GroupRepository } from './db/repositories/group.repo';
import { EmailRepository } from './db/repositories/email.repo';
import { ToolRepository } from './db/repositories/tool.repo';
import { SkillRepository } from './db/repositories/skill.repo';
import { MetricsRepository } from './db/repositories/metrics.repo';
import { SettingsRepository } from './db/repositories/settings.repo';
import { MailServer } from './mail/mail-server';
import { MailService } from './mail/mail-service';
import { MailStore } from './mail/mail-store';
import { MailQueue } from './mail/mail-queue';
import { LLMFactory } from './llm/llm-factory';
import { LLMRouter } from './llm/llm-router';
import { RateLimiter } from './llm/rate-limiter';
import { TokenTracker } from './llm/token-tracker';
import { ToolRegistry } from './tools/tool-registry';
import { ToolExecutor } from './tools/tool-executor';
import { SkillRegistry } from './skills/skill-registry';
import { SkillExecutor } from './skills/skill-executor';
import { AgentRegistry } from './agents/agent-registry';
import { AgentRunner } from './agents/agent-runner';
import { AgentManager } from './agents/agent-manager';
import { AgentSandbox } from './agents/agent-sandbox';
import { GroupManager } from './agents/group-manager';
import { TaskAggregator } from './agents/task-aggregator';
import { MetricsCollector } from './metrics/metrics-collector';
import { LLMPerformanceTracker } from './metrics/llm-performance';
import { UsageReporter } from './metrics/usage-reporter';
import { GitService } from './git/git-service';
import { eventBus } from './utils/event-bus';
import { logger, createChildLogger } from './utils/logger';
import { createApp } from './server/app';
import { WSServer } from './server/websocket/ws-server';
import { registerBuiltinTools } from './tools/builtin/index';

// Import route creators
import { createAgentRoutes } from './server/routes/agents';
import { createGroupRoutes } from './server/routes/groups';
import { createEmailRoutes } from './server/routes/emails';
import { createToolRoutes } from './server/routes/tools';
import { createSkillRoutes } from './server/routes/skills';
import { createSettingsRoutes } from './server/routes/settings';
import { createChatRoutes } from './server/routes/chat';
import { createMetricsRoutes } from './server/routes/metrics';
import { createSystemRoutes } from './server/routes/system';
import { createProviderRoutes } from './server/routes/providers';

const log = createChildLogger('main');

function syncBuiltinToolsToDb(toolRegistry: ToolRegistry, toolRepo: ToolRepository): void {
  const builtinTools = toolRegistry.getAll().filter(t => t.isBuiltin);
  const dbTools = toolRepo.findAll().filter(t => t.isBuiltin);
  const dbToolsByName = new Map(dbTools.map(t => [t.name, t]));

  for (const tool of builtinTools) {
    const existing = dbToolsByName.get(tool.name);
    if (existing) {
      // Update description/parameters but NOT isEnabled
      toolRepo.update(existing.id, {
        description: tool.description,
        category: tool.category,
        parameters: tool.parameters,
      });
      // Sync isEnabled from DB back to registry
      toolRegistry.updateEnabled(tool.name, existing.isEnabled);
    } else {
      // Insert new builtin tool
      toolRepo.create({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.parameters,
        isBuiltin: true,
        isEnabled: true,
      });
    }
  }

  // Remove DB builtin records that no longer exist in registry
  const registryNames = new Set(builtinTools.map(t => t.name));
  for (const dbTool of dbTools) {
    if (!registryNames.has(dbTool.name)) {
      toolRepo.delete(dbTool.id);
    }
  }
}

function syncBuiltinSkillsToDb(skillRepo: SkillRepository): void {
  const builtinSkills = [
    {
      name: 'Code Review',
      description: 'Review code changes using git diff and file reading tools',
      instructions: 'Analyze the current git diff and provide a thorough code review. Check for bugs, security issues, code style, and suggest improvements.',
      triggerPattern: 'code review|review code|review changes',
      requiredToolIds: ['builtin-git-diff', 'builtin-read-file', 'builtin-git-status'],
    },
    {
      name: 'Project Summary',
      description: 'Generate an overview of the project structure and key files',
      instructions: 'List the project files, read key configuration files (package.json, README, etc.), and provide a comprehensive summary of the project structure and purpose.',
      triggerPattern: 'project summary|summarize project|project overview',
      requiredToolIds: ['builtin-list-files', 'builtin-read-file', 'builtin-git-log'],
    },
    {
      name: 'Write & Commit',
      description: 'Write code to files and create a git commit',
      instructions: 'Read the relevant files, make the requested changes by writing to files, then stage and commit the changes with a descriptive commit message.',
      triggerPattern: 'write and commit|write.*commit|code and commit',
      requiredToolIds: ['builtin-read-file', 'builtin-write-file', 'builtin-git-commit'],
    },
    {
      name: 'Bug Investigation',
      description: 'Search for and diagnose bugs in the codebase',
      instructions: 'Search the codebase for relevant patterns, read suspicious files, check git history for recent changes, and provide a diagnosis of the bug with suggested fixes.',
      triggerPattern: 'find bug|investigate bug|debug|diagnose',
      requiredToolIds: ['builtin-search-files', 'builtin-read-file', 'builtin-git-log'],
    },
  ];

  const dbSkills = skillRepo.findAll().filter(s => s.isBuiltin);
  const dbSkillsByName = new Map(dbSkills.map(s => [s.name, s]));

  for (const skill of builtinSkills) {
    const existing = dbSkillsByName.get(skill.name);
    if (existing) {
      // Update description/instructions but NOT isEnabled
      skillRepo.update(existing.id, {
        description: skill.description,
        instructions: skill.instructions,
        triggerPattern: skill.triggerPattern,
        requiredToolIds: skill.requiredToolIds,
      });
    } else {
      skillRepo.create({
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        triggerPattern: skill.triggerPattern,
        requiredToolIds: skill.requiredToolIds,
        isBuiltin: true,
        isEnabled: true,
      });
    }
  }

  // Remove DB builtin records that no longer exist
  const skillNames = new Set(builtinSkills.map(s => s.name));
  for (const dbSkill of dbSkills) {
    if (!skillNames.has(dbSkill.name)) {
      skillRepo.delete(dbSkill.id);
    }
  }
}

function parseWorkDirArg(): string | undefined {
  // --workdir=/path/to/dir
  const eqArg = process.argv.find(a => a.startsWith('--workdir='));
  if (eqArg) return eqArg.split('=').slice(1).join('=');

  // --workdir /path/to/dir
  const idx = process.argv.indexOf('--workdir');
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];

  return undefined;
}

// Mutable project state — allows switching workDir at runtime
let currentProjectDb: ProjectDatabase | null = null;
let currentWorkDir: string = '';

async function main() {
  const workDirArg = parseWorkDirArg();

  // 1. Load config
  const config = loadConfig(workDirArg);
  currentWorkDir = config.workDir;
  log.info({ config: { ...config, globalDbPath: config.globalDbPath, projectDbPath: config.projectDbPath } }, 'Config loaded');

  // 2. Initialize global database (always in ~/.mailgent/)
  const globalDb = new GlobalDatabase(config.globalDbPath);

  // Check if there's a saved lastWorkDir in global settings (only if no CLI arg and no env)
  if (!currentWorkDir) {
    const globalSettingsRepoEarly = new SettingsRepository(globalDb.getDb(), 'global_settings');
    const savedWorkDir = globalSettingsRepoEarly.get<string>('lastWorkDir');
    if (savedWorkDir && typeof savedWorkDir === 'string' && fs.existsSync(savedWorkDir)) {
      currentWorkDir = savedWorkDir;
      config.workDir = savedWorkDir;
      config.projectDbPath = path.join(savedWorkDir, '.mailgent', 'project.db');
      log.info({ workDir: savedWorkDir }, 'Restored last working directory from global settings');
    }
  }

  // 3. Initialize project database — only if workDir is set
  //    If no workDir yet (user hasn't picked a folder), create a temporary in-memory-like placeholder.
  //    The real project DB will be created on switchProject().
  let projectDb: ProjectDatabase | null = null;
  if (currentWorkDir) {
    if (!fs.existsSync(currentWorkDir)) {
      fs.mkdirSync(currentWorkDir, { recursive: true });
    }
    projectDb = new ProjectDatabase(config.projectDbPath);
    currentProjectDb = projectDb;
  }

  // Use a temporary in-memory SQLite for repos until a project is opened
  // This avoids creating files in wrong locations
  const tempDbPath = path.join(config.mailgentHome, '_temp_project.db');
  const effectiveProjectDb = projectDb || new ProjectDatabase(tempDbPath);

  // 4. Initialize repositories
  const agentRepo = new AgentRepository(effectiveProjectDb.getDb());
  const groupRepo = new GroupRepository(effectiveProjectDb.getDb());
  const emailRepo = new EmailRepository(effectiveProjectDb.getDb());
  const toolRepo = new ToolRepository(effectiveProjectDb.getDb());
  const skillRepo = new SkillRepository(effectiveProjectDb.getDb());
  const metricsRepo = new MetricsRepository(globalDb.getDb());
  const globalSettingsRepo = new SettingsRepository(globalDb.getDb(), 'global_settings');
  const projectSettingsRepo = new SettingsRepository(effectiveProjectDb.getDb(), 'project_settings');

  // Save current workDir as lastWorkDir (only if it's real)
  if (currentWorkDir) {
    globalSettingsRepo.set('lastWorkDir', currentWorkDir);
  }

  // 4. Initialize LLM providers
  const llmFactory = new LLMFactory();
  const rateLimiter = new RateLimiter();
  const llmRouter = new LLMRouter(llmFactory, rateLimiter);
  const tokenTracker = new TokenTracker(eventBus);

  // Load providers from global DB
  const providerRows = globalDb.getDb().prepare('SELECT * FROM llm_providers WHERE is_enabled = 1').all() as any[];
  for (const row of providerRows) {
    const modelRows = globalDb.getDb().prepare('SELECT * FROM llm_models WHERE provider_id = ? AND is_enabled = 1').all(row.id) as any[];
    const providerConfig = {
      id: row.id,
      name: row.name,
      type: row.type,
      apiKey: row.api_key,
      baseUrl: row.base_url,
      isEnabled: true,
      models: modelRows.map((m: any) => ({
        id: m.id,
        displayName: m.display_name,
        providerId: m.provider_id,
        contextWindow: m.context_window,
        costPerInputToken: m.cost_per_input_token,
        costPerOutputToken: m.cost_per_output_token,
        capabilities: JSON.parse(m.capabilities || '[]'),
        isEnabled: true,
      })),
      rateLimits: {
        requestsPerMinute: row.rate_limit_rpm,
        tokensPerMinute: row.rate_limit_tpm,
      },
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    llmFactory.createProvider(providerConfig);
    rateLimiter.configure(
      `${row.id}:*`,
      row.rate_limit_rpm,
      row.rate_limit_tpm,
    );

    for (const model of providerConfig.models) {
      tokenTracker.registerModel(model);
      rateLimiter.configure(`${row.id}:${model.id}`, row.rate_limit_rpm, row.rate_limit_tpm);
    }
  }

  // Load routing rules
  const ruleRows = globalDb.getDb().prepare('SELECT * FROM llm_routing_rules WHERE is_enabled = 1').all() as any[];
  llmRouter.setRules(ruleRows.map((r: any) => ({
    id: r.id,
    name: r.name,
    taskType: r.task_type,
    preferredModelId: r.preferred_model_id,
    preferredProviderId: r.preferred_provider_id,
    fallbackModelId: r.fallback_model_id,
    fallbackProviderId: r.fallback_provider_id,
    maxCostPerCall: r.max_cost_per_call,
    priority: r.priority,
    isEnabled: true,
  })));

  // 5. Initialize tool/skill registries
  const toolRegistry = new ToolRegistry();
  const sandbox = new AgentSandbox(config.workDir);
  const mailService = new MailService(config.smtpPort, config.host);
  const gitService = new GitService(config.workDir);

  const toolExecutor = new ToolExecutor(toolRegistry, eventBus);
  const skillRegistry = new SkillRegistry();
  const skillExecutor = new SkillExecutor(skillRegistry, toolExecutor);

  registerBuiltinTools(toolRegistry, sandbox, mailService, eventBus);
  syncBuiltinToolsToDb(toolRegistry, toolRepo);
  syncBuiltinSkillsToDb(skillRepo);

  // 6. Start SMTP server
  const mailServer = new MailServer(config.smtpPort, eventBus);
  await mailServer.start();

  // 7. Initialize mail processing
  let projectId = currentWorkDir ? path.basename(currentWorkDir) : 'default';
  const mailStore = new MailStore(emailRepo, projectId);
  const mailQueue = new MailQueue(eventBus);

  eventBus.on('email:received', (emailData: any) => {
    const email = mailStore.store(emailData);
    eventBus.emit('email:new', { email });
    eventBus.emit('email:stored', email);
    mailQueue.enqueue(email, emailData.priority || 0);
  });

  // 8. Initialize Git (only if workDir is set)
  if (currentWorkDir) {
    try {
      await gitService.init();
    } catch (err) {
      log.warn({ error: err }, 'Git initialization skipped');
    }
  }

  // 9. Initialize agent system
  const agentRegistry = new AgentRegistry(eventBus);
  const agentRunner = new AgentRunner(llmRouter, tokenTracker, toolExecutor, toolRegistry, agentRegistry, eventBus);
  const groupManager = new GroupManager(groupRepo, agentRepo, eventBus);
  let agentManager = new AgentManager(
    agentRepo, emailRepo, agentRegistry, agentRunner, groupManager,
    mailService, eventBus, projectId,
  );

  const taskAggregator = new TaskAggregator();

  // Initialize system agents
  const defaultModel = projectSettingsRepo.get('defaultModelId') as string | undefined;
  const defaultProvider = projectSettingsRepo.get('defaultProviderId') as string | undefined;
  await agentManager.initializeSystemAgents(
    defaultModel || undefined,
    defaultProvider || undefined,
  );

  // 10. Set up mail queue processor
  mailQueue.setProcessor(async (item) => {
    await agentManager.routeEmail(item.email);
  });
  mailQueue.start();

  // 11. Initialize metrics
  const metricsCollector = new MetricsCollector(metricsRepo, eventBus);
  const llmPerformance = new LLMPerformanceTracker(metricsRepo);
  const usageReporter = new UsageReporter(metricsRepo);

  // ---------------------------------------------------------------------------
  // Update system agents when default model/provider changes
  // ---------------------------------------------------------------------------
  eventBus.on('settings:defaults-changed', (data: { defaultProviderId?: string; defaultModelId?: string }) => {
    const { defaultProviderId, defaultModelId } = data;
    if (!defaultProviderId || !defaultModelId) return;

    log.info({ defaultProviderId, defaultModelId }, 'Updating system agents with new defaults');

    for (const entry of agentRegistry.getAll()) {
      if (entry.agent.type === 'system') {
        entry.agent.providerId = defaultProviderId;
        entry.agent.modelId = defaultModelId;
        agentRepo.update(entry.agent.id, { providerId: defaultProviderId, modelId: defaultModelId });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // switchProject — hot-swap the project context at runtime
  // ---------------------------------------------------------------------------
  async function switchProject(newWorkDir: string): Promise<void> {
    log.info({ from: currentWorkDir, to: newWorkDir }, 'Switching project');

    // 1. Stop running agents and mail queue
    agentManager.stopAll();
    mailQueue.stop();

    // 2. Close old project database (or temp DB if first switch)
    if (currentProjectDb) {
      currentProjectDb.close();
    } else {
      // Close temp DB that repos were using
      try { effectiveProjectDb.close(); } catch { /* ignore */ }
      // Remove temp DB file
      try { fs.unlinkSync(tempDbPath); } catch { /* ignore */ }
      try { fs.unlinkSync(tempDbPath + '-wal'); } catch { /* ignore */ }
      try { fs.unlinkSync(tempDbPath + '-shm'); } catch { /* ignore */ }
    }

    // 3. Open new project database
    const newProjectDbPath = path.join(newWorkDir, '.mailgent', 'project.db');
    const newProjectDb = new ProjectDatabase(newProjectDbPath);
    currentProjectDb = newProjectDb;
    currentWorkDir = newWorkDir;

    // 4. Swap DB in all project-level repositories
    const newDb = newProjectDb.getDb();
    agentRepo.swapDb(newDb);
    groupRepo.swapDb(newDb);
    emailRepo.swapDb(newDb);
    toolRepo.swapDb(newDb);
    skillRepo.swapDb(newDb);
    projectSettingsRepo.swapDb(newDb);

    // 4a. Update sandbox working directory for tools
    sandbox.setWorkDir(newWorkDir);
    gitService.setWorkDir(newWorkDir);

    // 4b. Sync builtin tools/skills to new project DB
    syncBuiltinToolsToDb(toolRegistry, toolRepo);
    syncBuiltinSkillsToDb(skillRepo);

    // 5. Update projectId
    projectId = path.basename(newWorkDir);

    // 6. Clear agent registry and reinitialize
    agentRegistry.stopAll();
    agentManager = new AgentManager(
      agentRepo, emailRepo, agentRegistry, agentRunner, groupManager,
      mailService, eventBus, projectId,
    );

    const newDefaultModel = projectSettingsRepo.get('defaultModelId') as string | undefined;
    const newDefaultProvider = projectSettingsRepo.get('defaultProviderId') as string | undefined;
    await agentManager.initializeSystemAgents(
      newDefaultModel || undefined,
      newDefaultProvider || undefined,
    );

    // 7. Restart mail queue
    mailQueue.setProcessor(async (item) => {
      await agentManager.routeEmail(item.email);
    });
    mailQueue.start();

    // 8. Save last workDir in global settings
    globalSettingsRepo.set('lastWorkDir', newWorkDir);

    log.info({ workDir: newWorkDir, projectId }, 'Project switched successfully');
    eventBus.emit('project:switched', { workDir: newWorkDir, projectId });
  }

  // 12. Create Express app with routes
  const routes = {
    '/agents': createAgentRoutes({ agentManager, agentRepo }),
    '/groups': createGroupRoutes({ groupManager, groupRepo }),
    '/emails': createEmailRoutes({ emailRepo }),
    '/tools': createToolRoutes({ toolRepo, toolRegistry }),
    '/skills': createSkillRoutes({ skillRepo, skillRegistry }),
    '/settings': createSettingsRoutes({ globalSettingsRepo, projectSettingsRepo, globalDb: globalDb.getDb(), eventBus }),
    '/providers': createProviderRoutes({ globalDb: globalDb.getDb(), llmFactory, rateLimiter, tokenTracker }),
    '/chat': createChatRoutes({ getProjectDb: () => currentProjectDb }),
    '/metrics': createMetricsRoutes({ metricsRepo, usageReporter, mailQueue }),
    '': createSystemRoutes({
      agentRegistry,
      agentManager,
      mailQueue,
      mailServer,
      getWorkDir: () => currentWorkDir,
      switchProject,
    }),
  };

  const staticPath = config.nodeEnv === 'production'
    ? path.resolve(import.meta.dirname, '../../frontend/dist')
    : undefined;

  const app = createApp(routes, staticPath);

  // 13. Start HTTP + WebSocket server
  const server = http.createServer(app);
  const wsServer = new WSServer(server, eventBus, {
    agentManager,
    agentRunner,
    agentRegistry,
    mailQueue,
  });

  // Track the last chat session ID so Master can push email results to chat
  let lastChatSessionId: string = '';

  // Handle chat messages from WebSocket
  eventBus.on('chat:send', async (data: { sessionId?: string; content: string; ws: any }) => {
    const masterAgent = agentRegistry.getByEmail('master@company.local');
    if (!masterAgent) {
      eventBus.emit('chat:error', { sessionId: data.sessionId || '', error: 'Master agent not available' });
      return;
    }

    const sessionId = data.sessionId || `session-${Date.now()}`;
    lastChatSessionId = sessionId;
    const { v4: uuid } = await import('uuid');

    // Save user message (only if project DB is available)
    const chatDb = currentProjectDb || (currentWorkDir ? null : effectiveProjectDb);
    if (chatDb) {
      try {
        chatDb.getDb().prepare(`
          INSERT OR IGNORE INTO chat_sessions (id, title, project_id)
          VALUES (?, ?, ?)
        `).run(sessionId, data.content.slice(0, 100), projectId);

        chatDb.getDb().prepare(`
          INSERT INTO chat_messages (id, session_id, role, content)
          VALUES (?, ?, 'user', ?)
        `).run(uuid(), sessionId, data.content);
      } catch { /* ignore if session exists */ }
    }

    // Run agentic chat with tools
    try {
      const agentId = masterAgent.agent.id;
      // Master only gets communication + orchestration tools — delegates work via email
      const response = await agentRunner.runAgenticChat(
        masterAgent.agent,
        [
          { role: 'system', content: masterAgent.agent.systemPrompt },
          { role: 'user', content: data.content },
        ],
        {
          onChunk: (chunk) => {
            eventBus.emit('chat:chunk', { sessionId, content: chunk, agentId });
          },
          onThinking: (content, iteration) => {
            eventBus.emit('chat:thinking', { sessionId, content, agentId, iteration });
          },
          onToolCall: (toolName, toolArgs, toolCallId, iteration) => {
            eventBus.emit('chat:tool_call', { sessionId, toolName, toolArgs, toolCallId, agentId, iteration });
          },
          onToolResult: (toolName, toolCallId, success, result, durationMs, iteration) => {
            eventBus.emit('chat:tool_result', { sessionId, toolName, toolCallId, success, result, durationMs, agentId, iteration });
          },
        },
        ['communication', 'orchestration'],
      );

      // Save assistant message (only if project DB is available)
      const msgId = uuid();
      const saveDb = currentProjectDb || (currentWorkDir ? null : effectiveProjectDb);
      if (saveDb) {
        try {
          saveDb.getDb().prepare(`
            INSERT INTO chat_messages (id, session_id, role, content, agent_id)
            VALUES (?, ?, 'assistant', ?, ?)
          `).run(msgId, sessionId, response, agentId);
        } catch { /* ignore */ }
      }

      eventBus.emit('chat:message', {
        sessionId,
        message: {
          id: msgId,
          sessionId,
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
          agentId,
        },
      });
      eventBus.emit('chat:done', { sessionId });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      eventBus.emit('chat:error', { sessionId, error });
    }
  });

  // When Master processes an email result from another agent, push it to chat
  eventBus.on('master:email_result', async (data: { agentId: string; content: string; emailId: string; subject: string }) => {
    const sessionId = lastChatSessionId || `session-${Date.now()}`;
    const { v4: uuid } = await import('uuid');
    const msgId = uuid();

    // Save to DB
    const saveDb = currentProjectDb || (currentWorkDir ? null : effectiveProjectDb);
    if (saveDb) {
      try {
        // Ensure session exists
        saveDb.getDb().prepare(`
          INSERT OR IGNORE INTO chat_sessions (id, title, project_id)
          VALUES (?, ?, ?)
        `).run(sessionId, 'Chat', projectId);

        saveDb.getDb().prepare(`
          INSERT INTO chat_messages (id, session_id, role, content, agent_id)
          VALUES (?, ?, 'assistant', ?, ?)
        `).run(msgId, sessionId, data.content, data.agentId);
      } catch { /* ignore */ }
    }

    // Use chat:agent_message to directly add to chatMessages without
    // interfering with the pending/finalize streaming flow
    eventBus.emit('chat:agent_message', {
      sessionId,
      message: {
        id: msgId,
        sessionId,
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString(),
        agentId: data.agentId,
      },
    });
    log.info({ sessionId, subject: data.subject }, 'Master email result pushed to chat');
  });

  server.listen(config.port, config.host, () => {
    log.info({
      port: config.port,
      host: config.host,
      smtpPort: config.smtpPort,
      workDir: currentWorkDir,
    }, 'Mailgent server started');
    console.log(`\n🏢 Mailgent Virtual Company is running!`);
    console.log(`   Web UI: http://${config.host}:${config.port}`);
    console.log(`   SMTP:   ${config.host}:${config.smtpPort}`);
    console.log(`   Work:   ${currentWorkDir}\n`);
  });

  // 14. Graceful shutdown
  const shutdown = async () => {
    log.info('Shutting down...');
    agentManager.stopAll();
    mailQueue.stop();
    await mailServer.stop();
    wsServer.close();
    server.close();
    globalDb.close();
    if (currentProjectDb) {
      currentProjectDb.close();
    } else {
      try { effectiveProjectDb.close(); } catch { /* ignore */ }
      // Clean up temp DB files
      try { fs.unlinkSync(tempDbPath); } catch { /* ignore */ }
      try { fs.unlinkSync(tempDbPath + '-wal'); } catch { /* ignore */ }
      try { fs.unlinkSync(tempDbPath + '-shm'); } catch { /* ignore */ }
    }
    log.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ error: err }, 'Fatal error');
  process.exit(1);
});
