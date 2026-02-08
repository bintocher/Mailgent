// ---------------------------------------------------------------------------
// Generic helper
// ---------------------------------------------------------------------------
const BASE_URL = '/api';
export class ApiError extends Error {
    status;
    statusText;
    body;
    constructor(status, statusText, body) {
        super(`API ${status} ${statusText}`);
        this.status = status;
        this.statusText = statusText;
        this.body = body;
        this.name = 'ApiError';
    }
}
async function api(path, options) {
    const url = `${BASE_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options?.headers,
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        let body;
        try {
            body = await res.json();
        }
        catch {
            body = await res.text().catch(() => null);
        }
        throw new ApiError(res.status, res.statusText, body);
    }
    // 204 No Content
    if (res.status === 204) {
        return undefined;
    }
    return res.json();
}
// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
export function fetchAgents() {
    return api('/agents');
}
export function createAgent(params) {
    return api('/agents', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
export function updateAgent(id, params) {
    return api(`/agents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(params),
    });
}
export function deleteAgent(id) {
    return api(`/agents/${id}`, { method: 'DELETE' });
}
export function stopAgent(id) {
    return api(`/agents/${id}/stop`, { method: 'POST' });
}
export function startAgent(id) {
    return api(`/agents/${id}/start`, { method: 'POST' });
}
// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------
export function fetchGroups() {
    return api('/groups');
}
export function createGroup(params) {
    return api('/groups', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
export function updateGroup(id, params) {
    return api(`/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(params),
    });
}
export function deleteGroup(id) {
    return api(`/groups/${id}`, { method: 'DELETE' });
}
export function assignToGroup(groupId, agentId) {
    return api(`/groups/${groupId}/agents`, {
        method: 'POST',
        body: JSON.stringify({ agentId }),
    });
}
// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------
export function fetchEmails(filter) {
    const params = filter
        ? '?' + new URLSearchParams(Object.entries(filter)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])).toString()
        : '';
    return api(`/emails${params}`);
}
export function fetchEmailThreads() {
    return api('/emails/threads');
}
export function fetchEmail(id) {
    return api(`/emails/${id}`);
}
export function deleteAllEmails() {
    return api('/emails', { method: 'DELETE' });
}
// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
export function fetchTools() {
    return api('/tools');
}
export function createTool(params) {
    return api('/tools', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
export function updateTool(id, params) {
    return api(`/tools/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(params),
    });
}
export function deleteTool(id) {
    return api(`/tools/${id}`, { method: 'DELETE' });
}
// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------
export function fetchSkills() {
    return api('/skills');
}
export function createSkill(params) {
    return api('/skills', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
export function updateSkill(id, params) {
    return api(`/skills/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(params),
    });
}
export function deleteSkill(id) {
    return api(`/skills/${id}`, { method: 'DELETE' });
}
// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
export function fetchProviders() {
    return api('/providers');
}
export function createProvider(params) {
    return api('/providers', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
export function updateProviderApi(id, params) {
    return api(`/providers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(params),
    });
}
export function deleteProvider(id) {
    return api(`/providers/${id}`, { method: 'DELETE' });
}
export function testProviderConfig(params) {
    return api('/providers/test', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
export function testProviderById(id) {
    return api(`/providers/${id}/test`, { method: 'POST' });
}
export function fetchProviderModels(id) {
    return api(`/providers/${id}/models`, { method: 'POST' });
}
export function updateProviderModels(id, models) {
    return api(`/providers/${id}/models`, {
        method: 'PATCH',
        body: JSON.stringify({ models }),
    });
}
// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function fetchGlobalSettings() {
    return api('/settings/global');
}
export function updateGlobalSettings(params) {
    return api('/settings/global', {
        method: 'PUT',
        body: JSON.stringify(params),
    });
}
export function fetchProjectSettings() {
    return api('/settings/project');
}
export function updateProjectSettings(params) {
    return api('/settings/project', {
        method: 'PUT',
        body: JSON.stringify(params),
    });
}
// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export function fetchChatSessions() {
    return api('/chat/sessions');
}
export function fetchChatMessages(sessionId) {
    return api(`/chat/sessions/${sessionId}/messages`);
}
// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
export function fetchTokenMetrics(range) {
    const params = range
        ? '?' + new URLSearchParams(Object.entries(range).map(([k, v]) => [k, String(v)])).toString()
        : '';
    return api(`/metrics/tokens${params}`);
}
export function fetchLLMPerformance() {
    return api('/metrics/llm');
}
export function fetchAgentMetrics() {
    return api('/metrics/agents');
}
export function fetchQueueStats() {
    return api('/metrics/queue');
}
// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------
export function fetchHealth() {
    return api('/health');
}
export function fetchSystemStatus() {
    return api('/system/status');
}
export function freezeSystem() {
    return api('/system/freeze', { method: 'POST' });
}
export function resumeSystem() {
    return api('/system/resume', { method: 'POST' });
}
export function stopAllOperations() {
    return api('/system/stop-all', { method: 'POST' });
}
export function openProject(workDir) {
    return api('/project/open', {
        method: 'POST',
        body: JSON.stringify({ workDir }),
    });
}
export function browseDirectories(dirPath) {
    const params = dirPath ? '?' + new URLSearchParams({ path: dirPath }).toString() : '';
    return api(`/system/browse${params}`);
}
