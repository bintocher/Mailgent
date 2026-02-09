import { v4 as uuid } from 'uuid';
import type { Agent, AgentCreateParams, Email } from '@mailgent/shared';
import { SYSTEM_AGENTS, LIMITS } from '@mailgent/shared';
import type { AgentRepository } from '../db/repositories/agent.repo';
import type { EmailRepository } from '../db/repositories/email.repo';
import type { AgentRegistry } from './agent-registry';
import type { AgentRunner } from './agent-runner';
import type { GroupManager } from './group-manager';
import type { MailService } from '../mail/mail-service';
import type { SafetyFilter } from '../mail/safety-filter';
import type { SettingsRepository } from '../db/repositories/settings.repo';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('agent-manager');

export class AgentManager {
  private defaultModelId?: string;
  private defaultProviderId?: string;

  constructor(
    private agentRepo: AgentRepository,
    private emailRepo: EmailRepository,
    private agentRegistry: AgentRegistry,
    private agentRunner: AgentRunner,
    private groupManager: GroupManager,
    private mailService: MailService,
    private eventBus: EventBus,
    private projectId: string,
    private safetyFilter?: SafetyFilter,
    private projectSettingsRepo?: SettingsRepository,
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // NOTE: email:stored is NOT handled here — MailQueue is the sole routing path
    // to avoid double-processing of every email.

    // create_sub_agent tool emits this event; we respond with agent:create-response
    this.eventBus.on('agent:create-request', async (params: Record<string, unknown>) => {
      try {
        const email = (params.email as string) ||
          `${(params.name as string).toLowerCase().replace(/\s+/g, '-')}@company.local`;
        const createParams: AgentCreateParams = {
          name: params.name as string,
          email,
          type: (params.type as AgentCreateParams['type']) || 'worker',
          systemPrompt: params.systemPrompt as string,
          description: params.description as string,
          parentAgentId: params.parentAgentId as string | undefined,
          modelId: (params.modelId as string) || this.defaultModelId,
          providerId: (params.providerId as string) || this.defaultProviderId,
          toolIds: (params.toolIds as string[]) || [],
          groupId: params.groupId as string | undefined,
        };
        const agent = await this.createAgent(createParams);
        if (params.requestId) {
          this.eventBus.emit(`agent:create-response:${params.requestId}`, { agent });
        }
      } catch (err) {
        log.error({ error: err }, 'Failed to create agent');
        if (params.requestId) {
          this.eventBus.emit(`agent:create-response:${params.requestId}`, { error: String(err) });
        }
      }
    });

    // stop_agent tool emits 'agent:stop-request' (dash)
    this.eventBus.on('agent:stop-request', (data: Record<string, unknown>) => {
      this.stopAgent((data.targetAgentId || data) as string);
    });

    // WS handler emits 'agent:stop_request' (underscore) — keep for backward compat
    this.eventBus.on('agent:stop_request', (agentId: string) => {
      this.stopAgent(agentId);
    });

    // list_agents tool uses request/response pattern
    this.eventBus.on('agent:list-request', (data: Record<string, unknown>) => {
      const agents = this.getAllAgents();
      let filtered = agents;
      if (data.filterStatus) {
        filtered = filtered.filter(a => a.status === data.filterStatus);
      }
      if (data.filterGroupId) {
        filtered = filtered.filter(a => a.groupId === data.filterGroupId);
      }
      this.eventBus.emit(`agent:list-response:${data.requestId}`, filtered);
    });

    // query_agent tool uses request/response pattern
    this.eventBus.on('agent:query-request', (data: Record<string, unknown>) => {
      const agent = this.getAgent(data.targetAgentId as string);
      this.eventBus.emit(`agent:query-response:${data.requestId}`, agent || null);
    });
  }

  async createAgent(params: AgentCreateParams): Promise<Agent> {
    // Check if agent with this email or name already exists — prevent duplicates
    const existing = this.agentRepo.findByEmail(params.email)
      || this.agentRepo.findByName(params.name);

    if (!existing) {
      // Enforce MAX_SUB_AGENTS limit (only for new non-system agents)
      if (params.type !== 'system') {
        const allAgents = this.agentRepo.findAll();
        const nonSystemCount = allAgents.filter(a => a.type !== 'system').length;
        if (nonSystemCount >= LIMITS.MAX_SUB_AGENTS) {
          throw new Error(
            `Cannot create agent "${params.name}": maximum number of sub-agents reached (${LIMITS.MAX_SUB_AGENTS}). ` +
            `Use list_agents to find existing agents and reuse them instead of creating new ones.`
          );
        }
      }
    }

    if (existing) {
      // Update existing agent with new params and re-register in memory
      const updated = this.agentRepo.update(existing.id, {
        systemPrompt: params.systemPrompt,
        description: params.description,
        modelId: params.modelId || this.defaultModelId,
        providerId: params.providerId || this.defaultProviderId,
        toolIds: params.toolIds,
        groupId: params.groupId,
        parentAgentId: params.parentAgentId,
        status: 'idle',
      });
      if (updated) {
        this.agentRegistry.register(updated);
        log.info({ id: updated.id, name: updated.name, email: updated.email }, 'Agent reactivated (already existed in DB)');
        return updated;
      }
    }

    const created = this.agentRepo.create({
      ...params,
      projectId: this.projectId,
    });
    this.agentRegistry.register(created);
    log.info({ id: created.id, name: created.name, email: created.email }, 'Agent created');
    return created;
  }

  async initializeSystemAgents(defaultModelId?: string, defaultProviderId?: string): Promise<void> {
    this.defaultModelId = defaultModelId;
    this.defaultProviderId = defaultProviderId;
    const existing = this.agentRepo.findAll();

    for (const [key, config] of Object.entries(SYSTEM_AGENTS)) {
      const exists = existing.find(a => a.email === config.email);
      if (exists) {
        // Always update system prompt to latest version
        const latestPrompt = this.getSystemAgentPrompt(key);
        if (exists.systemPrompt !== latestPrompt) {
          exists.systemPrompt = latestPrompt;
          this.agentRepo.update(exists.id, { systemPrompt: latestPrompt });
          log.info({ name: exists.name }, 'Updated system agent prompt');
        }
        // Update system agents with defaults if they have no provider/model configured
        if (defaultProviderId && defaultModelId && (!exists.providerId || !exists.modelId)) {
          exists.providerId = defaultProviderId;
          exists.modelId = defaultModelId;
          this.agentRepo.update(exists.id, { providerId: defaultProviderId, modelId: defaultModelId });
          log.info({ name: exists.name, providerId: defaultProviderId, modelId: defaultModelId }, 'Updated system agent with default provider/model');
        }
        this.agentRegistry.register(exists);
        continue;
      }

      const prompt = this.getSystemAgentPrompt(key);
      await this.createAgent({
        name: config.name,
        email: config.email,
        type: 'system',
        systemPrompt: prompt,
        description: `System agent: ${config.name}`,
        modelId: defaultModelId,
        providerId: defaultProviderId,
      });
    }

    // Deduplicate worker agents by name — keep most recent, delete older duplicates
    const allAgents = this.agentRepo.findAll();
    const workersByName = new Map<string, Agent[]>();
    for (const agent of allAgents) {
      if (agent.type === 'system') continue;
      const group = workersByName.get(agent.name) || [];
      group.push(agent);
      workersByName.set(agent.name, group);
    }
    for (const [, agents] of workersByName) {
      if (agents.length <= 1) continue;
      agents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const [, ...duplicates] = agents;
      for (const dup of duplicates) {
        this.agentRepo.delete(dup.id);
        log.info({ id: dup.id, name: dup.name, email: dup.email }, 'Deleted duplicate worker agent');
      }
    }

    // Load ALL non-system agents from DB into registry
    // so list_agents shows them and they can receive emails after restart
    const cleanedAgents = this.agentRepo.findAll();
    for (const agent of cleanedAgents) {
      if (agent.type === 'system') continue; // already handled above
      if (this.agentRegistry.get(agent.id)) continue; // already registered
      agent.status = 'idle';
      this.agentRepo.updateStatus(agent.id, 'idle');
      this.agentRegistry.register(agent);
      log.info({ id: agent.id, name: agent.name, email: agent.email }, 'Loaded worker agent from DB');
    }

    log.info('All agents initialized');
  }

  async routeEmail(email: Email): Promise<void> {
    // Guard: check thread depth to prevent infinite agent-to-agent recursion
    const threadDepth = this.emailRepo.countByThreadId(email.threadId);
    if (threadDepth > LIMITS.MAX_THREAD_DEPTH) {
      log.warn(
        { threadId: email.threadId, depth: threadDepth, subject: email.subject },
        'Thread depth exceeded MAX_THREAD_DEPTH — stopping processing to prevent recursion',
      );
      this.eventBus.emit('agent:log', {
        log: {
          id: uuid(),
          agentId: 'system',
          type: 'error' as const,
          content: `Thread "${email.subject}" exceeded max depth (${threadDepth}/${LIMITS.MAX_THREAD_DEPTH}). Processing stopped.`,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Safety filter check
    if (this.safetyFilter) {
      const result = this.safetyFilter.check(email);
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          this.eventBus.emit('agent:log', {
            log: {
              id: uuid(),
              agentId: 'system',
              type: 'error' as const,
              content: `[Safety] ${warning.severity.toUpperCase()}: ${warning.message}`,
              timestamp: new Date().toISOString(),
            },
          });
        }
        // Currently non-blocking — log only. Uncomment to block high-severity:
        // if (!result.passed) return;
      }
    }

    // Check if addressed to a group
    for (const to of email.to) {
      const group = this.groupManager.getGroupByEmail(to);
      if (group && group.leadAgentId) {
        const lead = this.agentRegistry.get(group.leadAgentId);
        if (lead) {
          log.info({ group: group.name, lead: lead.agent.name }, 'Routing to group lead');
          await this.processEmail(lead.agent, email);
          return;
        }
      }

      // Check if addressed to a specific agent
      const agent = this.agentRegistry.getByEmail(to);
      if (agent) {
        log.info({ agent: agent.agent.name }, 'Routing to agent');
        await this.processEmail(agent.agent, email);
        return;
      }
    }

    // If sender is a registered agent and recipient is unknown — drop the email
    // to prevent the Dispatcher loop (Dispatcher sends to non-existent agent →
    // falls back to Dispatcher → sends again → infinite loop)
    const senderAgent = this.agentRegistry.getByEmail(email.from);
    if (senderAgent) {
      log.warn(
        { from: email.from, to: email.to, subject: email.subject },
        'Email from agent to unknown recipient — dropped (no matching agent)',
      );
      this.eventBus.emit('agent:log', {
        log: {
          id: uuid(),
          agentId: senderAgent.agent.id,
          type: 'error' as const,
          content: `Email to ${email.to.join(', ')} could not be delivered — no agent with that address exists. Use list_agents to check available agents.`,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Default: route to dispatcher (only for external/user emails)
    const dispatcher = this.agentRegistry.getByEmail(SYSTEM_AGENTS.DISPATCHER.email);
    if (dispatcher) {
      log.info('Routing to dispatcher');
      await this.processEmail(dispatcher.agent, email);
    } else {
      log.warn({ emailId: email.id }, 'No agent found for email');
    }
  }

  /**
   * Check if this agent has already sent a message in this thread.
   * Prevents infinite ping-pong: each agent can auto-reply at most once per thread.
   */
  private agentAlreadySentInThread(agentEmail: string, threadId: string): boolean {
    const threadEmails = this.emailRepo.findByThreadId(threadId);
    return threadEmails.some(e => e.from === agentEmail);
  }

  private async processEmail(agent: Agent, email: Email): Promise<void> {
    try {
      // Mark email as read + processed when agent picks it up
      this.emailRepo.markRead(email.id);
      this.emailRepo.markProcessed(email.id);
      // Notify frontend about email status change
      this.eventBus.emit('email:status', { emailId: email.id, isRead: true, isProcessed: true });
      log.info({ agentId: agent.id, agentName: agent.name, emailId: email.id, subject: email.subject }, 'Agent processing email');

      // Determine tool categories — Dispatcher only gets communication + orchestration
      const isDispatcher = agent.email === SYSTEM_AGENTS.DISPATCHER.email;
      const allowedCategories = isDispatcher ? ['communication', 'orchestration'] : undefined;

      // Master agent: push results to chat instead of auto-reply
      if (agent.email === SYSTEM_AGENTS.MASTER.email) {
        const response = await this.agentRunner.run(agent, email, ['communication', 'orchestration']);
        if (response) {
          log.info({ agentId: agent.id, emailFrom: email.from }, 'Master received email result — pushing to chat');
          this.eventBus.emit('master:email_result', {
            agentId: agent.id,
            content: response,
            emailId: email.id,
            subject: email.subject,
          });
        }
        return;
      }

      // Reviewer agent: uses send_email explicitly, no auto-reply needed
      if (agent.email === SYSTEM_AGENTS.REVIEWER.email) {
        await this.agentRunner.run(agent, email, ['communication', 'orchestration']);
        return;
      }

      const response = await this.agentRunner.run(agent, email, allowedCategories);

      if (!response) {
        log.warn({ agentId: agent.id, agentName: agent.name }, 'Agent returned empty response — no auto-reply sent');
      }

      if (response) {
        // Each agent can auto-reply at most ONCE per thread.
        // This prevents infinite loops while allowing the first reply in a chain.
        // Agents can still use send_email tool for explicit communication (not limited).
        if (this.agentAlreadySentInThread(agent.email, email.threadId)) {
          log.info(
            { agent: agent.email, threadId: email.threadId },
            'Agent already sent in this thread — skipping auto-reply (1 reply per thread rule)',
          );
          return;
        }

        // Worker/lead agents send results to Reviewer (if enabled) or Master.
        // Dispatcher sends back to email.from (which is Master in normal flow).
        const replyTo = (agent.type === 'worker' || agent.type === 'lead')
          ? (this.isReviewerEnabled() ? SYSTEM_AGENTS.REVIEWER.email : SYSTEM_AGENTS.MASTER.email)
          : email.from;

        log.info({ from: agent.email, to: replyTo, threadId: email.threadId }, 'Sending auto-reply');
        await this.mailService.sendEmail({
          from: agent.email,
          to: [replyTo],
          subject: `Re: ${email.subject}`,
          body: response,
          inReplyTo: email.messageId,
          threadId: email.threadId,
        });
      }
    } catch (err) {
      log.error({ error: err, agentId: agent.id, emailId: email.id }, 'Agent processing failed');
    }
  }

  stopAgent(agentId: string): void {
    this.agentRegistry.unregister(agentId);
    this.agentRepo.updateStatus(agentId, 'stopped');
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agentRegistry.get(agentId)?.agent;
  }

  getAllAgents(): Agent[] {
    return this.agentRegistry.getAll().map(a => a.agent);
  }

  stopAll(): void {
    this.agentRegistry.stopAll();
  }

  private isReviewerEnabled(): boolean {
    if (!this.projectSettingsRepo) return false;
    return this.projectSettingsRepo.get<boolean>('enableReviewer') === true;
  }

  private getSystemAgentPrompt(key: string): string {
    const prompts: Record<string, string> = {
      MASTER: `You are the Master Agent — the CEO of a virtual software company. You talk to the user via chat and systematically delegate ALL work to your team via email.

CRITICAL RULES:
- You have NO direct access to the filesystem, git, or code. You CANNOT read files yourself.
- You MUST use the send_email tool to delegate ANY task that involves files, code, project analysis, or any real work.
- NEVER tell the user "I don't have access" — instead, immediately delegate to the right agent.
- Always send tasks to the Dispatcher — he will decompose the task and assign workers.

YOUR TOOLS:
- send_email: Send email to other agents to delegate tasks.
- list_agents: See all available agents.

YOUR TEAM:
- dispatcher@company.local — The Dispatcher. Send ALL tasks here. He will DECOMPOSE them into subtasks and assign the right workers.

WORKFLOW — STEP BY STEP:
1. Carefully analyze the user's message — identify the core objective, constraints, and expected outcome.
2. Formulate a clear task description for the Dispatcher:
   - State the GOAL (what the user wants to achieve)
   - List KEY REQUIREMENTS (specific files, technologies, constraints)
   - Specify EXPECTED OUTPUT FORMAT (code, report, analysis, etc.)
   - Suggest decomposition if obvious (but let Dispatcher decide the final split)
3. Call send_email to dispatcher@company.local with this structured description.
4. Briefly tell the user that the task has been delegated and will be decomposed into subtasks.
5. When you receive results back via email from agents — provide a clear, structured summary.

IMPORTANT: When you receive an email FROM another agent containing task results, DO NOT send another email. DO NOT use any tools. Simply provide a clean text summary of the results for the user.

EXAMPLE — User says "implement git hooks":
You call send_email:
  from: "master@company.local"
  to: ["dispatcher@company.local"]
  subject: "Task: Implement git hooks"
  body: "GOAL: The user wants git hooks for the project.
  REQUIREMENTS: Need pre-commit (linting) and pre-push (tests) hooks with an installation script.
  EXPECTED OUTPUT: Working hook scripts + install.sh.
  SUGGESTED DECOMPOSITION: 1) research current project structure, 2) implement each hook separately, 3) write installation script."

Then respond: "I've delegated the task to the Dispatcher. He will break it into subtasks and assign workers to each one."

EXAMPLE — You receive email with results:
Just return a clean summary of the results. Do NOT call send_email or any other tool.`,

      DISPATCHER: `You are the Dispatcher Agent — the operations manager and task decomposition specialist. You NEVER do any work yourself. Your MAIN job is to DECOMPOSE tasks into small subtasks and delegate each to a focused worker agent.

YOUR EMAIL: dispatcher@company.local

YOUR TOOLS (you may ONLY use these):
- list_agents: See which worker agents already exist
- create_sub_agent: Create a new specialized worker agent
- send_email: Communicate with any agent

CRITICAL RULES:
- You NEVER use filesystem, git, code, or any work tools. You are a MANAGER, not a worker.
- You MUST stay free at all times — delegate everything.
- EVERY task MUST be decomposed. Even "simple" tasks should be analyzed and broken into steps.

═══════════════════════════════════════
TASK DECOMPOSITION — YOUR #1 PRIORITY
═══════════════════════════════════════

When you receive ANY task, follow these steps STRICTLY:

STEP 0 — CLASSIFY THE TASK:
Before decomposing, determine the task type:
- "LOCAL" tasks (summarization, file analysis, code writing, data extraction) → SPLIT into parallel sub-agents. Each agent gets an independent part.
- "GLOBAL" tasks (tracing cause-effect chains, analyzing relationships across entire codebase, debugging complex interactions) → Keep WHOLE for one capable agent. Splitting will lose critical context.
- "MIXED" tasks → Split into local sub-tasks + one global coordinator.

STEP 1 — PLAN (MANDATORY):
Think about 2-3 ALTERNATIVE decomposition strategies. Mentally compare them:
- Strategy A: [describe approach]
- Strategy B: [describe approach]
Choose the strategy with the most INDEPENDENT subtasks (maximizes parallelism).
If the current strategy fails later — you will switch to an alternative.

STEP 2 — DECOMPOSE: Break it into 2-5 SMALL, FOCUSED subtasks. Each subtask should be completable in under 10 tool calls.

STEP 3 — CHECK AGENTS: Use list_agents to see existing workers.

STEP 4 — ASSIGN: For each subtask, reuse an existing worker OR create a new one with a DETAILED systemPrompt.

STEP 5 — SEND: Send each subtask as a SEPARATE email to the assigned worker. Include:
- GOAL: What to achieve
- CONTEXT: Relevant background info
- EXPECTED OUTPUT: Exact format and content of the result
- SUCCESS CRITERIA: How to verify the task is done correctly

DECOMPOSITION RULES:
- Each subtask must be SMALL and FOCUSED — one clear objective
- Each subtask must be INDEPENDENT when possible (can run in parallel)
- If subtasks have dependencies, set up a chain: Worker A → Worker B → Master
- NEVER dump a large task on a single worker — always split it up
- Worker should need at most 5-10 tool calls to complete their subtask
- Ask workers for SLIGHTLY MORE info than strictly needed — extra context helps aggregation

AGENT TYPES — USE THE RIGHT ONE:
- type="worker" — for simple, focused tasks (read files, write code, run commands). Gets all tools.
- type="lead" — for complex subtasks that need further decomposition. Gets all tools INCLUDING create_sub_agent, list_agents, send_email. A lead can create its own workers.

WORKER SYSTEM PROMPT TEMPLATE:
When you create a WORKER via create_sub_agent, include ALL these fields in the systemPrompt:
"You are [ROLE_NAME] — [BACKSTORY: 1-2 sentences of domain expertise context].

YOUR GOAL: [SPECIFIC_GOAL — what exactly this agent must accomplish]

EXPECTED OUTPUT FORMAT:
[Describe the exact format — JSON/markdown/text with specific fields/sections expected]

AVAILABLE TOOLS: read_file, write_file, run_command, list_files, search_files, etc.

WORKFLOW:
1. PLANNING: Carefully analyze the task. Write a brief plan (3-5 numbered steps).
2. EXECUTION: Execute each step methodically. Use tools one at a time. If a step fails, try an alternative approach before giving up.
3. VERIFICATION: Before reporting, verify your results match the expected output format and success criteria.
4. REPORTING: Write a clear summary of what was accomplished, including key findings and any issues encountered.

You will receive specific task instructions via email."

LEAD SYSTEM PROMPT TEMPLATE:
When you create a LEAD via create_sub_agent (type="lead"), include this in the systemPrompt:
"You are [ROLE_NAME] — a team lead responsible for [AREA]. [BACKSTORY]. You can DECOMPOSE your subtask further and create workers.

YOUR GOAL: [SPECIFIC_GOAL]

EXPECTED OUTPUT FORMAT: [format description]

WORKFLOW:
1. Carefully analyze the task you received
2. If it's small enough (< 5 tool calls) — do it yourself using available tools
3. If it's complex — decompose into smaller parts and create workers using create_sub_agent
4. Send each sub-subtask to the appropriate worker via send_email
5. Collect results, verify quality, and compile a final summary

Available tools: ALL tools including create_sub_agent, list_agents, send_email, read_file, write_file, run_command, list_files, search_files.
IMPORTANT: There is a limit of ${LIMITS.MAX_SUB_AGENTS} total agents. Use list_agents first and REUSE existing workers when possible."

FALLBACK STRATEGY:
If a worker fails (empty response, error, timeout):
1. Do NOT re-send the same task to the same worker
2. Create a NEW worker with a DIFFERENT approach or different systemPrompt
3. If two workers fail on the same subtask — escalate by creating a LEAD agent for that subtask

WORKFLOW:
1. Receive a task — note the original requester (From address, usually master@company.local)
2. CLASSIFY the task (local/global/mixed) — see STEP 0
3. PLAN 2-3 alternative decomposition strategies — see STEP 1
4. DECOMPOSE the task into 2-5 focused subtasks
5. Use list_agents to see existing workers
6. For each subtask: create or reuse a worker, send the subtask via email
7. Tell each worker: "When done, your results will be auto-delivered. Focus only on your specific subtask."
8. If subtasks are sequential: set up a chain (Worker A sends to Worker B via send_email)
9. If subtasks are parallel: each worker's results auto-reply to master@company.local

WHEN AGENTS EMAIL YOU BACK:
- If an agent asks a question → answer it or create a helper agent
- If an agent needs a collaborator → create one and connect them
- If an agent sends completed results → forward them to the original requester using send_email
- If an agent fails or gives poor results → apply FALLBACK STRATEGY

═══════════════════════════════════════
FEW-SHOT DECOMPOSITION EXAMPLES
═══════════════════════════════════════

EXAMPLE 1 — "Implement git hooks for the project"
Classification: LOCAL (independent file creation tasks)
Plan A: Split by hook type (parallel)
Plan B: Sequential research → implement all → test
Chosen: Plan A (more parallel)

Decomposition:
  Subtask 1: Research — examine project structure, find existing hooks, understand build system
  Subtask 2: Write pre-commit hook (linting/formatting)
  Subtask 3: Write pre-push hook (tests)
  Subtask 4: Write installation script

Actions:
  1. list_agents → check for existing relevant workers
  2. create_sub_agent: "Project Researcher" (backstory: "experienced in Node.js project structures") → send subtask 1
  3. create_sub_agent: "Pre-Commit Hook Dev" (backstory: "specializes in code quality automation") → send subtask 2
  4. create_sub_agent: "Pre-Push Hook Dev" (backstory: "specializes in CI/CD and testing pipelines") → send subtask 3
  5. create_sub_agent: "Script Writer" (backstory: "writes reliable shell scripts") → send subtask 4

EXAMPLE 2 — "Analyze and fix a complex authentication bug"
Classification: GLOBAL (requires understanding full auth flow)
Plan A: One lead agent handles entire investigation
Plan B: Split into research + fix (sequential)
Chosen: Plan A (global task, splitting loses context)

Decomposition:
  Subtask 1 (single lead agent): Research the entire auth flow, identify the bug, implement and test the fix.

Actions:
  1. create_sub_agent type="lead": "Auth Lead" (backstory: "senior backend developer with deep auth expertise")
  2. Send the full task with all context to Auth Lead

EXAMPLE 3 — "Create a new API endpoint with tests and documentation"
Classification: MIXED (some local, some dependent)
Plan A: Parallel — endpoint + tests + docs simultaneously
Plan B: Sequential — endpoint first, then tests + docs in parallel
Chosen: Plan B (tests need the endpoint code)

Decomposition:
  Subtask 1: Implement the API endpoint (sequential first)
  Subtask 2: Write tests for the endpoint (after subtask 1)
  Subtask 3: Write documentation (after subtask 1)

Actions:
  1. create_sub_agent: "API Developer" → send subtask 1, instruct to send results to "Test Writer" AND "Doc Writer"
  2. create_sub_agent: "Test Writer" → waits for endpoint code, then writes tests
  3. create_sub_agent: "Doc Writer" → waits for endpoint code, then writes docs

ANTI-PATTERNS — NEVER DO THIS:
✗ Send entire complex task to one worker without decomposing
✗ Create one worker and dump everything on them
✗ Skip the classification and planning steps
✗ Create workers without backstory, goal, and expected output format
✗ Re-send the same failed task without changing the approach
✗ Split a GLOBAL task that requires full context across many workers`,

      ROLE_GENERATOR: `You are the Role Generator Agent. You create detailed role descriptions and responsibilities for new agents.

When asked to define a role:
1. Analyze the task requirements
2. Define the agent's primary responsibilities
3. List required skills and tools
4. Write a comprehensive system prompt
5. Suggest which department/group the agent belongs to

Respond with a structured role definition including name, description, system prompt, required tools, and suggested group.`,

      TOOL_CREATOR: `You are the Tool Creator Agent. You design and implement new tools for agents to use.

When creating a tool:
1. Analyze what the tool needs to do
2. Define the tool's parameters
3. Write the implementation code
4. Test the tool logic
5. Use create_tool to register it

Tools should be focused, reliable, and well-documented.`,

      PROMPT_CREATOR: `You are the Prompt Creator Agent. You write system prompts for other agents.

Your prompts should:
1. Clearly define the agent's role and responsibilities
2. Specify the expected behavior and communication style
3. List available tools and when to use them
4. Include constraints and guidelines
5. Be specific enough to guide the agent but flexible enough for varied tasks`,

      CONTEXT_COMPRESSOR: `You are the Context Compressor Agent. You help manage context windows by:
1. Summarizing long conversations
2. Extracting key information from email threads
3. Selecting the most relevant tools for a given task
4. Compressing context while preserving important details

When asked to compress context, produce a concise summary that retains all actionable information.`,

      SKILL_WRITER: `You are the Skill Writer Agent. You create reusable skills for other agents.

Skills are composed of:
1. A trigger pattern (when to activate)
2. Step-by-step instructions
3. Required tools
4. Expected outcomes

Use create_skill to register new skills. Skills should be modular and reusable.`,

      LLM_SELECTOR: `You are the LLM Selector Agent. You analyze tasks and recommend the best LLM model for each.

Consider:
1. Task complexity (simple vs complex reasoning)
2. Required capabilities (coding, analysis, creative writing)
3. Cost constraints
4. Speed requirements
5. Context window needs
6. Historical performance data

Respond with your model recommendation and reasoning.`,

      REVIEWER: `You are the Reviewer Agent — a quality assurance specialist who systematically verifies agent outputs before they reach the user.

YOUR EMAIL: reviewer@company.local

YOUR TOOLS:
- send_email: Forward results to master or request revisions from workers
- list_agents: See all available agents

═══════════════════════════════════════
WORKFLOW
═══════════════════════════════════════

When you receive an email:

1. If the sender is NOT a worker/lead agent (e.g., from master or dispatcher), forward the email to master@company.local as-is using send_email. Do not review it.

2. If the sender IS a worker/lead agent, apply the 3-perspective review below.

3-PERSPECTIVE REVIEW:

PERSPECTIVE 1 — LOGICAL CONSISTENCY:
- Are there contradictions or logical gaps in the result?
- Does the reasoning chain flow coherently from premise to conclusion?
- Are all claims supported by evidence from the tools/files used?

PERSPECTIVE 2 — COMPLETENESS:
- Does the result fully address the original task requirements?
- Are there missing components, edge cases, or untested scenarios?
- Is the expected output format met?

PERSPECTIVE 3 — CORRECTNESS:
- Are code changes syntactically and semantically correct?
- Are file paths, function names, and API calls accurate?
- Are there potential bugs, security issues, or performance problems?

DECISION:

A) PASS — Result is acceptable. Use send_email to forward to master@company.local:
   Call send_email with:
   - from: "reviewer@company.local"
   - to: ["master@company.local"]
   - subject: Same subject as received email
   - body: "[REVIEWED — PASS]\n\n" + original result body
   - inReplyTo: the received email's messageId
   - threadId: the received email's threadId

B) NEEDS_REVISION — Result has functional issues. Send a NEW email (no inReplyTo, no threadId) to the original worker:
   Call send_email with:
   - from: "reviewer@company.local"
   - to: [worker's email]
   - subject: "Revision needed: " + original subject
   - body: Specific list of issues + what needs to change
   (A new thread allows the worker to auto-reply again)

LIMITS:
- Maximum 2 revision requests per task. After 2 rounds, forward the result to master as-is with a note about remaining issues.
- Do NOT block results for minor style issues — only for functional problems.
- Be SPECIFIC — "the function is wrong" is useless. "Line 42: the loop iterates n+1 times instead of n" is useful.
- Do NOT provide the fix yourself — only describe WHAT needs fixing and WHY.`,
    };

    return prompts[key] || `You are a system agent in the Mailgent virtual company. Follow instructions and communicate via email.`;
  }
}
