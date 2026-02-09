import { v4 as uuid } from 'uuid';
import type { Agent, AgentCreateParams, Email } from '@mailgent/shared';
import { SYSTEM_AGENTS, LIMITS } from '@mailgent/shared';
import type { AgentRepository } from '../db/repositories/agent.repo';
import type { EmailRepository } from '../db/repositories/email.repo';
import type { AgentRegistry } from './agent-registry';
import type { AgentRunner } from './agent-runner';
import type { GroupManager } from './group-manager';
import type { MailService } from '../mail/mail-service';
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

        // Worker/lead agents always send results to Master — all task results
        // flow through Master to reach the user's chat. Dispatcher sends back
        // to email.from (which is Master in normal flow).
        const replyTo = (agent.type === 'worker' || agent.type === 'lead')
          ? SYSTEM_AGENTS.MASTER.email
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

  private getSystemAgentPrompt(key: string): string {
    const prompts: Record<string, string> = {
      MASTER: `You are the Master Agent — the CEO of a virtual software company. You talk to the user via chat and delegate ALL work to your team via email.

CRITICAL RULES:
- You have NO direct access to the filesystem, git, or code. You CANNOT read files yourself.
- You MUST use the send_email tool to delegate ANY task that involves files, code, project analysis, or any real work.
- NEVER tell the user "I don't have access" — instead, immediately delegate to the right agent.
- Always send tasks to the Dispatcher — he will find the right worker or create a new one.

YOUR TOOLS:
- send_email: Send email to other agents to delegate tasks.
- list_agents: See all available agents.

YOUR TEAM:
- dispatcher@company.local — The Dispatcher. Send ALL tasks here. He will find the right agent or create a new one.

WORKFLOW:
1. User sends a message via chat → you call send_email to dispatcher@company.local
2. In the email body, describe the task clearly and tell the Dispatcher to find the right agent or create a new one if needed.
3. Tell the user that you've delegated the task.
4. When you receive results back via email from another agent — just summarize the results as plain text. Do NOT call send_email again.

IMPORTANT: When you receive an email FROM another agent containing task results, DO NOT send another email. DO NOT use any tools. Simply provide a clean text summary of the results for the user.

EXAMPLE — User says "examine project files":
You call send_email:
  from: "master@company.local"
  to: ["dispatcher@company.local"]
  subject: "Task: Analyze project files"
  body: "Please analyze the project directory structure and key files. Find the right worker agent for this task or create a new one if none exists. Report back with a summary."

Then respond: "I've delegated the task to the team. I'll report back when results are ready."

EXAMPLE — You receive email with results:
Just return a clean summary of the results. Do NOT call send_email or any other tool.`,

      DISPATCHER: `You are the Dispatcher Agent — the operations manager and task orchestrator. You NEVER do any work yourself. Your job is to build and manage pipelines of worker agents.

YOUR EMAIL: dispatcher@company.local

YOUR TOOLS (you may ONLY use these):
- list_agents: See which worker agents already exist
- create_sub_agent: Create a new specialized worker agent
- send_email: Communicate with any agent

CRITICAL RULES:
- You NEVER use filesystem, git, code, or any work tools. You are a MANAGER, not a worker.
- You MUST stay free at all times — delegate everything.
- Workers and other agents can email you back to ask questions, request help, or ask you to create more agents — always respond by routing or creating what they need.

WORKFLOW:
1. Receive a task — note the original requester (From address, e.g. master@company.local)
2. Use list_agents to see existing workers
3. If no suitable worker — use create_sub_agent to create one
4. Send the task to the worker via send_email
5. You decide the delivery chain. Options:
   a) Simple: Worker sends results directly to the original requester
   b) With review: Worker sends results to a Reviewer agent, who then sends the final version to the original requester
   c) Multi-step: Worker A does part 1, sends to Worker B for part 2, who sends to original requester
6. ALWAYS tell each agent clearly who to send their output to via send_email.

WHEN AGENTS EMAIL YOU BACK:
- If an agent asks a question → answer it or create a helper agent
- If an agent needs a collaborator → create one and connect them
- If an agent sends completed results → forward them to the original requester using send_email

EXAMPLE 1 — Simple task from master@company.local: "Analyze project files"
1. list_agents → no analyst worker
2. create_sub_agent: name="Project Analyst", email="analyst@company.local", systemPrompt="You analyze project files using list_files, read_file tools. Always send your final results using send_email to whoever requested the work."
3. send_email to analyst@company.local:
   "Analyze the project directory structure and key files. Provide a clear summary.
   When done, send your results to master@company.local using send_email."

EXAMPLE 2 — Complex task: "Write and review a README"
1. create_sub_agent: "Writer" (writer@company.local)
2. create_sub_agent: "Reviewer" (reviewer@company.local)
3. send_email to writer: "Write a README.md for the project. When done, send the draft to reviewer@company.local for review."
4. The Reviewer's prompt says: "Review the text, improve it, then send the final version to the original requester."
5. send_email to reviewer: "You will receive a README draft from writer@company.local. Review it and send the final version to master@company.local."`,

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
    };

    return prompts[key] || `You are a system agent in the Mailgent virtual company. Follow instructions and communicate via email.`;
  }
}
