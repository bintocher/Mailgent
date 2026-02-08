import { useEffect, useState } from 'react';
import { Mail, Search, Paperclip, Trash2 } from 'lucide-react';
import { useStore } from '@/store';
import type { Email } from '@mailgent/shared';

export default function EmailsPage() {
  const emails = useStore((s) => s.emails);
  const agents = useStore((s) => s.agents);
  const fetchEmails = useStore((s) => s.fetchEmails);
  const fetchAgents = useStore((s) => s.fetchAgents);
  const deleteAllEmails = useStore((s) => s.deleteAllEmails);

  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  useEffect(() => {
    fetchEmails();
    fetchAgents();
  }, [fetchEmails, fetchAgents]);

  const filteredEmails = emails.filter((email) => {
    const matchesSearch =
      !searchQuery ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAgent = !agentFilter || email.agentId === agentFilter;
    return matchesSearch && matchesAgent;
  });

  return (
    <div className="flex h-full">
      {/* Left panel - Email list */}
      <div className="w-96 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Emails
            </h1>
            {emails.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Delete all emails? This cannot be undone.')) {
                    deleteAllEmails();
                  }
                }}
                className="btn-danger text-xs flex items-center gap-1 px-2 py-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete All
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="input"
          >
            <option value="">All Agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {filteredEmails.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No emails found.</p>
          ) : (
            filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`w-full text-left p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedEmail?.id === email.id
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm truncate ${
                      !email.isRead
                        ? 'font-bold text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {email.from}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {!email.isRead && (
                      <span className="badge-blue">new</span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatTime(email.createdAt)}
                    </span>
                  </div>
                </div>
                <p
                  className={`text-sm truncate ${
                    !email.isRead
                      ? 'font-semibold text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {email.subject}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                  {email.body.slice(0, 100)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel - Email detail */}
      <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto">
        {selectedEmail ? (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedEmail.subject}
              </h2>
              <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">From:</span>{' '}
                  {selectedEmail.from}
                </p>
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">To:</span>{' '}
                  {selectedEmail.to.join(', ')}
                </p>
                {selectedEmail.cc && selectedEmail.cc.length > 0 && (
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-300">CC:</span>{' '}
                    {selectedEmail.cc.join(', ')}
                  </p>
                )}
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Date:</span>{' '}
                  {new Date(selectedEmail.createdAt).toLocaleString()}
                </p>
                {selectedEmail.agentId && (
                  <p>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Agent:</span>{' '}
                    {agents.find((a) => a.id === selectedEmail.agentId)?.name ??
                      selectedEmail.agentId}
                  </p>
                )}
              </div>
            </div>

            {/* Status badges */}
            <div className="flex gap-2">
              <span className={selectedEmail.isRead ? 'badge-gray' : 'badge-blue'}>
                {selectedEmail.isRead ? 'Read' : 'Unread'}
              </span>
              <span className={selectedEmail.isProcessed ? 'badge-green' : 'badge-yellow'}>
                {selectedEmail.isProcessed ? 'Processed' : 'Pending'}
              </span>
              {selectedEmail.priority > 0 && (
                <span className="badge-red">Priority {selectedEmail.priority}</span>
              )}
            </div>

            {/* Attachments */}
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4" />
                  Attachments ({selectedEmail.attachments.length})
                </p>
                <div className="space-y-1">
                  {selectedEmail.attachments.map((att, i) => (
                    <div
                      key={i}
                      className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"
                    >
                      <span>{att.filename}</span>
                      <span className="text-xs text-gray-400">
                        ({(att.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email body */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                {selectedEmail.body}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select an email to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = diff / (1000 * 60 * 60);

  if (hours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
