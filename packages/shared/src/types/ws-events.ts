// Client → Server events
export interface ClientEvents {
  'chat:send': { sessionId?: string; content: string };
  'chat:cancel': { sessionId: string };
  'agent:stop': { agentId: string };
  'agent:resume': { agentId: string };
  'queue:reprioritize': { emailId: string; priority: number };
}

// Server → Client events
export interface ServerEvents {
  'chat:chunk': { sessionId: string; content: string; agentId: string };
  'chat:message': { sessionId: string; message: import('./chat.js').ChatMessage };
  'chat:done': { sessionId: string };
  'chat:error': { sessionId: string; error: string };
  'chat:thinking': { sessionId: string; content: string; agentId: string; iteration: number };
  'chat:tool_call': { sessionId: string; toolName: string; toolArgs: Record<string, unknown>; toolCallId: string; agentId: string; iteration: number };
  'chat:tool_result': { sessionId: string; toolName: string; toolCallId: string; success: boolean; result: string; durationMs: number; agentId: string; iteration: number };
  'email:new': { email: import('./email.js').Email };
  'email:status': { emailId: string; isRead?: boolean; isProcessed?: boolean };
  'agent:created': { agent: import('./agent.js').Agent };
  'agent:status': { agentId: string; status: import('./agent.js').AgentStatus; detail?: string };
  'agent:log': { log: import('./agent.js').AgentLog };
  'agent:destroyed': { agentId: string };
  'tool:executed': { result: import('./tool.js').ToolCallResult; agentId: string };
  'metrics:update': { type: string; data: unknown };
  'queue:update': { stats: import('./metrics.js').QueueStats };
  'system:error': { message: string; code?: string };
}

export type WSClientEventName = keyof ClientEvents;
export type WSServerEventName = keyof ServerEvents;

export interface WSMessage<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
}
