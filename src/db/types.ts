// ============================================================================
// AICTE COMPLAINT INTELLIGENCE HUB — DOMAIN TYPES & SCHEMA DEFINITIONS
// ============================================================================

export type UserRole =
  | 'SUPER_ADMIN'
  | 'CENTRAL_MONITORING_OFFICER'
  | 'BUREAU_OFFICER'
  | 'INSTITUTION_LIAISON'
  | 'AUDITOR';

export type ComplaintStatus =
  | 'Received'
  | 'Initial Review'
  | 'Pending Assignment'
  | 'Assigned'
  | 'Under Investigation'
  | 'Awaiting Institution Response'
  | 'Additional Information Required'
  | 'Resolution Proposed'
  | 'Resolution Under Review'
  | 'Resolved'
  | 'Reopened'
  | 'Closed'
  | 'Escalated';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type NoteVisibility = 'INTERNAL' | 'INSTITUTION_VISIBLE' | 'PUBLIC_SUMMARY';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  bureauId: string | null;
  institutionId: string | null;
  designation: string;
  active: boolean;
  isDemoUser: boolean;
}

export interface Bureau {
  id: string;
  code: string;
  name: string;
  description: string;
  headOfficerName: string;
  slaResponseHours: number;
  slaResolutionDays: number;
  capacityLimit: number;
  active: boolean;
  isDemoConfig: boolean;
}

export interface Institution {
  id: string;
  institutionCode: string;
  name: string;
  institutionType: 'Engineering & Technology' | 'Management' | 'Pharmacy' | 'Architecture & Planning' | 'Polytechnic';
  state: string;
  district: string;
  address: string;
  approvalStatus: 'Approved' | 'Approved - Autonomous' | 'Approved - Under Scrutiny' | 'Provisional' | string;
  contactEmail: string;
  contactPhone: string;
  sourceProvenance: string;
  isDemoRecord: boolean;
  createdAt: string;
}

export interface CategoryConfig {
  id: string;
  name: string;
  subcategories: string[];
  defaultBureauId: string;
  defaultPriority: PriorityLevel;
  active: boolean;
}

export interface PriorityConfig {
  priority: PriorityLevel;
  weight: number;
  responseTargetHours: number;
  resolutionTargetDays: number;
  warningThresholdPercent: number;
  escalationRole: UserRole;
}

export interface StatusTransitionEvent {
  id: string;
  complaintId: string;
  previousStatus: ComplaintStatus | null;
  newStatus: ComplaintStatus;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  reason: string;
  comment?: string;
  timestamp: string;
}

export interface AssignmentRecord {
  id: string;
  complaintId: string;
  fromBureauId: string | null;
  toBureauId: string;
  assignedOfficerId: string | null;
  assignedOfficerName: string | null;
  assignedById: string;
  assignedByName: string;
  reason: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface CaseComment {
  id: string;
  complaintId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  visibility: NoteVisibility;
  noteType: 'INVESTIGATION_NOTE' | 'CLARIFICATION_REQUEST' | 'SUPERVISORY_DIRECTIVE' | 'RESOLUTION_NOTE';
  content: string;
  createdAt: string;
}

export interface InstitutionResponseItem {
  id: string;
  complaintId: string;
  institutionId: string;
  requestedByName: string;
  requestQuestion: string;
  requestedAt: string;
  dueAt: string;
  responseText: string | null;
  respondedByName: string | null;
  respondedAt: string | null;
  status: 'PENDING' | 'SUBMITTED' | 'VERIFIED';
}

export interface CaseAttachment {
  id: string;
  complaintId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedByName: string;
  uploadedAt: string;
  checksumSha256: string;
}

export interface ComplaintRelationship {
  id: string;
  sourceComplaintId: string;
  targetComplaintId: string;
  relationshipType: 'SUSPECTED_DUPLICATE' | 'CONFIRMED_DUPLICATE' | 'RELATED_INSTITUTION_ISSUE';
  similarityScore: number;
  matchReasons: string[];
  confirmedByName: string | null;
  confirmedAt: string | null;
  status: 'SUSPECTED' | 'CONFIRMED' | 'DISMISSED';
}

export interface EscalationRecord {
  id: string;
  complaintId: string;
  complaintRef: string;
  complaintTitle: string;
  bureauId: string;
  priority: PriorityLevel;
  escalationLevel: number;
  reason: string;
  assignedOwnerRole: UserRole;
  assignedOwnerName: string;
  triggeredAt: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolved: boolean;
}

export interface AIAssessment {
  id: string;
  complaintId: string;
  engineMode: 'DETERMINISTIC_RULE_ENGINE' | 'SERVER_LLM_ADAPTER';
  suggestedCategory: string;
  suggestedSubcategory: string;
  suggestedPriority: PriorityLevel;
  suggestedBureauId: string;
  confidenceScore: number;
  priorityFactors: {
    factor: string;
    impact: string;
    scoreContribution: number;
  }[];
  executiveSummary: {
    coreIssue: string;
    institutionInvolved: string;
    reportedAllegations: string[];
    evidenceSupplied: string;
    missingInformation: string[];
    suggestedNextStep: string;
  };
  suggestedNextActions: {
    action: string;
    rationale: string;
    ruleTriggered: string;
  }[];
  urgencySignals: {
    term: string;
    signalCategory: 'Compliance Risk' | 'Student Welfare' | 'Financial Impact' | 'Safety/Infrastructure' | 'Distress Indicator';
    note: string;
  }[];
  explainabilityNotes: string;
  limitationsDisclosure: string;
  humanReviewStatus: 'PENDING_REVIEW' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED';
  reviewedByName: string | null;
  reviewedAt: string | null;
  generatedAt: string;
}

export interface AIFeedbackEntry {
  id: string;
  complaintId: string;
  actorId: string;
  actorName: string;
  decision: 'ACCEPTED' | 'MODIFIED' | 'REJECTED';
  modifiedCategory?: string;
  modifiedPriority?: PriorityLevel;
  notes: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  institutionId: string;
  institutionName: string;
  state: string;
  district: string;
  bureauId: string;
  assignedOfficerId: string | null;
  assignedOfficerName: string | null;
  priority: PriorityLevel;
  status: ComplaintStatus;
  sourceChannel: string;
  complainantType: string;
  affectedCount: number;
  submittedAt: string;
  updatedAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  slaDueAt: string;
  escalationLevel: number;
  isOverdue: boolean;
  isDemoData: boolean;
  resolutionSummary: string | null;
}

export interface NotificationItem {
  id: string;
  recipientRole: UserRole | 'ALL';
  recipientBureauId: string | null;
  eventType:
    | 'NEW_ASSIGNMENT'
    | 'REASSIGNMENT'
    | 'INFO_REQUEST'
    | 'INSTITUTION_RESPONSE'
    | 'APPROACHING_DEADLINE'
    | 'OVERDUE_ALERT'
    | 'ESCALATION'
    | 'RESOLUTION_PROPOSED'
    | 'CASE_REOPENED';
  title: string;
  message: string;
  complaintId: string;
  complaintRef: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  eventType:
    | 'AUTH_SESSION'
    | 'COMPLAINT_CREATED'
    | 'ASSIGNMENT_CHANGED'
    | 'STATUS_CHANGED'
    | 'CASE_TRANSFERRED'
    | 'ESCALATION_TRIGGERED'
    | 'ESCALATION_ACKNOWLEDGED'
    | 'RESOLUTION_DECISION'
    | 'CASE_REOPENED'
    | 'AI_FEEDBACK_RECORDED'
    | 'DATA_IMPORT_COMMITTED'
    | 'REPORT_EXPORTED'
    | 'CONFIG_UPDATED'
    | 'UNAUTHORIZED_ATTEMPT_BLOCKED';
  entityType: 'COMPLAINT' | 'INSTITUTION' | 'BUREAU' | 'USER_ROLE' | 'WORKFLOW_CONFIG' | 'REPORT';
  entityReference: string;
  summary: string;
  reason?: string;
  timestamp: string;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: {
    search?: string;
    bureauId?: string;
    status?: string;
    priority?: string;
    institutionId?: string;
  };
  createdAt: string;
}

export interface ImportJobRecord {
  id: string;
  actorName: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  status: 'COMPLETED' | 'VALIDATED_PREVIEW' | 'REJECTED';
  createdAt: string;
  errors: {
    rowNumber: number;
    fieldName: string;
    errorMessage: string;
  }[];
}

export interface DatabaseState {
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
