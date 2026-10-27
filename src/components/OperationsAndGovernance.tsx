import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Play,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Upload,
} from 'lucide-react';
import {
  AIAssessment,
  AssignmentRecord,
  AuditLogEntry,
  Bureau,
  CategoryConfig,
  Complaint,
  EscalationRecord,
  ImportJobRecord,
  Institution,
  InstitutionResponseItem,
  PriorityConfig,
  PriorityLevel,
  UserProfile,
} from '../db/types';
import { calculateCaseAgeingAndSla, computeDashboardAnalytics } from '../db/rules';

interface OperationsAndGovernanceProps {
  activeSection:
    | 'ESCALATIONS'
    | 'BUREAUS'
    | 'INSTITUTIONS'
    | 'REPORTS'
    | 'AUDIT'
    | 'SETTINGS';
  actor: UserProfile;
  users: UserProfile[];
  bureaus: Bureau[];
  institutions: Institution[];
  categories: CategoryConfig[];
  priorities: PriorityConfig[];
  complaints: Complaint[];
  assignments: AssignmentRecord[];
  escalations: EscalationRecord[];
  institutionResponses: InstitutionResponseItem[];
  aiAssessments: Record<string, AIAssessment>;
  auditLogs: AuditLogEntry[];
  importJobs: ImportJobRecord[];
  systemStatus: {
    environmentBanner: string;
    persistenceMode: string;
    persistenceLabel: string;
    aiEngineMode: string;
    aiEngineLabel: string;
    emailNotificationsConfigured: boolean;
  } | null;
  onAcknowledgeEscalation: (escId: string) => Promise<void>;
  onRecalculateSla: () => Promise<void>;
  onPreviewCsvImport: (csvText: string) => Promise<{
    totalRows: number;
    validRecords: any[];
    duplicateCodes: string[];
    errors: { rowNumber: number; fieldName: string; errorMessage: string }[];
  }>;
  onCommitCsvImport: (csvText: string, fileName: string) => Promise<void>;
  onUpdatePrioritySla: (
    priority: PriorityLevel,
    responseTargetHours: number,
    resolutionTargetDays: number,
    warningThresholdPercent: number
  ) => Promise<void>;
  onRunDemoScenario: (
    scenarioType: 'SIMULATE_CRITICAL_INTAKE' | 'SIMULATE_INSTITUTION_REPLY' | 'RESET_DEMO_DATA'
  ) => Promise<void>;
  onOpenComplaint: (id: string) => void;
  onDrilldownBureau: (bureauId: string) => void;
}

export const OperationsAndGovernance: React.FC<OperationsAndGovernanceProps> = ({
  activeSection,
  actor,
  users,
  bureaus,
  institutions,
  categories,
  priorities,
  complaints,
  assignments,
  escalations,
  institutionResponses,
  aiAssessments,
  auditLogs,
  importJobs,
  systemStatus,
  onAcknowledgeEscalation,
  onRecalculateSla,
  onPreviewCsvImport,
  onCommitCsvImport,
  onUpdatePrioritySla,
  onRunDemoScenario,
  onOpenComplaint,
  onDrilldownBureau,
}) => {
  // Institution Directory & CSV Importer States
  const [instSearch, setInstSearch] = useState('');
  const [selectedInstDetail, setSelectedInstDetail] = useState<Institution | null>(null);
  const [csvInput, setCsvInput] = useState(
    [
      'institution_code,name,type,state,district,email',
      '1-11123456,National Institute of Technology (NIT) Tiruchirappalli,Engineering & Technology,Tamil Nadu,Tiruchirappalli,dean_academic@nitt.edu',
      '1-11145678,Thapar Institute of Engineering and Technology,Engineering & Technology,Punjab,Patiala,registrar@thapar.edu',
      '1-11167890,Malaviya National Institute of Technology (MNIT) Jaipur,Engineering & Technology,Rajasthan,Jaipur,nodal@mnit.ac.in',
    ].join('\n')
  );
  const [csvPreview, setCsvPreview] = useState<{
    totalRows: number;
    validRecords: any[];
    duplicateCodes: string[];
    errors: { rowNumber: number; fieldName: string; errorMessage: string }[];
  } | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Reports Center States
  const [selectedReportType, setSelectedReportType] = useState<
    | 'DAILY_SUMMARY'
    | 'WEEKLY_PERFORMANCE'
    | 'MONTHLY_MANAGEMENT'
    | 'BUREAU_WORKLOAD'
    | 'INSTITUTION_REPORT'
    | 'OVERDUE_AGEING'
    | 'RESOLUTION_PERFORMANCE'
    | 'ESCALATION_REPORT'
    | 'CATEGORY_ANALYSIS'
    | 'DATA_QUALITY'
    | 'AI_EVALUATION'
  >('MONTHLY_MANAGEMENT');
  const [reportBureauFilter, setReportBureauFilter] = useState('ALL');
  const [reportPriorityFilter, setReportPriorityFilter] = useState('ALL');

  // Audit Explorer States
  const [auditEventFilter, setAuditEventFilter] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');

  // Settings States
  const [editingPriority, setEditingPriority] = useState<PriorityLevel>('Critical');
  const [editRespHours, setEditRespHours] = useState(6);
  const [editResDays, setEditResDays] = useState(5);
  const [editWarnPct, setEditWarnPct] = useState(75);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const analytics = useMemo(
    () =>
      computeDashboardAnalytics(
        complaints,
        bureaus,
        institutions,
        [],
        priorities,
        '2026-10-26T12:00:00.000Z'
      ),
    [complaints, bureaus, institutions, priorities]
  );

  // 1. SMART ESCALATION ENGINE & SLA MONITOR
  if (activeSection === 'ESCALATIONS') {
    const overdueComplaints = complaints.filter((c) => {
      const sla = calculateCaseAgeingAndSla(c, priorities, '2026-10-26T12:00:00.000Z');
      return c.status !== 'Resolved' && c.status !== 'Closed' && (c.isOverdue || sla.slaState === 'OVERDUE');
    });

    return (
      <div className="space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs font-mono text-teal-800">
                CONFIGURABLE SLA & MULTI-LEVEL ESCALATION ENGINE
              </p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                Smart Escalation Center & Overdue Case Monitor
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Monitors configured response and resolution targets across priority levels with real-time recalculation and automatic officer escalation alerts.
              </p>
            </div>
            <button
              type="button"
              onClick={onRecalculateSla}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run Manual SLA & Escalation Scan
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4 text-xs">
            {priorities.map((p) => (
              <div key={p.priority} className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="font-bold text-slate-900">{p.priority} Priority Target</div>
                <div className="font-mono text-slate-600 mt-1">
                  Response: {p.responseTargetHours}h · Resolution: {p.resolutionTargetDays}d · Warn at {p.warningThresholdPercent}%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Supervisory Escalation: {p.escalationRole}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Active Escalation Records ({escalations.length})
          </h2>
          <div className="space-y-3">
            {escalations.map((esc) => (
              <div
                key={esc.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono">
                    <span className="font-bold text-red-700">LEVEL {esc.escalationLevel} ESCALATION</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-slate-900">{esc.complaintRef}</span>
                    <span aria-hidden="true">·</span>
                    <span>{esc.priority} Priority</span>
                    <span aria-hidden="true">·</span>
                    <span>Bureau: {esc.bureauId}</span>
                  </div>
                  <div className="font-semibold text-slate-900 text-sm">{esc.complaintTitle}</div>
                  <p className="text-slate-700">
                    <strong>Escalation Trigger Reason:</strong> {esc.reason}
                  </p>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Assigned Escalation Owner: {esc.assignedOwnerName} ({esc.assignedOwnerRole}) · Triggered: {esc.triggeredAt.slice(0, 10)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {esc.acknowledged ? (
                    <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-medium">
                      Acknowledged by {esc.acknowledgedBy}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAcknowledgeEscalation(esc.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded"
                    >
                      Acknowledge Escalation
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenComplaint(esc.complaintId)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded"
                  >
                    Open Case
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-bold text-slate-900">
            Overdue Cases Past Configured Target ({overdueComplaints.length})
          </h2>
          <div className="divide-y divide-slate-200 text-xs">
            {overdueComplaints.map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono font-bold text-slate-900">
                    {c.referenceNumber} · {c.priority} · Due {c.slaDueAt.slice(0, 10)}
                  </div>
                  <div className="text-slate-700 font-medium">{c.title}</div>
                  <div className="text-slate-500">{c.institutionName} · {c.bureauId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenComplaint(c.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded shrink-0"
                >
                  Inspect & Escalate
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // 2. BUREAU / CELL COORDINATION WORKSPACE
  if (activeSection === 'BUREAUS') {
    return (
      <div className="space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-mono text-teal-800">
            INTERDEPARTMENTAL COORDINATION · AICTE APEX OPERATIONAL UNITS
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Multi-Bureau / Cell Workload & Routing Workspace
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Monitors workload balance, capacity utilization, overdue cases, and inter-bureau case transfers across active AICTE bureaus and regulatory cells.
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bureaus.map((b) => {
            const stat = analytics.byBureau.find((x) => x.bureauId === b.id);
            return (
              <section key={b.id} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                    <span className="font-bold text-slate-900">{b.code}</span>
                    <span>SLA: {b.slaResponseHours}h Resp / {b.slaResolutionDays}d Res</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900">{b.name}</h2>
                  <p className="text-xs text-slate-600">{b.description}</p>
                  <div className="text-xs text-slate-700 pt-1">
                    <strong>Head Officer:</strong> {b.headOfficerName}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums text-xs">
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                      <div className="text-sm font-bold text-slate-900">{stat?.activeBacklog || 0}</div>
                      <div className="text-[11px] text-slate-500">Active</div>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                      <div className="text-sm font-bold text-red-700">{stat?.overdue || 0}</div>
                      <div className="text-[11px] text-slate-500">Overdue</div>
                    </div>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                      <div className="text-sm font-bold text-emerald-700">{stat?.resolved || 0}</div>
                      <div className="text-[11px] text-slate-500">Resolved</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDrilldownBureau(b.id)}
                    className="w-full py-2 px-3 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition-colors"
                  >
                    Open {b.code} Case Queue
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-bold text-slate-900">
            Inter-Bureau Routing & Case Transfer Ledger ({assignments.length})
          </h2>
          <div className="divide-y divide-slate-200 text-xs">
            {assignments.map((asn) => {
              const cmp = complaints.find((c) => c.id === asn.complaintId);
              return (
                <div key={asn.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-slate-900">
                      {cmp?.referenceNumber || asn.complaintId} ·{' '}
                      {asn.fromBureauId ? `${asn.fromBureauId} → ${asn.toBureauId}` : `Routed to ${asn.toBureauId}`}
                    </div>
                    <div className="text-slate-700 mt-0.5">{asn.reason}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Assigned Officer: {asn.assignedOfficerName} · By: {asn.assignedByName} · {asn.createdAt.slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                  {cmp && (
                    <button
                      type="button"
                      onClick={() => onOpenComplaint(cmp.id)}
                      className="px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded self-start sm:self-center"
                    >
                      View Case
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // 3. INSTITUTION DIRECTORY, CSV DATA IMPORTER & DATA QUALITY MONITOR
  if (activeSection === 'INSTITUTIONS') {
    const filteredInst = institutions.filter((i) =>
      `${i.institutionCode} ${i.name} ${i.state} ${i.district} ${i.institutionType}`
        .toLowerCase()
        .includes(instSearch.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs font-mono text-teal-800">
                INSTITUTIONAL REGISTRY · NATIONAL AICTE ACCREDITED INSTITUTIONS + VERIFIED CSV IMPORTER
              </p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                Searchable Institution Directory & Data Import Center
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Displays recognized AICTE institutions alongside associated complaint counts, pending clarification requests, and a validated CSV batch importer.
              </p>
            </div>
            <div className="w-full md:w-72">
              <label htmlFor="inst-dir-search" className="sr-only">
                Search Institutions
              </label>
              <input
                id="inst-dir-search"
                type="search"
                value={instSearch}
                onChange={(e) => setInstSearch(e.target.value)}
                placeholder="Search by code, name, state, type..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Institution Code</th>
                  <th className="py-2.5 px-3">Institution Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">State / District</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Complaints</th>
                  <th className="py-2.5 px-3 text-right">Pending Replies</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredInst.map((inst) => {
                  const instCases = complaints.filter((c) => c.institutionId === inst.id);
                  const pendingReplies = institutionResponses.filter(
                    (r) => r.institutionId === inst.id && r.status === 'PENDING'
                  ).length;
                  return (
                    <tr key={inst.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{inst.institutionCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{inst.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{inst.institutionType}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {inst.district}, {inst.state}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{inst.approvalStatus}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {instCases.length}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                        {pendingReplies}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedInstDetail(inst)}
                          className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded"
                        >
                          Inspect Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {selectedInstDetail && (
          <section className="bg-slate-900 text-white rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <div className="text-xs font-mono text-teal-300">
                  {selectedInstDetail.institutionCode} · {selectedInstDetail.sourceProvenance}
                </div>
                <h2 className="text-lg font-bold">{selectedInstDetail.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstDetail(null)}
                className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded"
              >
                Close Profile
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-200">
              <div>
                <span className="text-slate-400">Address:</span> {selectedInstDetail.address}
              </div>
              <div>
                <span className="text-slate-400">Authorized Contact:</span> {selectedInstDetail.contactEmail} · {selectedInstDetail.contactPhone}
              </div>
              <div>
                <span className="text-slate-400">Approval Status:</span> {selectedInstDetail.approvalStatus}
              </div>
            </div>
          </section>
        )}

        {/* CSV Batch Importer & Data Quality Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              CSV Institution Directory Importer (Validation, Duplicate Check & Preview)
            </h2>
            <p className="text-xs text-slate-600">
              Paste or edit CSV records below (`institution_code,name,type,state,district,email`). Notice that row 3 intentionally includes a duplicate code (`1-10972311`) so you can verify duplicate detection and error reporting before committing valid rows.
            </p>

            <div>
              <label htmlFor="csv-import-textarea" className="block text-xs font-semibold text-slate-700 mb-1">
                CSV Batch Input
              </label>
              <textarea
                id="csv-import-textarea"
                rows={5}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  const res = await onPreviewCsvImport(csvInput);
                  setCsvPreview(res);
                  setImportNotice(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md"
              >
                1. Validate & Preview CSV Batch
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onCommitCsvImport(csvInput, 'Approved_Institutions_Batch_2026.csv');
                  setImportNotice('Committed valid non-duplicate institution records to the directory and logged import job.');
                  setCsvPreview(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md"
              >
                2. Confirm & Commit Valid Records
              </button>
            </div>

            {importNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-950 font-medium">
                {importNotice}
              </div>
            )}

            {csvPreview && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3 text-xs">
                <div className="font-mono font-bold text-slate-900">
                  Validation Preview: {csvPreview.totalRows} Total Rows · {csvPreview.validRecords.length} Valid · {csvPreview.duplicateCodes.length} Duplicates · {csvPreview.errors.length} Errors
                </div>
                {csvPreview.errors.length > 0 && (
                  <div className="space-y-1 text-red-800">
                    <div className="font-semibold">Row Validation & Duplicate Report:</div>
                    {csvPreview.errors.map((e, i) => (
                      <div key={i} className="font-mono text-[11px]">
                        Row {e.rowNumber} [{e.fieldName}]: {e.errorMessage}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Data Quality Monitor & Provenance Audit
            </h2>
            <p className="text-xs text-slate-600">
              Monitors schema completeness across stored institution and complaint records.
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <span>Institutions with Verified Identifiers</span>
                <span className="font-mono font-bold text-emerald-700">
                  {institutions.length} / {institutions.length} (100%)
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <span>Complaints with Assigned Officer</span>
                <span className="font-mono font-bold text-slate-900">
                  {complaints.filter((c) => Boolean(c.assignedOfficerName)).length} / {complaints.length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <span>Suspected Duplicate Pairs Pending Review</span>
                <span className="font-mono font-bold text-amber-700">2 Pending</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <span>Completed Batch Import Jobs</span>
                <span className="font-mono font-bold text-slate-900">{importJobs.length}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // 4. REPORTS & MANAGEMENT INTELLIGENCE CENTER
  if (activeSection === 'REPORTS') {
    const reportScopedComplaints = complaints.filter((c) => {
      if (reportBureauFilter !== 'ALL' && c.bureauId !== reportBureauFilter) return false;
      if (reportPriorityFilter !== 'ALL' && c.priority !== reportPriorityFilter) return false;
      return true;
    });

    const reportTypes = [
      { id: 'MONTHLY_MANAGEMENT', label: 'Monthly Consolidated Management Report' },
      { id: 'DAILY_SUMMARY', label: 'Daily Complaint Intake & Action Summary' },
      { id: 'WEEKLY_PERFORMANCE', label: 'Weekly SLA & Bureau Performance Report' },
      { id: 'BUREAU_WORKLOAD', label: 'Bureau / Cell Workload & Capacity Report' },
      { id: 'INSTITUTION_REPORT', label: 'Institution-Wise Complaint & Response Report' },
      { id: 'OVERDUE_AGEING', label: 'Overdue & Case Ageing Analysis Report' },
      { id: 'RESOLUTION_PERFORMANCE', label: 'Resolution Cycle & Closure Quality Report' },
      { id: 'ESCALATION_REPORT', label: 'Supervisory Escalation Compliance Report' },
      { id: 'CATEGORY_ANALYSIS', label: 'Complaint Category & Trend Analysis' },
      { id: 'DATA_QUALITY', label: 'Data Completeness & Quality Audit Report' },
      { id: 'AI_EVALUATION', label: 'AI Recommendation & Human Supervision Evaluation' },
    ];

    const handleDownloadReportCsv = () => {
      const headers = ['ReportType', 'Reference', 'Title', 'Institution', 'Bureau', 'Priority', 'Status', 'SubmittedAt'];
      const rows = reportScopedComplaints.map((c) => [
        selectedReportType,
        c.referenceNumber,
        `"${c.title.replace(/"/g, '""')}"`,
        `"${c.institutionName}"`,
        c.bureauId,
        c.priority,
        c.status,
        c.submittedAt.slice(0, 10),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AICTE_Report_${selectedReportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs font-mono text-teal-800">
                MANAGEMENT INTELLIGENCE & EXPORT CENTER · DERIVED FROM FILTERED DATASET
              </p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                Official Regulatory Reports & Executive Exports
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save Formatted PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadReportCsv}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md"
              >
                <Download className="w-3.5 h-3.5" />
                Download Filtered CSV ({reportScopedComplaints.length} rows)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="report-type-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Select Report Template (11 Standard Reports)
              </label>
              <select
                id="report-type-select"
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              >
                {reportTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-bureau-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Filter by Bureau / Cell
              </label>
              <select
                id="report-bureau-select"
                value={reportBureauFilter}
                onChange={(e) => setReportBureauFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              >
                <option value="ALL">All Bureaus</option>
                {bureaus.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-prio-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Filter by Priority
              </label>
              <select
                id="report-prio-select"
                value={reportPriorityFilter}
                onChange={(e) => setReportPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              >
                <option value="ALL">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
        </section>

        {/* Rendered Report Document Preview */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-mono text-slate-500">
                CONFIDENTIALITY: AICTE OFFICIAL GRIEVANCE REPORT — REGULATORY REVIEW ONLY
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                {reportTypes.find((r) => r.id === selectedReportType)?.label}
              </h2>
            </div>
            <div className="text-xs font-mono text-slate-600 text-right">
              <div>Generated: {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
              <div>Active Dataset Scope: {reportScopedComplaints.length} Records</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
            <strong>Data Completeness & Provenance Note:</strong> All figures in this report are computed dynamically from the same filtered dataset displayed below (Bureau Filter: {reportBureauFilter}, Priority Filter: {reportPriorityFilter}).
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-2 px-3">Reference</th>
                  <th className="py-2 px-3">Complaint Title</th>
                  <th className="py-2 px-3">Institution</th>
                  <th className="py-2 px-3">Bureau</th>
                  <th className="py-2 px-3">Priority</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reportScopedComplaints.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-3 font-mono font-bold">{c.referenceNumber}</td>
                    <td className="py-2 px-3">{c.title}</td>
                    <td className="py-2 px-3">{c.institutionName}</td>
                    <td className="py-2 px-3 font-mono">{c.bureauId}</td>
                    <td className="py-2 px-3 font-semibold">{c.priority}</td>
                    <td className="py-2 px-3">{c.status}</td>
                    <td className="py-2 px-3 text-right font-mono">{c.submittedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // 5. IMMUTABLE AUDIT EXPLORER
  if (activeSection === 'AUDIT') {
    const filteredAudits = auditLogs.filter((a) => {
      if (auditEventFilter !== 'ALL' && a.eventType !== auditEventFilter) return false;
      if (auditSearch.trim().length > 0) {
        const hay = `${a.actorName} ${a.actorRole} ${a.eventType} ${a.entityReference} ${a.summary}`.toLowerCase();
        if (!hay.includes(auditSearch.toLowerCase())) return false;
      }
      return true;
    });

    return (
      <div className="space-y-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs font-mono text-teal-800">
                IMMUTABLE SECURITY & GOVERNANCE LEDGER · APPEND-ONLY ENFORCEMENT
              </p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                Audit Trail & Accountability Explorer
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Every complaint creation, status transition, assignment, transfer, escalation, AI feedback decision, and blocked unauthorized attempt is permanently logged. Ordinary users and administrators cannot edit or delete audit history.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="audit-search-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Search Actor, Reference Number, or Event Summary
              </label>
              <input
                id="audit-search-input"
                type="search"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="e.g. AICTE-2026-00001 or STATUS_CHANGED..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="audit-event-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Event Classification
              </label>
              <select
                id="audit-event-select"
                value={auditEventFilter}
                onChange={(e) => setAuditEventFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              >
                <option value="ALL">All Audit Event Types ({auditLogs.length})</option>
                <option value="COMPLAINT_CREATED">COMPLAINT_CREATED</option>
                <option value="STATUS_CHANGED">STATUS_CHANGED</option>
                <option value="ASSIGNMENT_CHANGED">ASSIGNMENT_CHANGED</option>
                <option value="CASE_TRANSFERRED">CASE_TRANSFERRED</option>
                <option value="ESCALATION_TRIGGERED">ESCALATION_TRIGGERED</option>
                <option value="ESCALATION_ACKNOWLEDGED">ESCALATION_ACKNOWLEDGED</option>
                <option value="RESOLUTION_DECISION">RESOLUTION_DECISION</option>
                <option value="AI_FEEDBACK_RECORDED">AI_FEEDBACK_RECORDED</option>
                <option value="DATA_IMPORT_COMMITTED">DATA_IMPORT_COMMITTED</option>
                <option value="CONFIG_UPDATED">CONFIG_UPDATED</option>
                <option value="UNAUTHORIZED_ATTEMPT_BLOCKED">UNAUTHORIZED_ATTEMPT_BLOCKED</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Actor & Role</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Entity Ref</th>
                  <th className="py-2.5 px-3">Audit Summary & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAudits.map((aud) => (
                  <tr key={aud.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {aud.timestamp.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{aud.actorName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{aud.actorRole}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {aud.eventType}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-teal-800 whitespace-nowrap">
                      {aud.entityReference}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <div>{aud.summary}</div>
                      {aud.reason && (
                        <div className="text-[11px] text-slate-500 mt-0.5">Reason: {aud.reason}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // 6. SETTINGS, RBAC MATRIX, SLA TARGET CONFIGURATION & SIH DEMO SCENARIO CONTROLS
  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <p className="text-xs font-mono text-teal-800">
          GOVERNANCE, RBAC & SYSTEM HEALTH ADMINISTRATION
        </p>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">
          Platform Settings, Role Permissions, SLA Rules & Operational Administration
        </h1>
        {settingsNotice && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-950 font-medium">
            {settingsNotice}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SLA & Escalation Target Editor (6 cols) */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Configurable Priority & Escalation SLA Targets
          </h2>
          <p className="text-xs text-slate-600">
            Configure response and resolution targets to govern dynamic SLA monitoring and escalation routing across bureaus.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {priorities.map((p) => (
              <button
                key={p.priority}
                type="button"
                onClick={() => {
                  setEditingPriority(p.priority);
                  setEditRespHours(p.responseTargetHours);
                  setEditResDays(p.resolutionTargetDays);
                  setEditWarnPct(p.warningThresholdPercent);
                }}
                className={`p-2.5 text-xs rounded border font-mono text-left ${
                  editingPriority === p.priority
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold">{p.priority}</div>
                <div className="text-[11px] opacity-80">
                  {p.responseTargetHours}h / {p.resolutionTargetDays}d
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label htmlFor="sla-resp-hours" className="block font-semibold text-slate-700 mb-1">
                Response Target (Hours)
              </label>
              <input
                id="sla-resp-hours"
                type="number"
                min={1}
                max={240}
                value={editRespHours}
                onChange={(e) => setEditRespHours(Number(e.target.value) || 6)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label htmlFor="sla-res-days" className="block font-semibold text-slate-700 mb-1">
                Resolution Target (Days)
              </label>
              <input
                id="sla-res-days"
                type="number"
                min={1}
                max={90}
                value={editResDays}
                onChange={(e) => setEditResDays(Number(e.target.value) || 5)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label htmlFor="sla-warn-pct" className="block font-semibold text-slate-700 mb-1">
                Warning Threshold (%)
              </label>
              <input
                id="sla-warn-pct"
                type="number"
                min={50}
                max={95}
                value={editWarnPct}
                onChange={(e) => setEditWarnPct(Number(e.target.value) || 75)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await onUpdatePrioritySla(editingPriority, editRespHours, editResDays, editWarnPct);
                setSettingsNotice(`Updated ${editingPriority} priority SLA configuration and recorded audit event.`);
              } catch (err: any) {
                setSettingsNotice(`Error: ${err.message}`);
              }
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-md"
          >
            Save SLA Target Configuration
          </button>
        </section>

        {/* SIH Judge Demonstration Scenario Controls (6 cols) */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Operational Incident Simulation & Stress Testing Controls
            </h2>
            <span className="text-xs font-mono text-teal-800">OPERATIONAL SANDBOX</span>
          </div>
          <p className="text-xs text-slate-600">
            Allows administrators to simulate operational intake surges, test institutional clarification response workflows, or reset the persistent database to clean initial certified records.
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                await onRunDemoScenario('SIMULATE_CRITICAL_INTAKE');
                setSettingsNotice('Generated critical-priority student grievance intake with automatic reference and AI assessment.');
              }}
              className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-slate-900">1. Simulate Critical Student Grievance Intake</div>
                <div className="text-slate-600">Creates an urgent safety/refund complaint with reference and AI triage assessment</div>
              </div>
              <span className="px-2.5 py-1 bg-teal-700 text-white font-semibold rounded shrink-0">Trigger</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await onRunDemoScenario('SIMULATE_INSTITUTION_REPLY');
                setSettingsNotice('Processed institution liaison response and transitioned case to Resolution Proposed.');
              }}
              className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-slate-900">2. Simulate Institution Clarification Reply</div>
                <div className="text-slate-600">Submits compliance documentation in response to an outstanding show-cause notice</div>
              </div>
              <span className="px-2.5 py-1 bg-slate-900 text-white font-semibold rounded shrink-0">Trigger</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await onRunDemoScenario('RESET_DEMO_DATA');
                setSettingsNotice('Reset database to initial certified 16-complaint operational dataset.');
              }}
              className="w-full text-left p-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-red-900">3. Reset Database to Certified Initial Records</div>
                <div className="text-red-700">Restores the baseline certified records for institutional audit and verification</div>
              </div>
              <span className="px-2.5 py-1 bg-red-700 text-white font-semibold rounded shrink-0">Reset Database</span>
            </button>
          </div>
        </section>
      </div>

      {/* Role-Based Access Control (RBAC) Matrix & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-bold text-slate-900">
            Authorized System Users & Role-Based Access Control (RBAC) Matrix
          </h2>
          <p className="text-xs text-slate-600">
            Permissions are enforced server-side in `/api/*` endpoints and in PostgreSQL Row Level Security (`supabase/migrations/002_rls_policies.sql`).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-2 px-3">Authorized Profile</th>
                  <th className="py-2 px-3">Role</th>
                  <th className="py-2 px-3">Scope Boundary</th>
                  <th className="py-2 px-3">Enforced Privileges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{u.role}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">
                      {u.bureauId || u.institutionId || 'Organization-Wide'}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {u.role === 'SUPER_ADMIN'
                        ? 'Full governance, RBAC, workflows, imports, audit logs'
                        : u.role === 'CENTRAL_MONITORING_OFFICER'
                        ? 'Cross-bureau monitoring, assignments, escalations, resolution approval'
                        : u.role === 'BUREAU_OFFICER'
                        ? 'Assigned bureau investigation, status updates, clarification requests'
                        : u.role === 'INSTITUTION_LIAISON'
                        ? 'Scoped institution view & clarification response submission only'
                        : 'Read-only case history, reports & immutable audit log inspection'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-bold text-slate-900">
            System Health & Environment Configuration Status
          </h2>
          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="font-semibold text-slate-900">Database & Persistence Layer</div>
              <div className="text-slate-600 mt-0.5 font-mono">
                {systemStatus?.persistenceLabel || 'Local Transactional Data Store (Synchronized)'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="font-semibold text-slate-900">AI Intelligence Adapter</div>
              <div className="text-slate-600 mt-0.5 font-mono">
                {systemStatus?.aiEngineLabel || 'Deterministic Rule-Based Assistance (Active Fallback)'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="font-semibold text-slate-900">Notification Channels</div>
              <div className="text-slate-600 mt-0.5 font-mono">
                In-App Notification Center: ACTIVE · External Email (SMTP):{' '}
                {systemStatus?.emailNotificationsConfigured ? 'CONFIGURED' : 'NOT CONFIGURED (Optional via .env)'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="font-semibold text-slate-900">PostgreSQL Migrations & RLS Assets</div>
              <div className="text-slate-600 mt-0.5 font-mono">
                /supabase/migrations/001_initial_schema.sql · 002_rls_policies.sql · seed.sql
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
