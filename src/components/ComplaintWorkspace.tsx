import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderKanban,
  GitBranch,
  History,
  ListFilter,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  UserCheck,
} from 'lucide-react';
import {
  AIAssessment,
  AssignmentRecord,
  AuditLogEntry,
  Bureau,
  CaseAttachment,
  CaseComment,
  Complaint,
  ComplaintRelationship,
  ComplaintStatus,
  Institution,
  InstitutionResponseItem,
  PriorityConfig,
  PriorityLevel,
  SavedSearch,
  StatusTransitionEvent,
  UserProfile,
} from '../db/types';
import {
  ALLOWED_STATUS_TRANSITIONS,
  calculateCaseAgeingAndSla,
  canUserPerformAction,
  ROLE_TRANSITION_PERMISSIONS,
} from '../db/rules';

interface ComplaintWorkspaceProps {
  actor: UserProfile;
  complaints: Complaint[];
  bureaus: Bureau[];
  institutions: Institution[];
  priorities: PriorityConfig[];
  statusHistory: StatusTransitionEvent[];
  assignments: AssignmentRecord[];
  comments: CaseComment[];
  institutionResponses: InstitutionResponseItem[];
  attachments: CaseAttachment[];
  relationships: ComplaintRelationship[];
  aiAssessments: Record<string, AIAssessment>;
  auditLogs: AuditLogEntry[];
  savedSearches: SavedSearch[];
  selectedComplaintId: string | null;
  onSelectComplaint: (id: string | null) => void;
  initialFilter: {
    status?: string;
    priority?: string;
    bureauId?: string;
    institutionId?: string;
    overdueOnly?: boolean;
  };
  onAssignComplaint: (
    complaintId: string,
    toBureauId: string,
    assignedOfficerName: string,
    reason: string
  ) => Promise<void>;
  onTransitionStatus: (
    complaintId: string,
    targetStatus: ComplaintStatus,
    reason: string,
    resolutionSummary?: string
  ) => Promise<void>;
  onAddComment: (
    complaintId: string,
    content: string,
    visibility: 'INTERNAL' | 'INSTITUTION_VISIBLE' | 'PUBLIC_SUMMARY',
    noteType: CaseComment['noteType']
  ) => Promise<void>;
  onRequestInstitutionInfo: (complaintId: string, question: string, dueDays: number) => Promise<void>;
  onSubmitInstitutionResponse: (respId: string, responseText: string) => Promise<void>;
  onRecordAIFeedback: (
    complaintId: string,
    decision: 'ACCEPTED' | 'MODIFIED' | 'REJECTED',
    notes: string,
    modifiedCategory?: string,
    modifiedPriority?: PriorityLevel
  ) => Promise<void>;
  onDecideDuplicate: (relId: string, status: 'CONFIRMED' | 'DISMISSED') => Promise<void>;
}

export const ComplaintWorkspace: React.FC<ComplaintWorkspaceProps> = ({
  actor,
  complaints,
  bureaus,
  institutions,
  priorities,
  statusHistory,
  assignments,
  comments,
  institutionResponses,
  attachments,
  relationships,
  aiAssessments,
  auditLogs,
  savedSearches,
  selectedComplaintId,
  onSelectComplaint,
  initialFilter,
  onAssignComplaint,
  onTransitionStatus,
  onAddComment,
  onRequestInstitutionInfo,
  onSubmitInstitutionResponse,
  onRecordAIFeedback,
  onDecideDuplicate,
}) => {
  const [viewMode, setViewMode] = useState<'TABLE' | 'KANBAN'>('TABLE');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter.status || 'ALL');
  const [priorityFilter, setPriorityFilter] = useState(initialFilter.priority || 'ALL');
  const [bureauFilter, setBureauFilter] = useState(initialFilter.bureauId || 'ALL');
  const [institutionFilter, setInstitutionFilter] = useState(initialFilter.institutionId || 'ALL');
  const [overdueOnly, setOverdueOnly] = useState(Boolean(initialFilter.overdueOnly));
  const [sortField, setSortField] = useState<'submittedAt' | 'priority' | 'referenceNumber' | 'slaDueAt'>('submittedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBureauId, setBulkBureauId] = useState(bureaus[0]?.id || 'BUR-GRIEVANCE');
  const [bulkReason, setBulkReason] = useState('Consolidated batch routing by Central Monitoring Officer.');

  // Case detail tabs & form states
  const [activeDetailTab, setActiveDetailTab] = useState<
    'OVERVIEW' | 'TIMELINE' | 'INVESTIGATION' | 'INSTITUTION' | 'AI' | 'RELATED' | 'AUDIT'
  >('OVERVIEW');
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus | ''>('');
  const [transitionReason, setTransitionReason] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [assignBureauId, setAssignBureauId] = useState('');
  const [assignOfficerName, setAssignOfficerName] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<'INTERNAL' | 'INSTITUTION_VISIBLE'>('INTERNAL');
  const [noteType, setNoteType] = useState<CaseComment['noteType']>('INVESTIGATION_NOTE');
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [clarificationDueDays, setClarificationDueDays] = useState(3);
  const [instReplyText, setInstReplyText] = useState('');
  const [aiFeedbackNote, setAiFeedbackNote] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync external drilldown filter changes
  React.useEffect(() => {
    if (initialFilter.status) setStatusFilter(initialFilter.status);
    if (initialFilter.priority) setPriorityFilter(initialFilter.priority);
    if (initialFilter.bureauId) setBureauFilter(initialFilter.bureauId);
    if (initialFilter.institutionId) setInstitutionFilter(initialFilter.institutionId);
    setOverdueOnly(Boolean(initialFilter.overdueOnly));
    setPage(1);
  }, [initialFilter]);

  const priorityRank: Record<PriorityLevel, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return complaints
      .filter((c) => {
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;
        if (bureauFilter !== 'ALL' && c.bureauId !== bureauFilter) return false;
        if (institutionFilter !== 'ALL' && c.institutionId !== institutionFilter) return false;
        if (overdueOnly) {
          const sla = calculateCaseAgeingAndSla(c, priorities, '2026-10-26T12:00:00.000Z');
          if (!c.isOverdue && sla.slaState !== 'OVERDUE') return false;
        }
        if (q.length > 0) {
          const hay = `${c.referenceNumber} ${c.title} ${c.institutionName} ${c.category} ${c.subcategory} ${c.assignedOfficerName || ''} ${c.status}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'submittedAt') {
          cmp = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        } else if (sortField === 'slaDueAt') {
          cmp = new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime();
        } else if (sortField === 'priority') {
          cmp = priorityRank[a.priority] - priorityRank[b.priority];
        } else {
          cmp = a.referenceNumber.localeCompare(b.referenceNumber);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [
    complaints,
    searchQuery,
    statusFilter,
    priorityFilter,
    bureauFilter,
    institutionFilter,
    overdueOnly,
    sortField,
    sortDir,
    priorities,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const paginatedComplaints = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize);

  const selectedComplaint = useMemo(
    () => complaints.find((c) => c.id === selectedComplaintId) || null,
    [complaints, selectedComplaintId]
  );

  // Sync defaults when selectedComplaint changes
  React.useEffect(() => {
    if (selectedComplaint) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[selectedComplaint.status] || [];
      setTargetStatus(allowed[0] || '');
      setAssignBureauId(selectedComplaint.bureauId);
      setAssignOfficerName(selectedComplaint.assignedOfficerName || '');
      setActionFeedback(null);
    }
  }, [selectedComplaint]);

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0) return;
    const bureau = bureaus.find((b) => b.id === bulkBureauId) || bureaus[0];
    try {
      for (const id of selectedIds) {
        await onAssignComplaint(id, bureau.id, bureau.headOfficerName, bulkReason);
      }
      setSelectedIds([]);
      setActionFeedback({
        type: 'success',
        message: `Assigned ${selectedIds.length} complaint(s) to ${bureau.name}.`,
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Bulk assignment failed.' });
    }
  };

  const handleExportWorkspaceCsv = () => {
    const headers = [
      'ReferenceNumber',
      'Title',
      'Category',
      'Subcategory',
      'Institution',
      'State',
      'Bureau',
      'AssignedOfficer',
      'Priority',
      'Status',
      'SubmittedAt',
      'SLADueAt',
    ];
    const rows = filteredAndSorted.map((c) => [
      c.referenceNumber,
      `"${c.title.replace(/"/g, '""')}"`,
      `"${c.category}"`,
      `"${c.subcategory}"`,
      `"${c.institutionName}"`,
      c.state,
      c.bureauId,
      `"${c.assignedOfficerName || 'Unassigned'}"`,
      c.priority,
      c.status,
      c.submittedAt.slice(0, 10),
      c.slaDueAt.slice(0, 10),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AICTE_Complaints_Registry_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // If a specific complaint is open, render the full Case Detail & Smart Timeline view
  if (selectedComplaint) {
    const sla = calculateCaseAgeingAndSla(selectedComplaint, priorities, '2026-10-26T12:00:00.000Z');
    const caseHistory = statusHistory.filter((h) => h.complaintId === selectedComplaint.id);
    const caseAssignments = assignments.filter((a) => a.complaintId === selectedComplaint.id);
    const caseComments = comments.filter((c) => c.complaintId === selectedComplaint.id);
    const caseResponses = institutionResponses.filter((r) => r.complaintId === selectedComplaint.id);
    const caseAttachments = attachments.filter((att) => att.complaintId === selectedComplaint.id);
    const caseRelationships = relationships.filter(
      (rel) =>
        rel.sourceComplaintId === selectedComplaint.id || rel.targetComplaintId === selectedComplaint.id
    );
    const caseAi = aiAssessments[selectedComplaint.id];
    const caseAudits = auditLogs.filter((a) => a.entityReference === selectedComplaint.referenceNumber);
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[selectedComplaint.status] || [];

    return (
      <div className="space-y-5">
        {/* Case Detail Top Bar */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <button
              type="button"
              onClick={() => onSelectComplaint(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Complaint Management Registry
            </button>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-600">
              <span>Ref: {selectedComplaint.referenceNumber}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  selectedComplaint.priority === 'Critical'
                    ? 'font-bold text-red-700'
                    : selectedComplaint.priority === 'High'
                    ? 'font-bold text-amber-700'
                    : 'font-semibold text-slate-800'
                }
              >
                {selectedComplaint.priority} Priority
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-teal-800">Status: {selectedComplaint.status}</span>
              <span aria-hidden="true">·</span>
              <span className={sla.slaState === 'OVERDUE' ? 'text-red-700 font-bold' : 'text-slate-600'}>
                Age: {sla.ageDays}d ({sla.slaState.replace(/_/g, ' ')})
              </span>
            </div>
          </div>

          <div className="pt-4">
            <h1 className="text-lg font-bold text-slate-900">{selectedComplaint.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1.5">
              <span>Institution: <strong>{selectedComplaint.institutionName}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Location: {selectedComplaint.district}, {selectedComplaint.state}</span>
              <span aria-hidden="true">·</span>
              <span>Category: {selectedComplaint.category} / {selectedComplaint.subcategory}</span>
              <span aria-hidden="true">·</span>
              <span>Bureau: <strong>{selectedComplaint.bureauId}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Assigned Officer: <strong>{selectedComplaint.assignedOfficerName || 'Pending Officer Assignment'}</strong></span>
            </div>
          </div>

          {actionFeedback && (
            <div
              role="status"
              className={`mt-4 p-3 rounded-md border text-xs font-medium ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {actionFeedback.message}
            </div>
          )}

          {/* Case Detail Navigation Tabs */}
          <div className="flex items-center gap-1 pt-4 mt-4 border-t border-slate-200 overflow-x-auto no-scrollbar">
            {[
              { id: 'OVERVIEW', label: 'Overview & Actions' },
              { id: 'TIMELINE', label: `Smart Timeline (${caseHistory.length + caseAssignments.length})` },
              { id: 'INVESTIGATION', label: `Investigation Notes (${caseComments.length})` },
              { id: 'INSTITUTION', label: `Institution Responses (${caseResponses.length})` },
              { id: 'AI', label: 'Explainable AI' },
              { id: 'RELATED', label: `Duplicates (${caseRelationships.length})` },
              { id: 'AUDIT', label: `Attachments & Audit (${caseAttachments.length + caseAudits.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDetailTab(tab.id as any)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeDetailTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: OVERVIEW & WORKFLOW ACTIONS */}
        {activeDetailTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-5">
              <section className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-bold text-slate-900 mb-2">
                  Reported Complaint Narrative & Regulatory Particulars
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedComplaint.description}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200 text-xs">
                  <div>
                    <div className="text-slate-500">Source Channel</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{selectedComplaint.sourceChannel}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Complainant Type</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{selectedComplaint.complainantType}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Reported Affected Cohort</div>
                    <div className="font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                      {selectedComplaint.affectedCount} person(s)
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Submitted Timestamp</div>
                    <div className="font-mono tabular-nums text-slate-900 mt-0.5">
                      {selectedComplaint.submittedAt.slice(0, 16).replace('T', ' ')} UTC
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">SLA Target Deadline</div>
                    <div className="font-mono tabular-nums text-slate-900 mt-0.5">
                      {selectedComplaint.slaDueAt.slice(0, 16).replace('T', ' ')} UTC
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Escalation Level</div>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      Level {selectedComplaint.escalationLevel}
                    </div>
                  </div>
                </div>

                {selectedComplaint.resolutionSummary && (
                  <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-950">
                    <div className="font-bold mb-1">Recorded Resolution Summary:</div>
                    <p>{selectedComplaint.resolutionSummary}</p>
                  </div>
                )}
              </section>

              {/* Quick AI Summary Preview */}
              {caseAi && (
                <section className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-slate-900">
                      Explainable AI Executive Summary ({caseAi.engineMode === 'DETERMINISTIC_RULE_ENGINE' ? 'Rule-Based Assistance' : 'LLM Adapter'})
                    </h2>
                    <span className="text-xs font-mono tabular-nums text-teal-800">
                      Confidence: {caseAi.confidenceScore}% · Review: {caseAi.humanReviewStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed mb-2">
                    <strong>Core Issue:</strong> {caseAi.executiveSummary.coreIssue}
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed mb-3">
                    <strong>Suggested Next Administrative Step:</strong> {caseAi.executiveSummary.suggestedNextStep}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('AI')}
                    className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded"
                  >
                    Open Full Explainable AI Assessment & Feedback
                  </button>
                </section>
              )}
            </div>

            {/* Right Column: Role-Guarded Administrative Actions */}
            <div className="lg:col-span-5 space-y-5">
              {/* Lifecycle Transition Form */}
              <section className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-bold text-slate-900 mb-1">
                  Execute Policy-Validated Lifecycle Transition
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Current State: <strong>{selectedComplaint.status}</strong> · Active Role: <strong>{actor.role}</strong>
                </p>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="target-status-select" className="block text-xs font-medium text-slate-700 mb-1">
                      Target Lifecycle Status (Allowed Next Transitions)
                    </label>
                    <select
                      id="target-status-select"
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value as ComplaintStatus)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                    >
                      {allowedTransitions.map((st) => {
                        const permitted = (ROLE_TRANSITION_PERMISSIONS[st] || []).includes(actor.role);
                        return (
                          <option key={st} value={st}>
                            {st} {permitted ? '(Authorized)' : '(Requires Supervisory Role)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {(targetStatus === 'Resolution Proposed' || targetStatus === 'Resolved') && (
                    <div>
                      <label htmlFor="resolution-summary-input" className="block text-xs font-medium text-slate-700 mb-1">
                        Resolution Summary & Verified Compliance Findings *
                      </label>
                      <textarea
                        id="resolution-summary-input"
                        rows={2}
                        value={resolutionSummary}
                        onChange={(e) => setResolutionSummary(e.target.value)}
                        placeholder="Document verified institutional compliance evidence and closure rationale..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="transition-reason-input" className="block text-xs font-medium text-slate-700 mb-1">
                      Mandatory Administrative Reason (Recorded in Audit Trail) *
                    </label>
                    <textarea
                      id="transition-reason-input"
                      rows={2}
                      value={transitionReason}
                      onChange={(e) => setTransitionReason(e.target.value)}
                      placeholder="Enter reason for status transition (minimum 5 characters)..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!targetStatus) return;
                      try {
                        await onTransitionStatus(
                          selectedComplaint.id,
                          targetStatus,
                          transitionReason,
                          resolutionSummary || undefined
                        );
                        setTransitionReason('');
                        setActionFeedback({
                          type: 'success',
                          message: `Transitioned complaint to "${targetStatus}" and logged audit event.`,
                        });
                      } catch (err: any) {
                        setActionFeedback({
                          type: 'error',
                          message: err.message || 'Status transition rejected by policy.',
                        });
                      }
                    }}
                    className="w-full py-2 px-4 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors"
                  >
                    Record Lifecycle Status Transition
                  </button>
                </div>
              </section>

              {/* Bureau Routing & Officer Assignment Form */}
              <section className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-bold text-slate-900 mb-1">
                  Bureau Assignment & Interdepartmental Case Transfer
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Route or transfer case to an authorized AICTE Bureau/Cell with full accountability.
                </p>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="assign-bureau-select" className="block text-xs font-medium text-slate-700 mb-1">
                      Target Bureau / Cell
                    </label>
                    <select
                      id="assign-bureau-select"
                      value={assignBureauId}
                      onChange={(e) => {
                        setAssignBureauId(e.target.value);
                        const b = bureaus.find((x) => x.id === e.target.value);
                        if (b) setAssignOfficerName(b.headOfficerName);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                    >
                      {bureaus.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} — {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="assign-officer-input" className="block text-xs font-medium text-slate-700 mb-1">
                      Assigned Investigating Officer
                    </label>
                    <input
                      id="assign-officer-input"
                      type="text"
                      value={assignOfficerName}
                      onChange={(e) => setAssignOfficerName(e.target.value)}
                      placeholder="Officer Full Name"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="assign-reason-input" className="block text-xs font-medium text-slate-700 mb-1">
                      Routing / Transfer Justification *
                    </label>
                    <input
                      id="assign-reason-input"
                      type="text"
                      value={assignReason}
                      onChange={(e) => setAssignReason(e.target.value)}
                      placeholder="Specify jurisdiction or workload routing reason..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onAssignComplaint(
                          selectedComplaint.id,
                          assignBureauId,
                          assignOfficerName,
                          assignReason
                        );
                        setAssignReason('');
                        setActionFeedback({
                          type: 'success',
                          message: `Assigned complaint to ${assignBureauId} (${assignOfficerName}).`,
                        });
                      } catch (err: any) {
                        setActionFeedback({
                          type: 'error',
                          message: err.message || 'Assignment failed.',
                        });
                      }
                    }}
                    className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                  >
                    Confirm Bureau Assignment / Transfer
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* TAB 2: SMART CASE TIMELINE */}
        {activeDetailTab === 'TIMELINE' && (
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-1">
              Smart Chronological Case Timeline
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Complete immutable sequence of intake, assignments, status transitions, and resolution actions.
            </p>
            <div className="space-y-4">
              {caseHistory.map((evt) => (
                <div key={evt.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-600">
                    <span className="font-bold text-slate-900">
                      {evt.previousStatus ? `${evt.previousStatus} → ${evt.newStatus}` : `Initial State: ${evt.newStatus}`}
                    </span>
                    <span>{evt.timestamp.slice(0, 19).replace('T', ' ')} UTC</span>
                  </div>
                  <p className="text-xs text-slate-800 mt-1.5">{evt.reason}</p>
                  {evt.comment && (
                    <p className="text-xs text-teal-900 bg-teal-50 p-2 rounded mt-1.5 border border-teal-200">
                      Resolution Note: {evt.comment}
                    </p>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1.5">
                    Actor: {evt.actorName} · Role: {evt.actorRole}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: INVESTIGATION NOTES & INTERNAL/EXTERNAL COMMUNICATIONS */}
        {activeDetailTab === 'INVESTIGATION' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                Investigation Notes & Communications Log
              </h2>
              <p className="text-xs text-slate-500">
                INTERNAL notes are restricted to authorized AICTE officers/auditors and hidden from Institution Liaisons.
              </p>
              {caseComments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded">
                  No investigation notes recorded for this complaint yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {caseComments.map((cmt) => (
                    <div key={cmt.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                        <span className="font-semibold text-slate-900">
                          {cmt.authorName} ({cmt.authorRole})
                        </span>
                        <span>
                          {cmt.visibility} · {cmt.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 mt-1.5 leading-relaxed">{cmt.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Add Investigation Note / Directive</h2>
              <div>
                <label htmlFor="note-visibility" className="block text-xs font-medium text-slate-700 mb-1">
                  Note Classification & Visibility Boundary
                </label>
                <select
                  id="note-visibility"
                  value={noteVisibility}
                  onChange={(e) => setNoteVisibility(e.target.value as 'INTERNAL' | 'INSTITUTION_VISIBLE')}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="INTERNAL">INTERNAL (Restricted to AICTE Officers & Auditors)</option>
                  <option value="INSTITUTION_VISIBLE">INSTITUTION_VISIBLE (Shared with Institution Liaison)</option>
                </select>
              </div>
              <div>
                <label htmlFor="note-type" className="block text-xs font-medium text-slate-700 mb-1">
                  Note Category
                </label>
                <select
                  id="note-type"
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as CaseComment['noteType'])}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="INVESTIGATION_NOTE">Investigation Finding</option>
                  <option value="CLARIFICATION_REQUEST">Clarification Directive</option>
                  <option value="SUPERVISORY_DIRECTIVE">Supervisory Directive</option>
                  <option value="RESOLUTION_NOTE">Resolution Recommendation</option>
                </select>
              </div>
              <div>
                <label htmlFor="note-content" className="block text-xs font-medium text-slate-700 mb-1">
                  Note Text *
                </label>
                <textarea
                  id="note-content"
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Enter detailed investigation note or compliance observation..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onAddComment(selectedComplaint.id, noteContent, noteVisibility, noteType);
                    setNoteContent('');
                    setActionFeedback({ type: 'success', message: 'Investigation note recorded.' });
                  } catch (err: any) {
                    setActionFeedback({ type: 'error', message: err.message || 'Could not add note.' });
                  }
                }}
                className="w-full py-2 px-4 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md"
              >
                Save Investigation Note
              </button>
            </section>
          </div>
        )}

        {/* TAB 4: INSTITUTION CLARIFICATION REQUESTS & RESPONSES */}
        {activeDetailTab === 'INSTITUTION' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                Institutional Clarification & Show-Cause Tracker
              </h2>
              {caseResponses.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded">
                  No clarification requests have been sent to {selectedComplaint.institutionName} for this case yet.
                </div>
              ) : (
                caseResponses.map((req) => (
                  <div key={req.id} className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                      <span className="font-bold text-slate-900">Status: {req.status}</span>
                      <span>Due: {req.dueAt.slice(0, 10)}</span>
                    </div>
                    <p className="text-xs text-slate-800">
                      <strong>Bureau Question ({req.requestedByName}):</strong> {req.requestQuestion}
                    </p>
                    {req.responseText ? (
                      <div className="p-3 bg-white border border-emerald-200 rounded text-xs text-slate-800">
                        <div className="font-semibold text-emerald-800 mb-1">
                          Institution Response ({req.respondedByName} · {req.respondedAt?.slice(0, 10)}):
                        </div>
                        <p>{req.responseText}</p>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <label htmlFor={`reply-${req.id}`} className="block text-xs font-semibold text-slate-700">
                          Submit Official Institutional Clarification Response (Liaison / Authorized Officer)
                        </label>
                        <textarea
                          id={`reply-${req.id}`}
                          rows={2}
                          value={instReplyText}
                          onChange={(e) => setInstReplyText(e.target.value)}
                          placeholder="Provide verified dispatch details, NEFT batch reference, or compliance evidence..."
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await onSubmitInstitutionResponse(req.id, instReplyText);
                              setInstReplyText('');
                              setActionFeedback({
                                type: 'success',
                                message: 'Institution response recorded and case moved back to Under Investigation.',
                              });
                            } catch (err: any) {
                              setActionFeedback({ type: 'error', message: err.message });
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded"
                        >
                          Submit Institution Response
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                Issue New Clarification Request to Institution
              </h2>
              <p className="text-xs text-slate-500">
                Automatically transitions status to <strong>Awaiting Institution Response</strong> and notifies the Institution Liaison Officer.
              </p>
              <div>
                <label htmlFor="clarification-question" className="block text-xs font-medium text-slate-700 mb-1">
                  Clarification Question / Documentary Demand *
                </label>
                <textarea
                  id="clarification-question"
                  rows={3}
                  value={clarificationQuestion}
                  onChange={(e) => setClarificationQuestion(e.target.value)}
                  placeholder="Specify exact documents, receipts, or compliance proofs required from the institution..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="clarification-due" className="block text-xs font-medium text-slate-700 mb-1">
                  Response Deadline Window (Days)
                </label>
                <input
                  id="clarification-due"
                  type="number"
                  min={1}
                  max={15}
                  value={clarificationDueDays}
                  onChange={(e) => setClarificationDueDays(Number(e.target.value) || 3)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onRequestInstitutionInfo(
                      selectedComplaint.id,
                      clarificationQuestion,
                      clarificationDueDays
                    );
                    setClarificationQuestion('');
                    setActionFeedback({
                      type: 'success',
                      message: 'Clarification request issued and institution notified.',
                    });
                  } catch (err: any) {
                    setActionFeedback({ type: 'error', message: err.message });
                  }
                }}
                className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                Send Clarification Directive
              </button>
            </section>
          </div>
        )}

        {/* TAB 5: EXPLAINABLE AI ASSESSMENT & HUMAN FEEDBACK */}
        {activeDetailTab === 'AI' && caseAi && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-xs font-mono text-teal-700">
                    ENGINE MODE: {caseAi.engineMode} · CONFIDENCE: {caseAi.confidenceScore}%
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    Explainable AI Classification, Priority & Summary
                  </h2>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-700">
                  Review Status: {caseAi.humanReviewStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500">Suggested Category</div>
                  <div className="font-bold text-slate-900 mt-0.5">{caseAi.suggestedCategory}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{caseAi.suggestedSubcategory}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500">Recommended Priority</div>
                  <div className="font-bold text-slate-900 mt-0.5">{caseAi.suggestedPriority}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">Transparent Factor Scoring</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500">Recommended Bureau</div>
                  <div className="font-bold text-slate-900 mt-0.5">{caseAi.suggestedBureauId}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">Jurisdiction Match</div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-2">
                  Transparent Priority Factor Weights
                </h3>
                <div className="space-y-1.5">
                  {caseAi.priorityFactors.map((pf, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{pf.factor}:</span>{' '}
                        <span className="text-slate-600">{pf.impact}</span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-teal-800">
                        +{pf.scoreContribution} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-slate-900">Structured Case Summary (Allegations vs. Verified Facts)</h3>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                  <p><strong>Core Issue:</strong> {caseAi.executiveSummary.coreIssue}</p>
                  <p><strong>Reported Allegations (Unverified):</strong> {caseAi.executiveSummary.reportedAllegations.join(' ')}</p>
                  <p><strong>Evidence Supplied:</strong> {caseAi.executiveSummary.evidenceSupplied}</p>
                  <p><strong>Missing Information to Request:</strong> {caseAi.executiveSummary.missingInformation.join(' ')}</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-950 space-y-1">
                <div className="font-bold">Explainability & Limitations Disclosure:</div>
                <p>{caseAi.explainabilityNotes}</p>
                <p>{caseAi.limitationsDisclosure}</p>
              </div>
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                Mandatory Human-in-the-Loop AI Supervision
              </h2>
              <p className="text-xs text-slate-500">
                Consequential administrative decisions are never made automatically by AI. Record your supervisory review of these suggestions:
              </p>

              <div>
                <label htmlFor="ai-feedback-note" className="block text-xs font-medium text-slate-700 mb-1">
                  Officer Review Note
                </label>
                <textarea
                  id="ai-feedback-note"
                  rows={3}
                  value={aiFeedbackNote}
                  onChange={(e) => setAiFeedbackNote(e.target.value)}
                  placeholder="Document rationale for accepting, modifying, or rejecting the AI assessment..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onRecordAIFeedback(
                      selectedComplaint.id,
                      'ACCEPTED',
                      aiFeedbackNote || 'Officer verified and accepted AI classification and priority.'
                    );
                    setActionFeedback({ type: 'success', message: 'AI Assessment marked ACCEPTED.' });
                  }}
                  className="py-2 px-3 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded"
                >
                  Accept Suggestion
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onRecordAIFeedback(
                      selectedComplaint.id,
                      'MODIFIED',
                      aiFeedbackNote || 'Officer accepted with manual priority refinement.'
                    );
                    setActionFeedback({ type: 'success', message: 'AI Assessment marked MODIFIED.' });
                  }}
                  className="py-2 px-3 text-xs font-semibold text-slate-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded"
                >
                  Modify & Apply
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onRecordAIFeedback(
                      selectedComplaint.id,
                      'REJECTED',
                      aiFeedbackNote || 'Officer overrode rule-based recommendation.'
                    );
                    setActionFeedback({ type: 'success', message: 'AI Assessment marked REJECTED.' });
                  }}
                  className="py-2 px-3 text-xs font-semibold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                >
                  Reject Suggestion
                </button>
              </div>
            </section>
          </div>
        )}

        {/* TAB 6: RELATED & DUPLICATE COMPLAINTS */}
        {activeDetailTab === 'RELATED' && (
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              Suspected Duplicate & Related Institutional Cases
            </h2>
            {caseRelationships.length === 0 ? (
              <p className="text-xs text-slate-500">
                No suspected duplicate or linked complaints detected for this record.
              </p>
            ) : (
              <div className="space-y-3">
                {caseRelationships.map((rel) => {
                  const otherId =
                    rel.sourceComplaintId === selectedComplaint.id
                      ? rel.targetComplaintId
                      : rel.sourceComplaintId;
                  const otherCase = complaints.find((c) => c.id === otherId);
                  return (
                    <div key={rel.id} className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-900">
                          Linked Case: {otherCase?.referenceNumber || otherId} · Similarity: {rel.similarityScore}%
                        </span>
                        <span className="font-mono text-teal-800">
                          {rel.relationshipType} · Verification: {rel.status}
                        </span>
                      </div>
                      {otherCase && (
                        <div className="text-xs font-semibold text-slate-800">{otherCase.title}</div>
                      )}
                      <ul className="list-disc pl-5 text-xs text-slate-600 space-y-0.5">
                        {rel.matchReasons.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => onDecideDuplicate(rel.id, 'CONFIRMED')}
                          className="px-3 py-1 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded"
                        >
                          Confirm Duplicate Link
                        </button>
                        <button
                          type="button"
                          onClick={() => onDecideDuplicate(rel.id, 'DISMISSED')}
                          className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded"
                        >
                          Dismiss Match
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 7: ATTACHMENTS & IMMUTABLE AUDIT HISTORY */}
        {activeDetailTab === 'AUDIT' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Authorized Supporting Attachments</h2>
              {caseAttachments.length === 0 ? (
                <p className="text-xs text-slate-500">No documentary attachments uploaded for this record.</p>
              ) : (
                caseAttachments.map((att) => (
                  <div key={att.id} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                    <div className="font-semibold text-slate-900">{att.fileName}</div>
                    <div className="text-slate-500 font-mono tabular-nums">
                      Size: {Math.round(att.fileSizeBytes / 1024)} KB · Uploaded by {att.uploadedByName}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      SHA-256: {att.checksumSha256}
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Immutable Case Audit Log</h2>
              {caseAudits.length === 0 ? (
                <p className="text-xs text-slate-500">Initial intake logged in primary registry.</p>
              ) : (
                caseAudits.map((aud) => (
                  <div key={aud.id} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                    <div className="flex items-center justify-between font-mono text-slate-600">
                      <span className="font-bold text-slate-900">{aud.eventType}</span>
                      <span>{aud.timestamp.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    <p className="text-slate-800">{aud.summary}</p>
                    <div className="text-[11px] text-slate-500">
                      Actor: {aud.actorName} ({aud.actorRole})
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    );
  }

  // MAIN WORKSPACE: TABLE VIEW & KANBAN BOARD VIEW
  const kanbanColumns: ComplaintStatus[] = [
    'Received',
    'Pending Assignment',
    'Assigned',
    'Under Investigation',
    'Awaiting Institution Response',
    'Resolution Proposed',
    'Escalated',
    'Resolved',
  ];

  return (
    <div className="space-y-5">
      {/* Workspace Header & Search/Filter Toolbar */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-teal-800">
              Authorized Registry · Role Scope: {actor.role}
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Institutional Complaint Management Workspace
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Table / Kanban Switch */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                Registry Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('KANBAN')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'KANBAN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5" />
                Kanban Lifecycle Board
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportWorkspaceCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV ({filteredAndSorted.length})
            </button>
          </div>
        </div>

        {/* Saved Searches & Quick Filter Presets */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">Saved Views:</span>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
              setBureauFilter('ALL');
              setInstitutionFilter('ALL');
              setOverdueOnly(false);
            }}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium"
          >
            All Authorized ({complaints.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setPriorityFilter('Critical');
              setStatusFilter('ALL');
            }}
            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded font-medium"
          >
            Critical Priority
          </button>
          <button
            type="button"
            onClick={() => {
              setOverdueOnly(true);
              setStatusFilter('ALL');
            }}
            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-medium"
          >
            Overdue SLA Cases
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('Awaiting Institution Response');
              setOverdueOnly(false);
            }}
            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded font-medium"
          >
            Awaiting Institution Response
          </button>
        </div>

        {/* Search & Multi-Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label htmlFor="workspace-search" className="block text-xs font-medium text-slate-700 mb-1">
              Search Reference, Title, Institution, Officer
            </label>
            <input
              id="workspace-search"
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. AICTE-2026-00001 or COEP..."
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="ws-status" className="block text-xs font-medium text-slate-700 mb-1">
              Lifecycle Status
            </label>
            <select
              id="ws-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
            >
              <option value="ALL">All Statuses</option>
              <option value="Received">Received</option>
              <option value="Initial Review">Initial Review</option>
              <option value="Pending Assignment">Pending Assignment</option>
              <option value="Assigned">Assigned</option>
              <option value="Under Investigation">Under Investigation</option>
              <option value="Awaiting Institution Response">Awaiting Institution Response</option>
              <option value="Additional Information Required">Additional Information Required</option>
              <option value="Resolution Proposed">Resolution Proposed</option>
              <option value="Resolution Under Review">Resolution Under Review</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
              <option value="Reopened">Reopened</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div>
            <label htmlFor="ws-priority" className="block text-xs font-medium text-slate-700 mb-1">
              Priority
            </label>
            <select
              id="ws-priority"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label htmlFor="ws-bureau" className="block text-xs font-medium text-slate-700 mb-1">
              Bureau / Cell
            </label>
            <select
              id="ws-bureau"
              value={bureauFilter}
              onChange={(e) => {
                setBureauFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
            >
              <option value="ALL">All Bureaus</option>
              {bureaus.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ws-sort" className="block text-xs font-medium text-slate-700 mb-1">
              Sort Order
            </label>
            <select
              id="ws-sort"
              value={`${sortField}:${sortDir}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split(':');
                setSortField(f as any);
                setSortDir(d as 'asc' | 'desc');
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
            >
              <option value="submittedAt:desc">Newest Submitted</option>
              <option value="submittedAt:asc">Oldest Submitted</option>
              <option value="priority:desc">Highest Priority First</option>
              <option value="slaDueAt:asc">Earliest SLA Deadline</option>
              <option value="referenceNumber:asc">Reference Number (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Bulk Assignment Bar when checkboxes selected */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-slate-900 text-white rounded-md flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-mono font-semibold">{selectedIds.length} complaint(s) selected for bulk routing</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Bulk target bureau"
                value={bulkBureauId}
                onChange={(e) => setBulkBureauId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs"
              >
                {bureaus.map((b) => (
                  <option key={b.id} value={b.id}>
                    Route to {b.code} — {b.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkAssign}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded"
              >
                Execute Bulk Assignment
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </section>

      {/* TABLE VIEW */}
      {viewMode === 'TABLE' ? (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all complaints on current page"
                      checked={
                        paginatedComplaints.length > 0 &&
                        paginatedComplaints.every((c) => selectedIds.includes(c.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(paginatedComplaints.map((c) => c.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="py-3 px-3">Reference & Priority</th>
                  <th className="py-3 px-3">Complaint Title & Category</th>
                  <th className="py-3 px-3">Institution</th>
                  <th className="py-3 px-3">Bureau & Officer</th>
                  <th className="py-3 px-3">Lifecycle Status</th>
                  <th className="py-3 px-3 text-right">Ageing & SLA</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {paginatedComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No complaints match the active filter criteria. Reset filters to view all authorized cases.
                    </td>
                  </tr>
                ) : (
                  paginatedComplaints.map((c) => {
                    const sla = calculateCaseAgeingAndSla(c, priorities, '2026-10-26T12:00:00.000Z');
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${c.referenceNumber}`}
                            checked={selectedIds.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds((prev) => [...prev, c.id]);
                              } else {
                                setSelectedIds((prev) => prev.filter((id) => id !== c.id));
                              }
                            }}
                          />
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-bold text-slate-900">{c.referenceNumber}</div>
                          <div
                            className={`text-[11px] font-semibold ${
                              c.priority === 'Critical'
                                ? 'text-red-700'
                                : c.priority === 'High'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {c.priority} Priority
                            {c.escalationLevel > 0 ? ` · L${c.escalationLevel} Esc` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <button
                            type="button"
                            onClick={() => onSelectComplaint(c.id)}
                            className="text-left font-semibold text-slate-900 hover:text-teal-700 line-clamp-1"
                          >
                            {c.title}
                          </button>
                          <div className="text-[11px] text-slate-500 truncate">
                            {c.category} · {c.subcategory}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-900 truncate max-w-[190px]">
                            {c.institutionName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {c.district}, {c.state}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-semibold text-slate-800">{c.bureauId}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                            {c.assignedOfficerName || 'Unassigned'}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              c.status === 'Resolved' || c.status === 'Closed'
                                ? 'text-emerald-700'
                                : c.status === 'Escalated'
                                ? 'text-red-700'
                                : c.status === 'Awaiting Institution Response'
                                ? 'text-amber-700'
                                : 'text-slate-900'
                            }`}
                          >
                            {c.status}
                          </span>
                          <div className="text-[11px] font-mono text-slate-400">
                            Updated {c.updatedAt.slice(0, 10)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <div
                            className={`font-semibold ${
                              sla.slaState === 'OVERDUE'
                                ? 'text-red-700'
                                : sla.slaState === 'APPROACHING_DEADLINE'
                                ? 'text-amber-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {sla.ageDays}d old
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {sla.slaState === 'OVERDUE'
                              ? 'OVERDUE SLA'
                              : sla.slaState === 'RESOLVED_ON_TIME' || sla.slaState === 'RESOLVED_LATE'
                              ? 'Completed'
                              : `Due ${c.slaDueAt.slice(5, 10)}`}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectComplaint(c.id)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition-colors"
                          >
                            Open Case
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="font-mono tabular-nums">
              Showing {filteredAndSorted.length === 0 ? 0 : (page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredAndSorted.length)} of {filteredAndSorted.length} authorized records
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 font-medium"
              >
                Previous
              </button>
              <span className="font-mono tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* KANBAN LIFECYCLE BOARD VIEW */
        <section className="overflow-x-auto pb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[960px]">
            {kanbanColumns.map((stage) => {
              const stageCases = filteredAndSorted.filter((c) => c.status === stage);
              return (
                <div key={stage} className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col">
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200">
                    <h3 className="text-xs font-bold text-slate-900">{stage}</h3>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-600">
                      {stageCases.length}
                    </span>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    {stageCases.length === 0 ? (
                      <div className="p-4 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded">
                        No cases in stage
                      </div>
                    ) : (
                      stageCases.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => onSelectComplaint(c.id)}
                          className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded cursor-pointer transition-colors space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                            <span className="font-bold text-slate-900">{c.referenceNumber}</span>
                            <span
                              className={
                                c.priority === 'Critical'
                                  ? 'text-red-700 font-bold'
                                  : c.priority === 'High'
                                  ? 'text-amber-700 font-semibold'
                                  : 'text-slate-600'
                              }
                            >
                              {c.priority}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-900 line-clamp-2">{c.title}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {c.institutionName} · {c.bureauId}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
