import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Mail,
  MessageSquare,
  Bot,
  Users,
  Wrench,
  Zap,
  BarChart3,
  SlidersHorizontal,
  Settings,
  ChevronLeft,
  ChevronRight,
  Circle,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import { useStore } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import TopBar from './TopBar';

const navItems = [
  { to: '/', label: 'Chat', icon: MessageSquare },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/emails', label: 'Emails', icon: Mail },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/skills', label: 'Skills', icon: Zap },
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
  { to: '/tuning', label: 'Tuning', icon: SlidersHorizontal },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  useWebSocket();
  const [collapsed, setCollapsed] = useState(false);
  const connected = useStore((s) => s.connected);
  const systemStatus = useStore((s) => s.systemStatus);
  const freezeOperations = useStore((s) => s.freezeOperations);
  const resumeOperations = useStore((s) => s.resumeOperations);
  const stopAllOperations = useStore((s) => s.stopAllOperations);

  const isPaused = systemStatus?.queuePaused ?? false;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo / Title */}
        <div className="flex items-center h-14 px-4 border-b border-gray-200 dark:border-gray-800">
          <Bot className="w-6 h-6 text-primary-600 flex-shrink-0" />
          {!collapsed && (
            <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white truncate">
              Mailgent
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center px-4 py-2.5 mx-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="ml-3 truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: controls + connection status + collapse toggle */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-2">
          {/* Freeze / Stop controls */}
          <div className={`flex ${collapsed ? 'flex-col' : ''} gap-1`}>
            {isPaused ? (
              <button
                onClick={() => resumeOperations()}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 ${collapsed ? 'px-1.5' : 'flex-1 px-2'}`}
                title="Resume operations"
              >
                <Play className="w-3.5 h-3.5 flex-shrink-0" />
                {!collapsed && <span>Resume</span>}
              </button>
            ) : (
              <button
                onClick={() => freezeOperations()}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 ${collapsed ? 'px-1.5' : 'flex-1 px-2'}`}
                title="Freeze — pause queue (running tasks finish)"
              >
                <Pause className="w-3.5 h-3.5 flex-shrink-0" />
                {!collapsed && <span>Freeze</span>}
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('Stop ALL agents and clear the queue?')) {
                  stopAllOperations();
                }
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 ${collapsed ? 'px-1.5' : 'flex-1 px-2'}`}
              title="Stop All — abort agents & clear queue"
            >
              <Square className="w-3.5 h-3.5 flex-shrink-0" />
              {!collapsed && <span>Stop All</span>}
            </button>
          </div>

          {/* Connection status */}
          <div className="flex items-center px-1">
            <Circle
              className={`w-3 h-3 flex-shrink-0 ${
                connected
                  ? isPaused
                    ? 'text-yellow-500 fill-yellow-500'
                    : 'text-green-500 fill-green-500'
                  : 'text-red-500 fill-red-500'
              }`}
            />
            {!collapsed && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                {!connected ? 'Disconnected' : isPaused ? 'Paused' : 'Connected'}
              </span>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
