import { useEffect, useRef } from 'react';
import { wsClient } from '../api/ws-client';
import { useStore } from '../store';
/**
 * Hook that manages the WebSocket connection lifecycle and dispatches
 * incoming server events to the Zustand store.
 *
 * Mount this once near the root of the component tree (e.g. inside `<App />`).
 */
export function useWebSocket() {
    const mountedRef = useRef(false);
    // Pull store actions once so we have stable references.
    const updateAgentInList = useStore((s) => s.updateAgentInList);
    const updateAgentStatus = useStore((s) => s.updateAgentStatus);
    const removeAgentFromList = useStore((s) => s.removeAgentFromList);
    const addEmail = useStore((s) => s.addEmail);
    const updateEmailStatus = useStore((s) => s.updateEmailStatus);
    const addChatMessage = useStore((s) => s.addChatMessage);
    const setChatSessionId = useStore((s) => s.setChatSessionId);
    const setIsStreaming = useStore((s) => s.setIsStreaming);
    const appendStreamingContent = useStore((s) => s.appendStreamingContent);
    const clearStreamingContent = useStore((s) => s.clearStreamingContent);
    const addAgenticStep = useStore((s) => s.addAgenticStep);
    const setPendingFinalMessage = useStore((s) => s.setPendingFinalMessage);
    const finalizeChatResponse = useStore((s) => s.finalizeChatResponse);
    const setQueueStats = useStore((s) => s.setQueueStats);
    const setConnected = useStore((s) => s.setConnected);
    const fetchTokenMetrics = useStore((s) => s.fetchTokenMetrics);
    const fetchAgentMetrics = useStore((s) => s.fetchAgentMetrics);
    useEffect(() => {
        // Guard against StrictMode double-mount
        if (mountedRef.current)
            return;
        mountedRef.current = true;
        // ----- Connection lifecycle events -------------------------------------
        const onConnected = () => {
            setConnected(true);
        };
        const onDisconnected = () => {
            setConnected(false);
        };
        // ----- Chat events -----------------------------------------------------
        const onChatChunk = (data) => {
            const { content } = data;
            appendStreamingContent(content);
        };
        const onChatMessage = (data) => {
            const { sessionId, message } = data;
            // Capture sessionId from server so subsequent messages go to the same session
            if (sessionId) {
                setChatSessionId(sessionId);
            }
            setPendingFinalMessage(message);
        };
        const onChatDone = (_data) => {
            finalizeChatResponse();
        };
        const onChatThinking = (data) => {
            const { content, iteration } = data;
            addAgenticStep({
                id: `thinking-${Date.now()}-${iteration}`,
                type: 'thinking',
                content,
                iteration,
                timestamp: new Date().toISOString(),
            });
        };
        const onChatToolCall = (data) => {
            const { toolName, toolArgs, toolCallId, iteration } = data;
            addAgenticStep({
                id: `tool-call-${toolCallId}`,
                type: 'tool_call',
                content: `Calling ${toolName}`,
                toolName,
                toolArgs,
                toolCallId,
                iteration,
                timestamp: new Date().toISOString(),
            });
        };
        const onChatToolResult = (data) => {
            const { toolName, toolCallId, success, result, durationMs, iteration } = data;
            addAgenticStep({
                id: `tool-result-${toolCallId}`,
                type: 'tool_result',
                content: result,
                toolName,
                toolCallId,
                success,
                durationMs,
                iteration,
                timestamp: new Date().toISOString(),
            });
        };
        // Direct message from an agent (e.g. Master receiving email results).
        // Bypasses the pending/finalize flow to avoid interfering with streaming chat.
        const onChatAgentMessage = (data) => {
            const { sessionId, message } = data;
            if (sessionId) {
                setChatSessionId(sessionId);
            }
            addChatMessage(message);
        };
        const onChatError = (data) => {
            const { error, sessionId } = data;
            console.error('[WS] chat:error:', error);
            // Add error as a system message so user sees it
            addChatMessage({
                id: `error-${Date.now()}`,
                sessionId: sessionId || '',
                role: 'assistant',
                content: `Error: ${error}`,
                type: 'error',
                timestamp: new Date().toISOString(),
            });
            finalizeChatResponse();
        };
        // ----- Email events ----------------------------------------------------
        const onEmailNew = (data) => {
            const { email } = data;
            addEmail(email);
        };
        const onEmailStatus = (data) => {
            const { emailId, isRead, isProcessed } = data;
            updateEmailStatus(emailId, { isRead, isProcessed });
        };
        // ----- Agent events ----------------------------------------------------
        const onAgentCreated = (data) => {
            const { agent } = data;
            updateAgentInList(agent);
        };
        const onAgentStatus = (data) => {
            const { agentId, status } = data;
            updateAgentStatus(agentId, status);
        };
        const onAgentLog = (_data) => {
            // AgentLog events can be handled by components that subscribe
            // directly via wsClient.on('agent:log', ...).  For now we just
            // acknowledge the event.
            const _log = _data.log;
            // Future: could push to a per-agent log buffer in the store.
        };
        const onAgentDestroyed = (data) => {
            const { agentId } = data;
            removeAgentFromList(agentId);
        };
        // ----- Tool events -----------------------------------------------------
        const onToolExecuted = (_data) => {
            // Components can listen directly if they need per-tool-call updates.
            const _result = _data.result;
        };
        // ----- Metrics events --------------------------------------------------
        const onMetricsUpdate = (data) => {
            const { type } = data;
            // Refresh relevant metrics slice based on the type hint.
            if (type === 'tokens') {
                fetchTokenMetrics();
            }
            else if (type === 'agents') {
                fetchAgentMetrics();
            }
        };
        const onQueueUpdate = (data) => {
            const { stats } = data;
            setQueueStats(stats);
        };
        // ----- System events ---------------------------------------------------
        const onSystemError = (data) => {
            const { message, code } = data;
            console.error(`[WS] system:error (${code ?? 'unknown'}): ${message}`);
        };
        // ----- Register listeners and connect ----------------------------------
        wsClient.on('_connected', onConnected);
        wsClient.on('_disconnected', onDisconnected);
        wsClient.on('chat:chunk', onChatChunk);
        wsClient.on('chat:message', onChatMessage);
        wsClient.on('chat:agent_message', onChatAgentMessage);
        wsClient.on('chat:done', onChatDone);
        wsClient.on('chat:error', onChatError);
        wsClient.on('chat:thinking', onChatThinking);
        wsClient.on('chat:tool_call', onChatToolCall);
        wsClient.on('chat:tool_result', onChatToolResult);
        wsClient.on('email:new', onEmailNew);
        wsClient.on('email:status', onEmailStatus);
        wsClient.on('agent:created', onAgentCreated);
        wsClient.on('agent:status', onAgentStatus);
        wsClient.on('agent:log', onAgentLog);
        wsClient.on('agent:destroyed', onAgentDestroyed);
        wsClient.on('tool:executed', onToolExecuted);
        wsClient.on('metrics:update', onMetricsUpdate);
        wsClient.on('queue:update', onQueueUpdate);
        wsClient.on('system:error', onSystemError);
        wsClient.connect();
        // ----- Cleanup ---------------------------------------------------------
        return () => {
            mountedRef.current = false;
            wsClient.off('_connected', onConnected);
            wsClient.off('_disconnected', onDisconnected);
            wsClient.off('chat:chunk', onChatChunk);
            wsClient.off('chat:message', onChatMessage);
            wsClient.off('chat:agent_message', onChatAgentMessage);
            wsClient.off('chat:done', onChatDone);
            wsClient.off('chat:error', onChatError);
            wsClient.off('chat:thinking', onChatThinking);
            wsClient.off('chat:tool_call', onChatToolCall);
            wsClient.off('chat:tool_result', onChatToolResult);
            wsClient.off('email:new', onEmailNew);
            wsClient.off('email:status', onEmailStatus);
            wsClient.off('agent:created', onAgentCreated);
            wsClient.off('agent:status', onAgentStatus);
            wsClient.off('agent:log', onAgentLog);
            wsClient.off('agent:destroyed', onAgentDestroyed);
            wsClient.off('tool:executed', onToolExecuted);
            wsClient.off('metrics:update', onMetricsUpdate);
            wsClient.off('queue:update', onQueueUpdate);
            wsClient.off('system:error', onSystemError);
            wsClient.disconnect();
        };
    }, [
        updateAgentInList,
        updateAgentStatus,
        removeAgentFromList,
        addEmail,
        updateEmailStatus,
        addChatMessage,
        setChatSessionId,
        setIsStreaming,
        appendStreamingContent,
        clearStreamingContent,
        addAgenticStep,
        setPendingFinalMessage,
        finalizeChatResponse,
        setQueueStats,
        setConnected,
        fetchTokenMetrics,
        fetchAgentMetrics,
    ]);
}
