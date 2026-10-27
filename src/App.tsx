import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  Compass,
  FilePlus2,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  AIAssessment,
  AIFeedbackEntry,
  AssignmentRecord,
  AuditLogEntry,
  Bureau,
  CaseAttachment,
  CaseComment,
  CategoryConfig,
  Complaint,
  ComplaintRelationship,
  ComplaintStatus,
  EscalationRecord,
  ImportJobRecord,
  Institution,
  InstitutionResponseItem,
  NotificationItem,
  PriorityConfig,
  PriorityLevel,
  SavedSearch,
  StatusTransitionEvent,
  UserProfile,
} from './db/types';
import { canUserPerformAction } from './db/rules';
import { CommandDashboard } from './components/CommandDashboard';
import { ComplaintWorkspace } from './components/ComplaintWorkspace';
import { ComplaintRegistration } from './components/ComplaintRegistration';
import { AIIntelligenceCenter } from './components/AIIntelligenceCenter';
import { OperationsAndGovernance } from './components/OperationsAndGovernance';
import { LoginPage } from './components/LoginPage';

type NavView =
  | 'DASHBOARD'
  | 'WORKSPACE'
  | 'REGISTER'
  | 'AI_CENTER'
  | 'ESCALATIONS'
  | 'BUREAUS'
  | 'INSTITUTIONS'
  | 'REPORTS'
  | 'AUDIT'
  | 'SETTINGS'
  | 'LOGIN';

interface BootstrapData {
  actor: UserProfile;
  organization: {
    code: string;
    name: string;
    tagline: string;
    isDemo: boolean;
    timezone: string;
    dataRetentionDays: number;
  };
  users: UserProfile[];
  bureaus: Bureau[];
  institutions: Institution[];
  categories: CategoryConfig[];
  priorities: PriorityConfig[];
  complaints: Complaint[];
  assignments: AssignmentRecord[];
  statusHistory: StatusTransitionEvent[];
  comments: CaseComment[];
  institutionResponses: InstitutionResponseItem[];
  attachments: CaseAttachment[];
  relationships: ComplaintRelationship[];
  escalations: EscalationRecord[];
  aiAssessments: Record<string, AIAssessment>;
  aiFeedback: AIFeedbackEntry[];
  notifications: NotificationItem[];
  auditLogs: AuditLogEntry[];
  savedSearches: SavedSearch[];
  importJobs: ImportJobRecord[];
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('aicte_hub_authenticated') === 'true';
    } catch {
      return false;
    }
  });
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('aicte_hub_user_id') || 'USR-CMO';
    } catch {
      return 'USR-CMO';
    }
  });
  const [activeView, setActiveView] = useState<NavView>('DASHBOARD');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showJudgeGuide, setShowJudgeGuide] = useState(false);

  const [data, setData] = useState<BootstrapData | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  // Selected Complaint & Drilldown State
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [workspaceFilter, setWorkspaceFilter] = useState<{
    status?: string;
    priority?: string;
    bureauId?: string;
    institutionId?: string;
    overdueOnly?: boolean;
  }>({});

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-actor-user-id': activeUserId,
        ...(options.headers as Record<string, string>),
      };
      const res = await fetch(url, { ...options, headers });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Request failed with status ${res.status}`);
      }
      return json;
    },
    [activeUserId]
  );

  const loadWorkspaceData = useCallback(async () => {
    try {
      setError(null);
      const [boot, sys] = await Promise.all([
        apiFetch('/api/bootstrap'),
        apiFetch('/api/system-status'),
      ]);
      setData(boot);
      setSystemStatus(sys);
      setLastUpdated(new Date().toISOString());
    } catch (err: any) {
      setError(err.message || 'Unable to load platform data.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const handleOpenComplaint = (complaintId: string) => {
    setSelectedComplaintId(complaintId);
    setActiveView('WORKSPACE');
    setShowNotifications(false);
  };

  const handleDrilldownFromDashboard = (filters: {
    status?: string;
    priority?: string;
    bureauId?: string;
    institutionId?: string;
    overdueOnly?: boolean;
  }) => {
    setSelectedComplaintId(null);
    setWorkspaceFilter(filters);
    setActiveView('WORKSPACE');
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-md w-full space-y-3 text-center">
          <div className="text-xs font-mono text-teal-800">INITIALIZING SECURE WORKSPACE</div>
          <h1 className="text-lg font-bold text-slate-900">AICTE Complaint Intelligence Hub</h1>
          <p className="text-xs text-slate-500">
            Loading official AICTE grievance records, RBAC policies, and regulatory intelligence assessments...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-300 rounded-lg p-6 max-w-md w-full space-y-4">
          <div className="text-xs font-mono text-red-700">CONNECTION OR INITIALIZATION ERROR</div>
          <h1 className="text-lg font-bold text-slate-900">Unable to Reach Backend API</h1>
          <p className="text-xs text-slate-600">{error}</p>
          <button
            type="button"
            onClick={loadWorkspaceData}
            className="w-full py-2 px-4 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { actor } = data;
  const unreadNotifications = data.notifications.filter((n) => !n.isRead).length;

  const handleLogin = (user: UserProfile) => {
    setActiveUserId(user.id);
    setIsAuthenticated(true);
    setActiveView('DASHBOARD');
    try {
      sessionStorage.setItem('aicte_hub_authenticated', 'true');
      sessionStorage.setItem('aicte_hub_user_id', user.id);
    } catch {}
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setSelectedComplaintId(null);
    setActiveView('DASHBOARD');
    try {
      sessionStorage.removeItem('aicte_hub_authenticated');
      sessionStorage.removeItem('aicte_hub_user_id');
    } catch {}
  };

  // Dedicated Government Portal Login Page
  if (!isAuthenticated || activeView === 'LOGIN') {
    return <LoginPage users={data.users} onLogin={handleLogin} />;
  }

  const navItems: {
    id: NavView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'DASHBOARD', label: 'Command Dashboard', icon: LayoutDashboard },
    { id: 'WORKSPACE', label: 'Complaint Management', icon: FolderKanban, badge: data.complaints.length },
    { id: 'REGISTER', label: 'Register Complaint', icon: FilePlus2 },
    { id: 'AI_CENTER', label: 'AI Intelligence & Duplicates', icon: Sparkles },
    { id: 'ESCALATIONS', label: 'Smart Escalation Center', icon: ShieldAlert, badge: data.escalations.length },
    { id: 'BUREAUS', label: 'Bureau / Cell Coordination', icon: Compass },
    { id: 'INSTITUTIONS', label: 'Institution Directory & CSV', icon: Building2 },
    { id: 'REPORTS', label: 'Reports & Analytics', icon: FileSpreadsheet },
    { id: 'AUDIT', label: 'Audit Trail Explorer', icon: ShieldCheck },
    { id: 'SETTINGS', label: 'Settings & Governance', icon: Settings },
  ];

  // Check role-level access for restricted pages
  const isAccessDeniedForCurrentView =
    (activeView === 'AUDIT' && !canUserPerformAction(actor, 'VIEW_AUDIT_LOGS')) ||
    (activeView === 'REGISTER' && !canUserPerformAction(actor, 'REGISTER_COMPLAINT'));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <div className="flex-1 flex min-h-0">
        {/* Collapsible Left Navigation Sidebar */}
        <aside
          aria-label="Primary Workspace Navigation"
          className={`hidden md:flex flex-col bg-slate-900 text-slate-200 border-r border-slate-800 transition-all no-print ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold text-white tracking-tight truncate">
                  AICTE Intelligence Hub
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  One Platform. Complete Accountability.
                </div>
              </div>
            )}
            <button
              type="button"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id !== 'WORKSPACE') {
                      setSelectedComplaintId(null);
                    }
                    setActiveView(item.id);
                  }}
                  title={item.label}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    active
                      ? 'bg-teal-700 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <span className="font-mono tabular-nums text-[11px] opacity-85">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active User & Role Switcher Footer in Sidebar */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
            {!sidebarCollapsed && (
              <div className="text-[11px]">
                <div className="text-slate-400 font-mono">ACTIVE ROLE SESSION</div>
                <div className="font-semibold text-white truncate">{actor.fullName}</div>
                <div className="text-teal-300 font-mono text-[10px]">{actor.role}</div>
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedComplaintId(null);
                  setActiveView('LOGIN');
                }}
                className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center gap-1.5 transition-colors"
                title="Switch Role Session"
              >
                <Users className="w-3.5 h-3.5" />
                {!sidebarCollapsed && <span>Switch Role</span>}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="py-1.5 px-2.5 text-xs font-medium text-red-300 bg-red-950/60 hover:bg-red-900/80 border border-red-800/50 rounded flex items-center justify-center gap-1 transition-colors"
                title="Sign out of current officer session"
              >
                <LogOut className="w-3.5 h-3.5" />
                {!sidebarCollapsed && <span>Logout</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navigation Bar (Strict 3-Zone Contract: Breadcrumb/Title — Role Switcher — Primary Actions) */}
          <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between gap-4 no-print">
            {/* Zone 1: Mobile Menu Trigger + Breadcrumb Trail */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="md:hidden p-1.5 text-slate-700 hover:bg-slate-100 rounded"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 truncate">
                <span className="font-bold text-slate-900">AICTE Complaint Intelligence Hub</span>
                <span aria-hidden="true">/</span>
                <span className="text-teal-800 font-semibold truncate">
                  {navItems.find((n) => n.id === activeView)?.label || 'Workspace'}
                </span>
                {selectedComplaintId && (
                  <>
                    <span aria-hidden="true">/</span>
                    <span className="font-mono text-slate-900">Case Detail</span>
                  </>
                )}
              </div>
            </div>

            {/* Zone 2: Quick Demo Role Switcher for Judges */}
            <div className="hidden lg:flex items-center gap-2">
              <label htmlFor="header-role-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Judge Role View:
              </label>
              <select
                id="header-role-select"
                value={activeUserId}
                onChange={(e) => {
                  setActiveUserId(e.target.value);
                  setSelectedComplaintId(null);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md font-medium text-slate-900"
              >
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.role} — {u.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Zone 3: Notification Center & Primary Register Action */}
            <div className="flex items-center gap-2.5 shrink-0 relative">
              <button
                type="button"
                aria-label={`Notifications (${unreadNotifications} unread)`}
                onClick={() => setShowNotifications((s) => !s)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Alerts ({unreadNotifications})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedComplaintId(null);
                  setActiveView('REGISTER');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Register Complaint
              </button>

              {/* Notification Center Popover */}
              {showNotifications && (
                <div className="absolute right-0 top-11 z-40 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      In-App Notification Center ({unreadNotifications} Unread)
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
                        await loadWorkspaceData();
                      }}
                      className="text-[11px] font-semibold text-teal-800 hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 text-xs">
                    {data.notifications.map((n) => (
                      <div key={n.id} className="py-2.5 space-y-1">
                        <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                          <span className={n.isRead ? 'text-slate-600' : 'font-bold text-teal-800'}>
                            {n.eventType}
                          </span>
                          <span>{n.createdAt.slice(0, 10)}</span>
                        </div>
                        <div className="font-semibold text-slate-900">{n.title}</div>
                        <p className="text-slate-600 text-[11px]">{n.message}</p>
                        <button
                          type="button"
                          onClick={() => handleOpenComplaint(n.complaintId)}
                          className="text-[11px] font-semibold text-teal-700 hover:underline"
                        >
                          Open {n.complaintRef} →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Responsive Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-slate-900 text-white p-4 space-y-2 border-b border-slate-800 no-print">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-mono text-teal-300">NAVIGATION & ROLE SWITCHER</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-xs text-slate-300"
                >
                  Close
                </button>
              </div>
              <div className="pb-2">
                <label htmlFor="mobile-role-select" className="block text-[11px] text-slate-400 mb-1">
                  Active Role Session:
                </label>
                <select
                  id="mobile-role-select"
                  value={activeUserId}
                  onChange={(e) => {
                    setActiveUserId(e.target.value);
                    setSelectedComplaintId(null);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white"
                >
                  {data.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.role} — {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedComplaintId(null);
                      setActiveView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`text-left px-3 py-2 text-xs rounded ${
                      activeView === item.id ? 'bg-teal-700 text-white font-semibold' : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="col-span-2 text-center py-2 text-xs rounded bg-red-950/70 text-red-200 border border-red-800/60 font-semibold"
                >
                  Sign Out of Officer Session
                </button>
              </div>
            </div>
          )}

          {/* Main Workspace Container */}
          <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
            {isAccessDeniedForCurrentView ? (
              <section className="bg-white border border-red-300 rounded-lg p-8 max-w-2xl mx-auto my-8 text-center space-y-4">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-xs font-mono text-red-700 font-semibold">
                  HTTP 403 · ROLE-BASED ACCESS CONTROL BOUNDARY ENFORCED
                </div>
                <h1 className="text-xl font-bold text-slate-900">
                  Access Restricted for Role: {actor.role}
                </h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your current active profile (<strong>{actor.fullName}</strong> — <code>{actor.role}</code>) does not hold authorization for this administrative module. For example, Read-Only Auditors cannot register complaints or mutate statuses, and Institution Liaison Officers cannot inspect internal security audit logs.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveView('DASHBOARD')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                  >
                    Return to Authorized Command Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('LOGIN')}
                    className="px-4 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md"
                  >
                    Switch Role Session
                  </button>
                </div>
              </section>
            ) : activeView === 'DASHBOARD' ? (
              <CommandDashboard
                complaints={data.complaints}
                bureaus={data.bureaus}
                institutions={data.institutions}
                statusHistory={data.statusHistory}
                priorities={data.priorities}
                lastUpdated={lastUpdated}
                onRefresh={loadWorkspaceData}
                onDrilldownFilter={handleDrilldownFromDashboard}
                onOpenComplaint={handleOpenComplaint}
              />
            ) : activeView === 'WORKSPACE' ? (
              <ComplaintWorkspace
                actor={actor}
                complaints={data.complaints}
                bureaus={data.bureaus}
                institutions={data.institutions}
                priorities={data.priorities}
                statusHistory={data.statusHistory}
                assignments={data.assignments}
                comments={data.comments}
                institutionResponses={data.institutionResponses}
                attachments={data.attachments}
                relationships={data.relationships}
                aiAssessments={data.aiAssessments}
                auditLogs={data.auditLogs}
                savedSearches={data.savedSearches}
                selectedComplaintId={selectedComplaintId}
                onSelectComplaint={setSelectedComplaintId}
                initialFilter={workspaceFilter}
                onAssignComplaint={async (complaintId, toBureauId, assignedOfficerName, reason) => {
                  await apiFetch(`/api/complaints/${complaintId}/assign`, {
                    method: 'POST',
                    body: JSON.stringify({ toBureauId, assignedOfficerName, reason }),
                  });
                  await loadWorkspaceData();
                }}
                onTransitionStatus={async (complaintId, targetStatus, reason, resolutionSummary) => {
                  await apiFetch(`/api/complaints/${complaintId}/status`, {
                    method: 'POST',
                    body: JSON.stringify({ targetStatus, reason, resolutionSummary }),
                  });
                  await loadWorkspaceData();
                }}
                onAddComment={async (complaintId, content, visibility, noteType) => {
                  await apiFetch(`/api/complaints/${complaintId}/comments`, {
                    method: 'POST',
                    body: JSON.stringify({ content, visibility, noteType }),
                  });
                  await loadWorkspaceData();
                }}
                onRequestInstitutionInfo={async (complaintId, requestQuestion, dueDays) => {
                  await apiFetch(`/api/complaints/${complaintId}/institution-request`, {
                    method: 'POST',
                    body: JSON.stringify({ requestQuestion, dueDays }),
                  });
                  await loadWorkspaceData();
                }}
                onSubmitInstitutionResponse={async (respId, responseText) => {
                  await apiFetch(`/api/institution-responses/${respId}/submit`, {
                    method: 'POST',
                    body: JSON.stringify({ responseText }),
                  });
                  await loadWorkspaceData();
                }}
                onRecordAIFeedback={async (
                  complaintId,
                  decision,
                  notes,
                  modifiedCategory,
                  modifiedPriority
                ) => {
                  await apiFetch(`/api/complaints/${complaintId}/ai-feedback`, {
                    method: 'POST',
                    body: JSON.stringify({
                      decision,
                      notes,
                      modifiedCategory,
                      modifiedPriority,
                    }),
                  });
                  await loadWorkspaceData();
                }}
                onDecideDuplicate={async (relId, status) => {
                  await apiFetch(`/api/relationships/${relId}/decision`, {
                    method: 'POST',
                    body: JSON.stringify({ status }),
                  });
                  await loadWorkspaceData();
                }}
              />
            ) : activeView === 'REGISTER' ? (
              <ComplaintRegistration
                actor={actor}
                institutions={data.institutions}
                bureaus={data.bureaus}
                categories={data.categories}
                onRunPrecheck={async (payload) => {
                  return apiFetch('/api/ai/precheck', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  });
                }}
                onSubmitComplaint={async (payload) => {
                  const res = await apiFetch('/api/complaints', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  });
                  await loadWorkspaceData();
                  return res;
                }}
                onOpenComplaint={handleOpenComplaint}
              />
            ) : activeView === 'AI_CENTER' ? (
              <AIIntelligenceCenter
                aiEngineLabel={systemStatus?.aiEngineLabel || 'Deterministic Rule-Based Assistance'}
                complaints={data.complaints}
                bureaus={data.bureaus}
                institutions={data.institutions}
                priorities={data.priorities}
                relationships={data.relationships}
                aiAssessments={data.aiAssessments}
                aiFeedback={data.aiFeedback}
                onDecideDuplicate={async (relId, status) => {
                  await apiFetch(`/api/relationships/${relId}/decision`, {
                    method: 'POST',
                    body: JSON.stringify({ status }),
                  });
                  await loadWorkspaceData();
                }}
                onRecordAIFeedback={async (complaintId, decision, notes) => {
                  await apiFetch(`/api/complaints/${complaintId}/ai-feedback`, {
                    method: 'POST',
                    body: JSON.stringify({ decision, notes }),
                  });
                  await loadWorkspaceData();
                }}
                onOpenComplaint={handleOpenComplaint}
              />
            ) : (
              <OperationsAndGovernance
                activeSection={
                  activeView as
                    | 'ESCALATIONS'
                    | 'BUREAUS'
                    | 'INSTITUTIONS'
                    | 'REPORTS'
                    | 'AUDIT'
                    | 'SETTINGS'
                }
                actor={actor}
                users={data.users}
                bureaus={data.bureaus}
                institutions={data.institutions}
                categories={data.categories}
                priorities={data.priorities}
                complaints={data.complaints}
                assignments={data.assignments}
                escalations={data.escalations}
                institutionResponses={data.institutionResponses}
                aiAssessments={data.aiAssessments}
                auditLogs={data.auditLogs}
                importJobs={data.importJobs}
                systemStatus={systemStatus}
                onAcknowledgeEscalation={async (escId) => {
                  await apiFetch(`/api/escalations/${escId}/acknowledge`, { method: 'POST' });
                  await loadWorkspaceData();
                }}
                onRecalculateSla={async () => {
                  await apiFetch('/api/escalations/recalculate', { method: 'POST' });
                  await loadWorkspaceData();
                }}
                onPreviewCsvImport={async (csvText) => {
                  return apiFetch('/api/institutions/import-preview', {
                    method: 'POST',
                    body: JSON.stringify({ csvText }),
                  });
                }}
                onCommitCsvImport={async (csvText, fileName) => {
                  await apiFetch('/api/institutions/import-commit', {
                    method: 'POST',
                    body: JSON.stringify({ csvText, fileName }),
                  });
                  await loadWorkspaceData();
                }}
                onUpdatePrioritySla={async (
                  priority,
                  responseTargetHours,
                  resolutionTargetDays,
                  warningThresholdPercent
                ) => {
                  await apiFetch('/api/settings/priority-sla', {
                    method: 'POST',
                    body: JSON.stringify({
                      priority,
                      responseTargetHours,
                      resolutionTargetDays,
                      warningThresholdPercent,
                    }),
                  });
                  await loadWorkspaceData();
                }}
                onRunDemoScenario={async (scenarioType) => {
                  await apiFetch('/api/demo/scenario', {
                    method: 'POST',
                    body: JSON.stringify({ scenarioType }),
                  });
                  await loadWorkspaceData();
                }}
                onOpenComplaint={handleOpenComplaint}
                onDrilldownBureau={(bureauId) => handleDrilldownFromDashboard({ bureauId })}
              />
            )}
          </main>

          {/* Clean Enterprise Footer */}
          <footer className="bg-white border-t border-slate-200 px-6 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2 no-print">
            <div>
              AICTE Central Complaint Intelligence Hub · Ministry of Education, Government of India
            </div>
            <div className="font-mono">
              Active Scope: {data.complaints.length} Complaints · {data.institutions.length} Institutions · {data.bureaus.length} Bureaus
            </div>
          </footer>
        </div>
      </div>

      {/* In-App "How to Explore the Platform" Guide Modal */}
      {showJudgeGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="judge-guide-title"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-mono text-teal-800">
                  SYSTEM OVERVIEW & FEATURE GUIDE
                </p>
                <h2 id="judge-guide-title" className="text-lg font-bold text-slate-900">
                  How to Explore the AICTE Complaint Intelligence Hub
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowJudgeGuide(false)}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <p>
                <strong>Product Positioning:</strong> AICTE Complaint Intelligence Hub is an integrated platform that helps authorized stakeholders monitor institutional complaints across configured bureaus and cells, identify backlogs, coordinate investigations, manage escalation, and improve accountability through explainable AI-assisted insights.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                <div className="font-bold text-slate-900">5-Minute End-to-End Operational Walkthrough:</div>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>
                    <strong>Command Dashboard & Heatmap:</strong> Inspect database-derived KPIs, the Bureau × Priority Case Ageing Heatmap, and the Bottleneck Detector. Click any metric card or heatmap cell to drill into matching complaints.
                  </li>
                  <li>
                    <strong>Register a Complaint with AI Pre-Check:</strong> Open <em>Register Complaint</em>, click <em>Autofill Verified Incident Record</em>, and run the <em>AI Classification & Duplicate Pre-Check</em> before submitting to generate a unique <code>AICTE-2026-XXXXX</code> reference.
                  </li>
                  <li>
                    <strong>Investigate, Request Institution Reply & Resolve:</strong> Open any complaint in <em>Complaint Management</em> to view its 7 tabs (Overview, Smart Timeline, Investigation Notes, Institution Responses, Explainable AI, Duplicates, Audit Trail). Transition statuses or route across bureaus.
                  </li>
                  <li>
                    <strong>Contextual AI Assistant & Duplicate Network:</strong> Open <em>AI Intelligence & Duplicates</em> to ask live database questions or confirm/dismiss suspected duplicate links.
                  </li>
                  <li>
                    <strong>Test Role-Based Security Boundaries:</strong> Use the <em>Judge Role View</em> selector in the top header to switch to <code>INSTITUTION_LIAISON</code> (scoped strictly to Vanguard Technical Institute, with internal bureau notes hidden) or <code>AUDITOR</code> (read-only access with status transitions blocked).
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowJudgeGuide(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md"
              >
                Start Exploring
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
