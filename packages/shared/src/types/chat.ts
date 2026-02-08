export type ChatMessageType = 'user' | 'assistant' | 'thinking' | 'tool_call' | 'tool_result' | 'error';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  type?: ChatMessageType;
  agentId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatSendRequest {
  sessionId?: string;
  content: string;
}
