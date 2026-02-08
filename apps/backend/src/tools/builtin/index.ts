import fs from 'fs/promises';
import path from 'path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);
import { v4 as uuid } from 'uuid';
import type { ToolDefinition, EmailSendParams } from '@mailgent/shared';
import type { ToolRegistry } from '../tool-registry';
import type { AgentSandbox } from '../../agents/agent-sandbox';
import type { MailService } from '../../mail/mail-service';
import type { EventBus } from '../../utils/event-bus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();

function def(
  id: string,
  name: string,
  description: string,
  category: ToolDefinition['category'],
  parameters: ToolDefinition['parameters'],
): ToolDefinition {
  const ts = now();
  return {
    id,
    name,
    description,
    category,
    parameters,
    isBuiltin: true,
    isEnabled: true,
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * Simple recursive glob: walks `dir` and returns paths matching a basic
 * pattern that supports leading `**\/` and trailing `*` / exact extension.
 * This intentionally stays simple; we do not pull in a third-party glob lib.
 */
async function simpleGlob(dir: string, pattern: string): Promise<string[]> {
  const results: string[] = [];

  // Convert simple glob pattern to a RegExp.
  // Supported wildcards: *, **, ?
  const regexStr = pattern
    .replace(/\\/g, '/')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/<<<GLOBSTAR>>>/g, '.*');
  const regex = new RegExp(`^${regexStr}$`);

  async function walk(current: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const childAbs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(childAbs, childRel);
      } else if (regex.test(childRel)) {
        results.push(childAbs);
      }
    }
  }

  await walk(dir, '');
  return results;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerBuiltinTools(
  registry: ToolRegistry,
  sandbox: AgentSandbox,
  mailService: MailService,
  eventBus: EventBus,
  gitService?: unknown,
): void {
  // Use sandbox.getWorkDir() dynamically so it picks up switchProject changes
  const getCwd = () => sandbox.getWorkDir();

  // -----------------------------------------------------------------------
  // 1. read_file
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-read-file', 'read_file', 'Read the contents of a file at a given path.', 'filesystem', [
      { name: 'path', type: 'string', description: 'Absolute or relative file path to read', required: true },
      { name: 'encoding', type: 'string', description: 'File encoding (default utf-8)', required: false, default: 'utf-8' },
    ]),
    async (params) => {
      const filePath = sandbox.validatePath(params.path as string);
      const encoding = (params.encoding as BufferEncoding) ?? 'utf-8';
      const content = await fs.readFile(filePath, { encoding });
      return { path: filePath, content, size: Buffer.byteLength(content, encoding) };
    },
  );

  // -----------------------------------------------------------------------
  // 2. write_file
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-write-file', 'write_file', 'Write content to a file, creating parent directories if needed.', 'filesystem', [
      { name: 'path', type: 'string', description: 'Absolute or relative file path to write', required: true },
      { name: 'content', type: 'string', description: 'Content to write to the file', required: true },
      { name: 'encoding', type: 'string', description: 'File encoding (default utf-8)', required: false, default: 'utf-8' },
    ]),
    async (params) => {
      const filePath = sandbox.validatePath(params.path as string);
      const content = params.content as string;
      const encoding = (params.encoding as BufferEncoding) ?? 'utf-8';
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, { encoding });
      return { path: filePath, bytesWritten: Buffer.byteLength(content, encoding) };
    },
  );

  // -----------------------------------------------------------------------
  // 3. list_files
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-list-files', 'list_files', 'List files matching a glob pattern within the working directory.', 'filesystem', [
      { name: 'pattern', type: 'string', description: 'Glob pattern (e.g. "**/*.ts")', required: true },
      { name: 'directory', type: 'string', description: 'Base directory to search in (defaults to working directory)', required: false },
    ]),
    async (params) => {
      const baseDir = params.directory
        ? sandbox.validatePath(params.directory as string)
        : getCwd();
      const pattern = params.pattern as string;
      const files = await simpleGlob(baseDir, pattern);
      return { pattern, directory: baseDir, files, count: files.length };
    },
  );

  // -----------------------------------------------------------------------
  // 4. search_files
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-search-files', 'search_files', 'Search file contents using a regular expression.', 'filesystem', [
      { name: 'pattern', type: 'string', description: 'Regular expression pattern to search for', required: true },
      { name: 'directory', type: 'string', description: 'Directory to search in (defaults to working directory)', required: false },
      { name: 'filePattern', type: 'string', description: 'Glob pattern to filter which files to search (e.g. "**/*.ts")', required: false, default: '**/*' },
      { name: 'maxResults', type: 'number', description: 'Maximum number of matches to return', required: false, default: 100 },
    ]),
    async (params) => {
      const baseDir = params.directory
        ? sandbox.validatePath(params.directory as string)
        : getCwd();
      const regex = new RegExp(params.pattern as string, 'gm');
      const filePattern = (params.filePattern as string) ?? '**/*';
      const maxResults = (params.maxResults as number) ?? 100;

      const files = await simpleGlob(baseDir, filePattern);
      const matches: Array<{ file: string; line: number; text: string }> = [];

      for (const file of files) {
        if (matches.length >= maxResults) break;
        let content: string;
        try {
          content = await fs.readFile(file, 'utf-8');
        } catch {
          continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) break;
          if (regex.test(lines[i])) {
            matches.push({ file, line: i + 1, text: lines[i].trim() });
          }
          regex.lastIndex = 0; // reset for next test
        }
      }

      return { pattern: params.pattern, directory: baseDir, matches, totalMatches: matches.length };
    },
  );

  // -----------------------------------------------------------------------
  // 5. create_directory
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-create-directory', 'create_directory', 'Create a directory recursively.', 'filesystem', [
      { name: 'path', type: 'string', description: 'Directory path to create', required: true },
    ]),
    async (params) => {
      const dirPath = sandbox.validatePath(params.path as string);
      await fs.mkdir(dirPath, { recursive: true });
      return { path: dirPath, created: true };
    },
  );

  // -----------------------------------------------------------------------
  // 6. delete_file
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-delete-file', 'delete_file', 'Delete a file at the specified path.', 'filesystem', [
      { name: 'path', type: 'string', description: 'Path of the file to delete', required: true },
    ]),
    async (params) => {
      const filePath = sandbox.validatePath(params.path as string);
      await fs.unlink(filePath);
      return { path: filePath, deleted: true };
    },
  );

  // -----------------------------------------------------------------------
  // 7. run_command
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-run-command', 'run_command', 'Execute a shell command within the sandbox working directory.', 'system', [
      { name: 'command', type: 'string', description: 'The command to execute (first word is the executable)', required: true },
      { name: 'args', type: 'array', description: 'Arguments to pass to the command', required: false, default: [] },
      { name: 'timeout', type: 'number', description: 'Timeout in milliseconds (default 30000)', required: false, default: 30000 },
    ]),
    async (params) => {
      const command = params.command as string;
      const args = (params.args as string[]) ?? [];
      const timeout = (params.timeout as number) ?? 30000;

      // Validate full command string for safety
      sandbox.validateCommand([command, ...args].join(' '));

      const { stdout, stderr } = await execFile(command, args, {
        cwd: getCwd(),
        timeout,
        maxBuffer: 1024 * 1024, // 1 MB
      });

      return { command, args, stdout, stderr };
    },
  );

  // -----------------------------------------------------------------------
  // 8. git_status
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-git-status', 'git_status', 'Show the current git status of the working directory.', 'git', []),
    async () => {
      const { stdout } = await execFile('git', ['status', '--porcelain', '-b'], { cwd: getCwd() });
      return { status: stdout.trim() };
    },
  );

  // -----------------------------------------------------------------------
  // 9. git_commit
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-git-commit', 'git_commit', 'Stage specified files and create a git commit.', 'git', [
      { name: 'message', type: 'string', description: 'Commit message', required: true },
      { name: 'files', type: 'array', description: 'List of file paths to stage (use ["."] for all)', required: true },
    ]),
    async (params) => {
      const message = params.message as string;
      const files = params.files as string[];

      // Stage files
      await execFile('git', ['add', ...files], { cwd: getCwd() });

      // Commit
      const { stdout } = await execFile('git', ['commit', '-m', message], { cwd: getCwd() });
      return { message, files, output: stdout.trim() };
    },
  );

  // -----------------------------------------------------------------------
  // 10. git_diff
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-git-diff', 'git_diff', 'Show the git diff of the working directory or staged changes.', 'git', [
      { name: 'staged', type: 'boolean', description: 'Show staged changes only (default false)', required: false, default: false },
      { name: 'path', type: 'string', description: 'Limit diff to a specific path', required: false },
    ]),
    async (params) => {
      const args = ['diff'];
      if (params.staged) args.push('--cached');
      if (params.path) args.push(params.path as string);

      const { stdout } = await execFile('git', args, { cwd: getCwd() });
      return { diff: stdout };
    },
  );

  // -----------------------------------------------------------------------
  // 11. git_log
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-git-log', 'git_log', 'Show recent git log entries.', 'git', [
      { name: 'count', type: 'number', description: 'Number of log entries to show (default 10)', required: false, default: 10 },
      { name: 'oneline', type: 'boolean', description: 'Use --oneline format (default true)', required: false, default: true },
    ]),
    async (params) => {
      const count = (params.count as number) ?? 10;
      const oneline = params.oneline !== false;
      const args = ['log', `-${count}`];
      if (oneline) args.push('--oneline');

      const { stdout } = await execFile('git', args, { cwd: getCwd() });
      return { log: stdout.trim() };
    },
  );

  // -----------------------------------------------------------------------
  // 12. send_email
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-send-email', 'send_email', 'Send an email through the mail service.', 'communication', [
      { name: 'from', type: 'string', description: 'Sender email address', required: true },
      { name: 'to', type: 'array', description: 'List of recipient email addresses', required: true },
      { name: 'subject', type: 'string', description: 'Email subject', required: true },
      { name: 'body', type: 'string', description: 'Plain text body of the email', required: true },
      { name: 'cc', type: 'array', description: 'List of CC recipient email addresses', required: false },
      { name: 'htmlBody', type: 'string', description: 'HTML body of the email', required: false },
      { name: 'inReplyTo', type: 'string', description: 'Message-ID this is a reply to', required: false },
      { name: 'threadId', type: 'string', description: 'Thread ID for conversation tracking', required: false },
    ]),
    async (params) => {
      const sendParams: EmailSendParams = {
        from: params.from as string,
        to: params.to as string[],
        subject: params.subject as string,
        body: params.body as string,
        cc: params.cc as string[] | undefined,
        htmlBody: params.htmlBody as string | undefined,
        inReplyTo: params.inReplyTo as string | undefined,
        threadId: params.threadId as string | undefined,
      };
      const messageId = await mailService.sendEmail(sendParams);
      return { messageId, sent: true };
    },
  );

  // -----------------------------------------------------------------------
  // 13. create_sub_agent
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-create-sub-agent', 'create_sub_agent', 'Create a new sub-agent to handle a delegated task. Returns the created agent info including its email address.', 'orchestration', [
      { name: 'name', type: 'string', description: 'Name for the new agent', required: true },
      { name: 'email', type: 'string', description: 'Email address for the new agent (e.g. analyst@company.local). Must be unique.', required: true },
      { name: 'description', type: 'string', description: 'Description of the agent purpose', required: true },
      { name: 'systemPrompt', type: 'string', description: 'System prompt for the agent', required: true },
      { name: 'type', type: 'string', description: 'Agent type', required: false, default: 'worker', enum: ['worker', 'lead'] },
      { name: 'toolIds', type: 'array', description: 'List of tool IDs to assign', required: false, default: [] },
      { name: 'groupId', type: 'string', description: 'Group ID to assign the agent to', required: false },
    ]),
    async (params, agentId) => {
      const requestId = uuid();
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          eventBus.removeAllListeners(`agent:create-response:${requestId}`);
          resolve({ requestId, status: 'error', error: 'Agent creation timed out' });
        }, 15000);

        eventBus.once(`agent:create-response:${requestId}`, (data: Record<string, unknown>) => {
          clearTimeout(timeout);
          if (data.error) {
            resolve({ requestId, status: 'error', error: data.error });
          } else {
            const agent = data.agent as { id: string; name: string; email: string; type: string };
            resolve({
              requestId,
              status: 'created',
              agent: { id: agent.id, name: agent.name, email: agent.email, type: agent.type },
              message: `Agent "${agent.name}" created with email ${agent.email}`,
            });
          }
        });

        eventBus.emit('agent:create-request', {
          requestId,
          parentAgentId: agentId,
          name: params.name as string,
          email: params.email as string,
          description: params.description as string,
          systemPrompt: params.systemPrompt as string,
          type: (params.type as string) ?? 'worker',
          toolIds: (params.toolIds as string[]) ?? [],
          groupId: params.groupId as string | undefined,
        });
      });
    },
  );

  // -----------------------------------------------------------------------
  // 14. stop_agent
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-stop-agent', 'stop_agent', 'Stop a running agent by its ID.', 'orchestration', [
      { name: 'agentId', type: 'string', description: 'ID of the agent to stop', required: true },
      { name: 'reason', type: 'string', description: 'Reason for stopping the agent', required: false, default: 'Stopped by tool call' },
    ]),
    async (params, callerAgentId) => {
      const targetAgentId = params.agentId as string;
      const reason = (params.reason as string) ?? 'Stopped by tool call';
      const requestId = uuid();
      eventBus.emit('agent:stop-request', {
        requestId,
        callerAgentId,
        targetAgentId,
        reason,
      });
      return { requestId, targetAgentId, status: 'stop-requested' };
    },
  );

  // -----------------------------------------------------------------------
  // 15. query_agent
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-query-agent', 'query_agent', 'Query the current status and information of an agent.', 'orchestration', [
      { name: 'agentId', type: 'string', description: 'ID of the agent to query', required: true },
    ]),
    async (params, callerAgentId) => {
      const targetAgentId = params.agentId as string;
      return new Promise((resolve) => {
        const requestId = uuid();
        const timeout = setTimeout(() => {
          eventBus.removeAllListeners(`agent:query-response:${requestId}`);
          resolve({ requestId, targetAgentId, status: 'timeout', error: 'Agent query timed out' });
        }, 10000);

        eventBus.once(`agent:query-response:${requestId}`, (data: unknown) => {
          clearTimeout(timeout);
          resolve({ requestId, targetAgentId, status: 'ok', data });
        });

        eventBus.emit('agent:query-request', {
          requestId,
          callerAgentId,
          targetAgentId,
        });
      });
    },
  );

  // -----------------------------------------------------------------------
  // 16. list_agents
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-list-agents', 'list_agents', 'List all agents, optionally filtered by status or group.', 'orchestration', [
      { name: 'status', type: 'string', description: 'Filter by agent status', required: false, enum: ['idle', 'thinking', 'acting', 'waiting', 'error', 'stopped'] },
      { name: 'groupId', type: 'string', description: 'Filter by group ID', required: false },
    ]),
    async (params, callerAgentId) => {
      return new Promise((resolve) => {
        const requestId = uuid();
        const timeout = setTimeout(() => {
          eventBus.removeAllListeners(`agent:list-response:${requestId}`);
          resolve({ requestId, status: 'timeout', error: 'Agent list request timed out' });
        }, 10000);

        eventBus.once(`agent:list-response:${requestId}`, (data: unknown) => {
          clearTimeout(timeout);
          resolve({ requestId, status: 'ok', agents: data });
        });

        eventBus.emit('agent:list-request', {
          requestId,
          callerAgentId,
          filterStatus: params.status as string | undefined,
          filterGroupId: params.groupId as string | undefined,
        });
      });
    },
  );

  // -----------------------------------------------------------------------
  // 17. create_group
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-create-group', 'create_group', 'Create a new agent group for collaborative work.', 'orchestration', [
      { name: 'name', type: 'string', description: 'Group name', required: true },
      { name: 'description', type: 'string', description: 'Description of the group purpose', required: true },
      { name: 'specializations', type: 'array', description: 'List of specialization tags', required: false, default: [] },
      { name: 'maxMembers', type: 'number', description: 'Maximum number of members (default 10)', required: false, default: 10 },
    ]),
    async (params, callerAgentId) => {
      const requestId = uuid();
      eventBus.emit('group:create-request', {
        requestId,
        callerAgentId,
        name: params.name as string,
        description: params.description as string,
        specializations: (params.specializations as string[]) ?? [],
        maxMembers: (params.maxMembers as number) ?? 10,
      });
      return { requestId, status: 'requested', message: 'Group creation requested' };
    },
  );

  // -----------------------------------------------------------------------
  // 18. assign_to_group
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-assign-to-group', 'assign_to_group', 'Assign an agent to a group.', 'orchestration', [
      { name: 'agentId', type: 'string', description: 'ID of the agent to assign', required: true },
      { name: 'groupId', type: 'string', description: 'ID of the group to assign the agent to', required: true },
    ]),
    async (params, callerAgentId) => {
      const requestId = uuid();
      eventBus.emit('group:assign-request', {
        requestId,
        callerAgentId,
        agentId: params.agentId as string,
        groupId: params.groupId as string,
      });
      return { requestId, status: 'requested', message: 'Agent assignment requested' };
    },
  );

  // -----------------------------------------------------------------------
  // 19. create_tool
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-create-tool', 'create_tool', 'Create a new custom tool from source code.', 'meta', [
      { name: 'name', type: 'string', description: 'Unique tool name', required: true },
      { name: 'description', type: 'string', description: 'Description of what the tool does', required: true },
      { name: 'category', type: 'string', description: 'Tool category', required: true, enum: ['filesystem', 'system', 'git', 'communication', 'orchestration', 'meta'] },
      { name: 'parameters', type: 'array', description: 'Array of parameter definitions (objects with name, type, description, required)', required: true },
      { name: 'code', type: 'string', description: 'JavaScript/TypeScript source code for the tool handler', required: true },
    ]),
    async (params, callerAgentId) => {
      const requestId = uuid();
      eventBus.emit('tool:create-request', {
        requestId,
        callerAgentId,
        name: params.name as string,
        description: params.description as string,
        category: params.category as string,
        parameters: params.parameters as unknown[],
        code: params.code as string,
      });
      return { requestId, status: 'requested', message: 'Custom tool creation requested' };
    },
  );

  // -----------------------------------------------------------------------
  // 20. create_skill
  // -----------------------------------------------------------------------
  registry.register(
    def('builtin-create-skill', 'create_skill', 'Create a new reusable skill (a prompt template with optional tools).', 'meta', [
      { name: 'name', type: 'string', description: 'Unique skill name', required: true },
      { name: 'description', type: 'string', description: 'Description of the skill', required: true },
      { name: 'prompt', type: 'string', description: 'Prompt template for the skill', required: true },
      { name: 'toolIds', type: 'array', description: 'List of tool IDs the skill uses', required: false, default: [] },
      { name: 'tags', type: 'array', description: 'Tags for categorisation', required: false, default: [] },
    ]),
    async (params, callerAgentId) => {
      const requestId = uuid();
      eventBus.emit('skill:create-request', {
        requestId,
        callerAgentId,
        name: params.name as string,
        description: params.description as string,
        prompt: params.prompt as string,
        toolIds: (params.toolIds as string[]) ?? [],
        tags: (params.tags as string[]) ?? [],
      });
      return { requestId, status: 'requested', message: 'Custom skill creation requested' };
    },
  );
}
