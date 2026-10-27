import React, { useMemo, useState, useRef, useEffect, useId } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  FolderKanban,
  HelpCircle,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Bureau,
  Complaint,
  ComplaintStatus,
  Institution,
  PriorityConfig,
  PriorityLevel,
  StatusTransitionEvent,
} from '../db/types';
import { computeDashboardAnalytics } from '../db/rules';

export interface InfoTooltipProps {
  title?: string;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
  detail?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  content,
  position = 'top',
  ariaLabel,
  className = '',
  size = 'sm',
  detail,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const getPlacementClass = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-1.5';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-1.5';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-1.5';
      case 'top':
      case 'auto':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-1.5';
    }
  };

  const iconDim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }
        }}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-label={ariaLabel || (title ? `Help: ${title}` : 'Contextual guidance')}
        className={`inline-flex items-center justify-center p-0.5 rounded text-slate-400 hover:text-teal-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600 transition-colors cursor-pointer ${className}`}
      >
        <HelpCircle className={iconDim} aria-hidden="true" />
      </span>

      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${getPlacementClass()} z-50 w-64 sm:w-72 p-2.5 rounded-lg bg-slate-900/95 text-slate-100 text-xs shadow-xl border border-slate-700 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100 text-left cursor-default pointer-events-auto`}
        >
          <span className="flex items-start justify-between gap-1.5 pb-1 border-b border-slate-800">
            <span className="font-semibold text-teal-300 text-[11px] uppercase tracking-wider">
              {title || 'Guidance'}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                }
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close tooltip"
            >
              <X className="w-3 h-3" />
            </span>
          </span>

          <span className="block text-slate-200 mt-1.5 leading-relaxed font-normal normal-case">
            {content}
          </span>

          {detail && (
            <span className="block mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-teal-200/90 font-mono">
              {detail}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

interface CommandDashboardProps {
  complaints: Complaint[];
  bureaus: Bureau[];
  institutions: Institution[];
  statusHistory: StatusTransitionEvent[];
  priorities: PriorityConfig[];
  lastUpdated: string;
  onRefresh: () => void;
  onDrilldownFilter: (filters: {
    status?: string;
    priority?: string;
    bureauId?: string;
    institutionId?: string;
    overdueOnly?: boolean;
  }) => void;
  onOpenComplaint: (complaintId: string) => void;
}

export const CommandDashboard: React.FC<CommandDashboardProps> = ({
  complaints,
  bureaus,
  institutions,
  statusHistory,
  priorities,
  lastUpdated,
  onRefresh,
  onDrilldownFilter,
  onOpenComplaint,
}) => {
  const [dateRange, setDateRange] = useState<'ALL' | '30D' | '90D'>('ALL');
  const [selectedBureau, setSelectedBureau] = useState<string>('ALL');
  const [selectedInstitution, setSelectedInstitution] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showBriefModal, setShowBriefModal] = useState(false);

  const filteredComplaints = useMemo(() => {
    const nowMs = new Date('2026-10-26T12:00:00.000Z').getTime();
    return complaints.filter((c) => {
      if (selectedBureau !== 'ALL' && c.bureauId !== selectedBureau) return false;
      if (selectedInstitution !== 'ALL' && c.institutionId !== selectedInstitution) return false;
      if (selectedPriority !== 'ALL' && c.priority !== selectedPriority) return false;
      if (selectedStatus !== 'ALL' && c.status !== selectedStatus) return false;
      if (dateRange !== 'ALL') {
        const days = dateRange === '30D' ? 30 : 90;
        const diffDays = (nowMs - new Date(c.submittedAt).getTime()) / (1000 * 3600 * 24);
        if (diffDays > days) return false;
      }
      return true;
    });
  }, [complaints, selectedBureau, selectedInstitution, selectedPriority, selectedStatus, dateRange]);

  const analytics = useMemo(
    () =>
      computeDashboardAnalytics(
        filteredComplaints,
        bureaus,
        institutions,
        statusHistory,
        priorities,
        '2026-10-26T12:00:00.000Z'
      ),
    [filteredComplaints, bureaus, institutions, statusHistory, priorities]
  );

  const handleExportDashboardCsv = () => {
    const headers = [
      'Reference',
      'Title',
      'Category',
      'Institution',
      'State',
      'Bureau',
      'Priority',
      'Status',
      'SubmittedAt',
      'SLADueAt',
      'Overdue',
    ];
    const rows = filteredComplaints.map((c) => [
      c.referenceNumber,
      `"${c.title.replace(/"/g, '""')}"`,
      `"${c.category}"`,
      `"${c.institutionName}"`,
      c.state,
      c.bureauId,
      c.priority,
      c.status,
      c.submittedAt.slice(0, 10),
      c.slaDueAt.slice(0, 10),
      c.isOverdue ? 'YES' : 'NO',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AICTE_Command_Dashboard_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setDateRange('ALL');
    setSelectedBureau('ALL');
    setSelectedInstitution('ALL');
    setSelectedPriority('ALL');
    setSelectedStatus('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Executive Positioning & Filter Control Bar */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-teal-800 tracking-wide">
              Consolidated Inter-Bureau Command Workspace · Real-Time Database Aggregation
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Central Institutional Complaint Command Dashboard
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl">
              AICTE Complaint Intelligence Hub is a proposed integrated platform that helps authorized stakeholders monitor institutional complaints across configured bureaus and cells, identify backlogs, coordinate investigations, manage escalation, and improve accountability through explainable AI-assisted insights.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-mono tabular-nums mr-1">
              Synced: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Data
            </button>
            <button
              type="button"
              onClick={() => setShowBriefModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              Generate Management Brief
            </button>
            <button
              type="button"
              onClick={handleExportDashboardCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export Filtered CSV
            </button>
          </div>
        </div>

        {/* Multi-Dimensional Filter Controls */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label htmlFor="dash-date-filter" className="flex items-center gap-1 text-xs font-medium text-slate-700 mb-1">
              <span>Submission Window</span>
              <InfoTooltip
                title="Registration Date Boundary"
                content="Filters analytics by initial complaint submission date. Defaults to all 2026 records."
                position="bottom"
              />
            </label>
            <select
              id="dash-date-filter"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'ALL' | '30D' | '90D')}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              <option value="ALL">All Recorded Periods (2026)</option>
              <option value="90D">Last 90 Days</option>
              <option value="30D">Last 30 Days</option>
            </select>
          </div>

          <div>
            <label htmlFor="dash-bureau-filter" className="flex items-center gap-1 text-xs font-medium text-slate-700 mb-1">
              <span>Bureau / Cell</span>
              <InfoTooltip
                title="Operational Bureau"
                content="Filters cases assigned to a specific AICTE bureau or specialized grievance cell."
                position="bottom"
              />
            </label>
            <select
              id="dash-bureau-filter"
              value={selectedBureau}
              onChange={(e) => setSelectedBureau(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              <option value="ALL">All Configured Bureaus ({bureaus.length})</option>
              {bureaus.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dash-inst-filter" className="flex items-center gap-1 text-xs font-medium text-slate-700 mb-1">
              <span>Institution</span>
              <InfoTooltip
                title="Technical Institution"
                content="Filter dashboard analytics by a specific technical university or college campus."
                position="bottom"
              />
            </label>
            <select
              id="dash-inst-filter"
              value={selectedInstitution}
              onChange={(e) => setSelectedInstitution(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              <option value="ALL">All Institutions ({institutions.length})</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.institutionCode} — {i.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dash-priority-filter" className="flex items-center gap-1 text-xs font-medium text-slate-700 mb-1">
              <span>Priority Level</span>
              <InfoTooltip
                title="Severity Rating"
                content="Filter by urgency tier governing statutory resolution target deadlines (Critical: 5d, High: 10d, Med: 15d, Low: 21d)."
                position="bottom"
              />
            </label>
            <select
              id="dash-priority-filter"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical Priority</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          <div>
            <label htmlFor="dash-status-filter" className="flex items-center gap-1 text-xs font-medium text-slate-700 mb-1">
              <span>Lifecycle Stage</span>
              <InfoTooltip
                title="Procedural Workflow Stage"
                content="Filter complaints by their current operational state across the 11-stage AICTE adjudication workflow."
                position="bottom"
              />
            </label>
            <select
              id="dash-status-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              <option value="ALL">All Lifecycle Stages</option>
              <option value="Received">Received</option>
              <option value="Pending Assignment">Pending Assignment</option>
              <option value="Assigned">Assigned</option>
              <option value="Under Investigation">Under Investigation</option>
              <option value="Awaiting Institution Response">Awaiting Institution Response</option>
              <option value="Resolution Proposed">Resolution Proposed</option>
              <option value="Resolution Under Review">Resolution Under Review</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
              <option value="Reopened">Reopened</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </section>

      {/* Primary Clickable KPI Grid (10 Metrics Computed from Database) */}
      <section aria-label="Key Operational Metrics" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => onDrilldownFilter({})}
          className="text-left bg-white border border-slate-200 hover:border-teal-700 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Total Complaints</span>
              <InfoTooltip
                title="Total Grievance Scope"
                content="Aggregated count of all formal student, faculty, and institutional complaints recorded within the active bureau and date filters."
                detail="Click card to reset filters and view full register"
              />
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {analytics.kpis.total}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            In active filter scope · Click to view all
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrilldownFilter({ status: 'Received' })}
          className="text-left bg-white border border-slate-200 hover:border-teal-700 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Newly Received / Intake</span>
              <InfoTooltip
                title="Intake Stage"
                content="Grievances registered through the portal currently pending initial administrative screening, verification of supporting documents, and bureau routing."
                detail="SLA Clock starts immediately upon generation of Reference ID"
              />
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {analytics.kpis.newlyReceived + analytics.kpis.awaitingAssignment}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.kpis.awaitingAssignment} awaiting bureau assignment
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrilldownFilter({ status: 'Under Investigation' })}
          className="text-left bg-white border border-slate-200 hover:border-teal-700 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Under Investigation</span>
              <InfoTooltip
                title="Active Bureau Investigation"
                content="Complaints assigned to designated AICTE enquiry officers actively undergoing evidentiary audit, hearings, or field inspections."
                detail="Standard investigation phase governed by priority SLA"
              />
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-teal-800 mt-1.5">
            {analytics.kpis.underInvestigation}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Active bureau inquiry in progress
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrilldownFilter({ status: 'Awaiting Institution Response' })}
          className="text-left bg-white border border-slate-200 hover:border-teal-700 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Awaiting Institution Reply</span>
              <InfoTooltip
                title="Show-Cause / Clarification Notice"
                content="Formal inquiry letter or show-cause directive issued to the college principal or registrar. Failure to respond within 7 days triggers automatic Level 2 escalation."
                detail="Direct regulatory notice served to institution leadership"
              />
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1.5">
            {analytics.kpis.awaitingInstitution}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Show-cause / clarification pending
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrilldownFilter({ overdueOnly: true })}
          className="text-left bg-white border border-slate-200 hover:border-red-600 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-red-700">
            <span className="inline-flex items-center gap-1">
              <span>Overdue & SLA Breached</span>
              <InfoTooltip
                title="SLA Breach & Escalation Trigger"
                content="Unresolved grievances that have surpassed their priority-specific regulatory timeline (Critical: 5d, High: 10d, Med: 15d, Low: 21d). Flagged for supervisory sanction."
                detail="Auto-escalates to Bureau Head / Member Secretary"
              />
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1.5">
            {analytics.kpis.overdueCount}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {analytics.kpis.escalated} in active escalation track
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrilldownFilter({ priority: 'Critical' })}
          className="text-left bg-white border border-slate-200 hover:border-red-600 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Critical Priority Cases</span>
              <InfoTooltip
                title="Critical Priority Tier"
                content="Urgent matters including anti-ragging violations, safety threats, admission extortions, or imminent exam cancellation. Strict 5-calendar-day SLA."
                detail="Highest priority rating with 24h intake mandate"
              />
            </span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {analytics.kpis.criticalPriority}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            5-day resolution SLA target
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrilldownFilter({ status: 'Escalated' })}
          className="text-left bg-white border border-slate-200 hover:border-amber-600 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Escalations Requiring Action</span>
              <InfoTooltip
                title="Supervisory Escalation Tier"
                content="Cases elevated to Bureau Head (Level 2) or AICTE Member Secretary / Chairman (Level 3) due to protracted institution inaction or high compliance hazard."
                detail="Requires formal administrative directive to resolve"
              />
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1.5">
            {analytics.kpis.escalated}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Supervisory review required
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrilldownFilter({ status: 'Resolved' })}
          className="text-left bg-white border border-slate-200 hover:border-emerald-700 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Resolved & Closed</span>
              <InfoTooltip
                title="Resolved & Certified"
                content="Complaints where corrective actions were verified, restitution granted, and formal closure confirmed with complainant feedback."
                detail="Resolution Rate = Resolved / Total Complaints"
              />
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1.5">
            {analytics.kpis.resolved}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Resolution Rate: {analytics.kpis.resolutionRate}%
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrilldownFilter({ status: 'Reopened' })}
          className="text-left bg-white border border-slate-200 hover:border-teal-700 rounded-lg p-4 transition-colors group relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Reopened Cases</span>
              <InfoTooltip
                title="Reopened Case Audits"
                content="Cases re-activated within 30 days of closure upon complainant grievance appeal, evidence of non-compliance, or post-audit directive."
                detail="Subject to expedited re-inquiry by Bureau Head"
              />
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {analytics.kpis.reopened}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Post-closure compliance audit
          </p>
        </button>

        <div className="bg-white border border-slate-200 rounded-lg p-4 relative">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span>Avg Resolution Cycle</span>
              <InfoTooltip
                title="Average Resolution Velocity"
                content="The mean number of calendar days taken from complaint registration date to final resolution sign-off across closed matters."
                detail="Formula: Sum(Resolved Date - Submitted Date) / Total Resolved"
              />
            </span>
            <Clock className="w-3.5 h-3.5 text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {analytics.kpis.avgResolutionDays} <span className="text-sm font-normal text-slate-600">days</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Computed from resolved timestamps
          </p>
        </div>
      </section>

      {/* Automated Executive Narrative Summary Banner */}
      <section className="bg-slate-900 text-white rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-teal-300">
            COMPUTED EXECUTIVE INTELLIGENCE SUMMARY · SCOPE: {analytics.kpis.total} RECORDS
          </div>
          <p className="text-sm text-slate-100 leading-relaxed">
            Across the active filter scope, <strong>{analytics.kpis.underInvestigation + analytics.kpis.awaitingInstitution}</strong> complaints are in active investigation or awaiting institutional clarification.{' '}
            <strong>{analytics.kpis.overdueCount}</strong> cases have exceeded their configured SLA target, with{' '}
            <strong>
              {[...analytics.byBureau].sort((a, b) => b.activeBacklog - a.activeBacklog)[0]?.bureauName || 'N/A'}
            </strong>{' '}
            holding {[...analytics.byBureau].sort((a, b) => b.activeBacklog - a.activeBacklog)[0]?.activeBacklog || 0} active case(s). Primary stage accumulation is currently observed at{' '}
            <strong>{analytics.bottlenecks[0]?.stage || 'Under Investigation'}</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDrilldownFilter({ overdueOnly: true })}
          className="px-3.5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          Inspect {analytics.kpis.overdueCount} Overdue Cases
        </button>
      </section>

      {/* Primary Visual Analytics Row: Intake vs Resolution Trend & Bureau Workload Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-slate-900">
                  Monthly Complaint Intake vs. Resolution & Escalation Trend
                </h2>
                <InfoTooltip
                  title="Intake Velocity & Throughput Trend"
                  content="Cross-temporal analysis comparing newly registered complaints (teal area), completed case resolutions (green area), and supervisory escalations (red area) across 2026."
                  detail="Data sourced directly from complaint submission & resolution event logs"
                />
              </div>
              <p className="text-xs text-slate-500">
                Derived from actual submission and resolution timestamps (2026)
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              {analytics.monthlyTrends.length} Months
            </span>
          </div>
          <div className="h-64 w-full" aria-label="Monthly Complaint Intake and Resolution Chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyTrends} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="intake"
                  name="Complaints Registered"
                  stroke="#0f766e"
                  fill="#99f6e4"
                  fillOpacity={0.45}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name="Complaints Resolved"
                  stroke="#15803d"
                  fill="#bbf7d0"
                  fillOpacity={0.45}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="escalated"
                  name="Escalated Cases"
                  stroke="#b91c1c"
                  fill="#fecaca"
                  fillOpacity={0.35}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-slate-900">
                  Bureau / Cell Workload, Resolution & Overdue Comparison
                </h2>
                <InfoTooltip
                  title="Bureau Workload & SLA Adherence"
                  content="Comparative operational breakdown by bureau showing active unfinished caseload (slate), resolved inquiries (teal), and SLA non-compliant overdue matters (red)."
                  detail="Highlights operational capacity strains across AICTE directorates"
                />
              </div>
              <p className="text-xs text-slate-500">
                Click any bureau row below or use filter bar to inspect assigned cases
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              {bureaus.length} Bureaus
            </span>
          </div>
          <div className="h-64 w-full" aria-label="Bureau Workload Comparison Bar Chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.byBureau} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bureauCode" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="activeBacklog" name="Active Backlog" fill="#0f172a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#0f766e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="overdue" name="Overdue SLA" fill="#dc2626" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Signature SIH Features Row: Case Ageing Heatmap & Lifecycle Bottleneck Detector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Case Ageing Heatmap (7 cols) */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-slate-900">
                  Signature Intelligence: Bureau × Priority Case Ageing Heatmap
                </h2>
                <InfoTooltip
                  title="Ageing Heatmap Intelligence"
                  content="Cross-tabular matrix identifying stagnation pockets by mapping each bureau's open complaints against statutory priority classes. Cell color denotes SLA breach risk (Red: Overdue, Amber: Ageing ≥7d, Teal: Within SLA)."
                  detail="Click any individual matrix cell to filter workspace to those exact cases"
                />
              </div>
              <p className="text-xs text-slate-500">
                Displays active open cases, average age in days, and SLA breaches per cell. Click any cell to drill down.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">
                  <th className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1">
                      <span>Bureau / Cell</span>
                      <InfoTooltip
                        title="Assigned Operational Unit"
                        content="Autonomous administrative branch or specialized grievance desk (e.g., Approval Bureau, Student Grievance Cell, Vigilance Bureau, Legal Cell)."
                      />
                    </span>
                  </th>
                  {(['Critical', 'High', 'Medium', 'Low'] as PriorityLevel[]).map((prio) => (
                    <th key={prio} className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center gap-1">
                        <span>{prio} Priority</span>
                        <InfoTooltip
                          title={
                            prio === 'Critical'
                              ? 'Critical Priority (5d SLA)'
                              : prio === 'High'
                              ? 'High Priority (10d SLA)'
                              : prio === 'Medium'
                              ? 'Medium Priority (15d SLA)'
                              : 'Low Priority (21d SLA)'
                          }
                          content={
                            prio === 'Critical'
                              ? 'Immediate risk to student safety, anti-ragging, serious financial fraud, or exam malpractice. Mandatory 5 calendar-day turnaround.'
                              : prio === 'High'
                              ? 'Regulatory violations including withheld degrees/marks-cards, illegal fee collection, or arbitrary faculty dismissal. 10 business-day target.'
                              : prio === 'Medium'
                              ? 'Operational non-compliance such as laboratory deficiencies, incomplete syllabus delivery, or non-functional internal grievance cell. 15 business-day target.'
                              : 'General procedural queries, portal correction requests, or general governance feedback. 21 business-day target.'
                          }
                          detail={`SLA Resolution Target: ${prio === 'Critical' ? '5 Days' : prio === 'High' ? '10 Days' : prio === 'Medium' ? '15 Days' : '21 Days'}`}
                        />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {analytics.ageingHeatmap.map((row) => (
                  <tr key={row.bureauId} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div>{row.bureauCode}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[180px]">
                        {row.bureauName}
                      </div>
                    </td>
                    {(['Critical', 'High', 'Medium', 'Low'] as PriorityLevel[]).map((prio) => {
                      const cell = row.byPriority[prio];
                      const cellTone =
                        cell.count === 0
                          ? 'bg-slate-50 text-slate-400 border-slate-200'
                          : cell.overdueCount > 0
                          ? 'bg-red-50 text-red-900 border-red-300 hover:bg-red-100'
                          : cell.avgAgeDays >= 7
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                          : 'bg-teal-50 text-teal-900 border-teal-300 hover:bg-teal-100';

                      return (
                        <td key={prio} className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              onDrilldownFilter({ bureauId: row.bureauId, priority: prio })
                            }
                            className={`w-full py-2 px-2 rounded border transition-colors font-mono tabular-nums ${cellTone}`}
                          >
                            <div className="text-sm font-bold">{cell.count} open</div>
                            <div className="text-[11px]">
                              {cell.count > 0 ? `Avg ${cell.avgAgeDays}d` : '0d'}
                              {cell.overdueCount > 0 ? ` · ${cell.overdueCount} SLA!` : ''}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Lifecycle Bottleneck Detector & Ageing Distribution (5 cols) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-slate-900">
                Workflow Bottleneck Detector & Stage Dwell Analysis
              </h2>
              <InfoTooltip
                title="Stage Dwell Velocity & Backlog Queue"
                content="Identifies structural pipeline friction by calculating the active case count and average calendar days spent stalled in each of the 11 resolution lifecycle phases."
                detail="High Accumulation: dwell > 1.5x expected benchmark"
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Identifies lifecycle stages where active complaints accumulate and dwell longest.
            </p>

            <div className="space-y-2.5">
              {analytics.bottlenecks.slice(0, 5).map((b) => (
                <button
                  key={b.stage}
                  type="button"
                  onClick={() => onDrilldownFilter({ status: b.stage })}
                  className="w-full text-left p-3 rounded-md border border-slate-200 hover:border-teal-700 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-teal-800 transition-colors">
                      {b.stage}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                      {b.activeCount} active case(s) · Avg dwell: {b.avgDwellDays} days
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold font-mono tabular-nums flex items-center gap-1 ${
                      b.severity === 'HIGH_BOTTLENECK'
                        ? 'text-red-700'
                        : b.severity === 'MODERATE_ACCUMULATION'
                        ? 'text-amber-700'
                        : 'text-teal-700'
                    }`}
                  >
                    <span>
                      {b.severity === 'HIGH_BOTTLENECK'
                        ? 'High Accumulation'
                        : b.severity === 'MODERATE_ACCUMULATION'
                        ? 'Moderate Queue'
                        : 'Nominal Flow'}
                    </span>
                    <InfoTooltip
                      title={
                        b.severity === 'HIGH_BOTTLENECK'
                          ? 'Severe Backlog Alert'
                          : b.severity === 'MODERATE_ACCUMULATION'
                          ? 'Moderate Stage Queue'
                          : 'Normal Velocity'
                      }
                      content={
                        b.severity === 'HIGH_BOTTLENECK'
                          ? `Complaints are idling in "${b.stage}" for an average of ${b.avgDwellDays} days. Requires urgent reallocation of verification officers.`
                          : b.severity === 'MODERATE_ACCUMULATION'
                          ? `Dwell duration in "${b.stage}" is trending higher than historical average. Monitored for potential escalation.`
                          : `Intake and handoffs through "${b.stage}" are proceeding within standard regulatory velocity parameters.`
                      }
                      position="left"
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200">
            <div className="flex items-center gap-1.5 mb-2">
              <h3 className="text-xs font-semibold text-slate-700">
                Active Backlog Ageing Buckets
              </h3>
              <InfoTooltip
                title="Ageing Distribution Brackets"
                content="Chronological ageing segmentation of all unresolved grievances calculated from original date of submission."
                detail="Cases >30 days trigger mandatory review by Member Secretary"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {analytics.ageingBuckets.map((b) => (
                <div
                  key={b.bucket}
                  className="bg-slate-50 border border-slate-200 rounded p-2 text-center relative group"
                >
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {b.count}
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center justify-center gap-0.5">
                    <span>{b.bucket}</span>
                    <InfoTooltip
                      title={`Backlog Ageing: ${b.bucket}`}
                      content={
                        b.bucket === '< 7d'
                          ? 'Fresh cases received within the past 7 days, currently within primary administrative triage window.'
                          : b.bucket === '7-14d'
                          ? 'Standard investigation phase. Bureau enquiry officers gathering evidence and institution statements.'
                          : b.bucket === '15-30d'
                          ? 'Ageing warning bracket. Grievances approaching or exceeding medium SLA limits requiring priority handling.'
                          : 'Prolonged backlog exceeding 30 calendar days. Subject to compulsory Level 2/3 supervisory intervention.'
                      }
                      position="top"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Category & Institution Distribution Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-slate-900">
                  Complaints by Institution (Top Volume & Pending Clarifications)
                </h2>
                <InfoTooltip
                  title="Institutional Compliance Breakdown"
                  content="Cross-institution analysis of complaint volume, outstanding show-cause clarifications, and completed remediations across AICTE-approved campuses."
                  detail="Click any row to filter all dashboard views to that specific institution"
                />
              </div>
              <p className="text-xs text-slate-500">
                Click any institution to filter cases in the management workspace
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">
                  <th className="py-2 px-3">
                    <span className="inline-flex items-center gap-1">
                      <span>Institution</span>
                      <InfoTooltip
                        title="Technical Institution / University"
                        content="Name and AICTE unique Permanent Institute ID (PID) of the approved technical campus."
                      />
                    </span>
                  </th>
                  <th className="py-2 px-3">
                    <span className="inline-flex items-center gap-1">
                      <span>State</span>
                      <InfoTooltip
                        title="State & Regional Jurisdiction"
                        content="State or Union Territory governing the regional council supervision (e.g., Northern, Southern, Western Region)."
                      />
                    </span>
                  </th>
                  <th className="py-2 px-3 text-right">
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      <span>Total</span>
                      <InfoTooltip
                        title="Total Institutional Case Count"
                        content="Total cumulative complaints lodged against this institution within the active filter scope."
                        position="left"
                      />
                    </span>
                  </th>
                  <th className="py-2 px-3 text-right">
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      <span>Awaiting Reply</span>
                      <InfoTooltip
                        title="Outstanding Clarifications"
                        content="Count of active notices or show-cause directives served on the institution awaiting mandatory compliance response."
                        position="left"
                      />
                    </span>
                  </th>
                  <th className="py-2 px-3 text-right">
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      <span>Resolved</span>
                      <InfoTooltip
                        title="Institutional Resolutions"
                        content="Count of grievances successfully redressed with issued compliance certificates."
                        position="left"
                      />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {analytics.byInstitution.map((inst) => (
                  <tr
                    key={inst.institutionId}
                    onClick={() => onDrilldownFilter({ institutionId: inst.institutionId })}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div>{inst.institutionName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{inst.institutionCode}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{inst.state}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {inst.totalComplaints}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700 font-medium">
                      {inst.pendingResponses}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                      {inst.resolvedComplaints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-slate-900">
                  Escalations & Priority Cases Requiring Immediate Officer Attention
                </h2>
                <InfoTooltip
                  title="Priority Action Watchlist"
                  content="High-urgency complaints prioritized by imminent SLA breach or Critical severity rating requiring active executive intervention or inspection committee deployment."
                  detail="Sorted by urgency score and remaining SLA window"
                />
              </div>
              <p className="text-xs text-slate-500">
                Ordered by SLA breach urgency and priority weight
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredComplaints
              .filter((c) => c.status !== 'Resolved' && c.status !== 'Closed')
              .slice(0, 5)
              .map((c) => (
                <div
                  key={c.id}
                  className="py-3 flex items-start justify-between gap-3 hover:bg-slate-50 px-2 rounded transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">{c.referenceNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          c.priority === 'Critical'
                            ? 'text-red-700 font-semibold'
                            : c.priority === 'High'
                            ? 'text-amber-700 font-semibold'
                            : 'text-slate-700'
                        }
                      >
                        {c.priority} Priority
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{c.status}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenComplaint(c.id)}
                      className="text-left text-xs font-semibold text-slate-900 hover:text-teal-700 mt-0.5 line-clamp-1"
                    >
                      {c.title}
                    </button>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {c.institutionName} · {c.state} · Affected: {c.affectedCount}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenComplaint(c.id)}
                    className="px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 shrink-0 whitespace-nowrap"
                  >
                    Inspect Case
                  </button>
                </div>
              ))}
          </div>
        </section>
      </div>

      {/* Management Brief Generator Dialog */}
      {showBriefModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="management-brief-title"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-mono text-teal-700">
                  EXECUTIVE BRIEF GENERATOR · COMPUTED FROM STORED RECORDS
                </p>
                <h2 id="management-brief-title" className="text-lg font-bold text-slate-900">
                  Consolidated Institutional Complaint Management Brief
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBriefModal(false)}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="bg-slate-50 border border-slate-200 rounded p-3 font-mono">
                <div>Generated Timestamp: {new Date().toISOString()}</div>
                <div>Active Scope: {analytics.kpis.total} Complaint Record(s)</div>
                <div>Classification Notice: AICTE OFFICIAL CENTRAL COMPLAINT REGISTER · CONFIDENTIAL</div>
              </div>

              <h3 className="text-sm font-bold text-slate-900">1. Operational Snapshot</h3>
              <p>
                Out of <strong>{analytics.kpis.total}</strong> total complaints in the current filter scope,{' '}
                <strong>{analytics.kpis.resolved}</strong> have been resolved ({analytics.kpis.resolutionRate}% resolution rate, average resolution time {analytics.kpis.avgResolutionDays} days). Currently,{' '}
                <strong>{analytics.kpis.underInvestigation}</strong> cases are under active bureau investigation and{' '}
                <strong>{analytics.kpis.awaitingInstitution}</strong> are awaiting mandatory institutional clarification.
              </p>

              <h3 className="text-sm font-bold text-slate-900">2. SLA Compliance & Escalation Priorities</h3>
              <p>
                <strong>{analytics.kpis.overdueCount}</strong> active complaints have exceeded their configured SLA target window, with{' '}
                <strong>{analytics.kpis.criticalPriority}</strong> classified as Critical priority. Immediate supervisory review is recommended for Level 2/3 escalations in{' '}
                <strong>{analytics.byBureau[0]?.bureauName}</strong>.
              </p>

              <h3 className="text-sm font-bold text-slate-900">3. Recommended Administrative Actions</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Expedite show-cause verification for institutions with pending clarification requests exceeding 72 hours.
                </li>
                <li>
                  Review suspected duplicate complaint clusters in the AI Intelligence Center to consolidate redundant inquiries.
                </li>
                <li>
                  Address primary stage accumulation in <strong>{analytics.bottlenecks[0]?.stage || 'Under Investigation'}</strong>.
                </li>
              </ul>

              <div className="bg-teal-50 border border-teal-200 rounded p-3 text-teal-950">
                <strong>Regulatory Register Notice:</strong> Figures in this brief are computed from the active AICTE central grievance database. All proceedings are governed by the statutory AICTE Approval Process Handbook and Grievance Redressal Regulations.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                Print / Save PDF Brief
              </button>
              <button
                type="button"
                onClick={() => setShowBriefModal(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
