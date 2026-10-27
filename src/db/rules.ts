// ============================================================================
// AICTE COMPLAINT INTELLIGENCE HUB — PURE BUSINESS LOGIC & RULES ENGINE
// Decoupled, deterministic, unit-testable rules for workflow, RBAC, AI & SLA
// ============================================================================

import {
  AIAssessment,
  Bureau,
  CategoryConfig,
  Complaint,
  ComplaintRelationship,
  ComplaintStatus,
  Institution,
  PriorityConfig,
  PriorityLevel,
  StatusTransitionEvent,
  UserProfile,
  UserRole,
} from './types';

// 1. COMPLETE COMPLAINT LIFECYCLE & STATE-TRANSITION POLICY
export const COMPLAINT_LIFECYCLE_STAGES: ComplaintStatus[] = [
  'Received',
  'Initial Review',
  'Pending Assignment',
  'Assigned',
  'Under Investigation',
  'Awaiting Institution Response',
  'Additional Information Required',
  'Resolution Proposed',
  'Resolution Under Review',
  'Resolved',
  'Reopened',
  'Closed',
  'Escalated',
];

export const ALLOWED_STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  'Received': ['Initial Review', 'Pending Assignment', 'Assigned', 'Escalated'],
  'Initial Review': ['Pending Assignment', 'Assigned', 'Additional Information Required', 'Escalated'],
  'Pending Assignment': ['Assigned', 'Escalated'],
  'Assigned': ['Under Investigation', 'Awaiting Institution Response', 'Additional Information Required', 'Escalated'],
  'Under Investigation': [
    'Awaiting Institution Response',
    'Additional Information Required',
    'Resolution Proposed',
    'Escalated',
  ],
  'Awaiting Institution Response': [
    'Under Investigation',
    'Additional Information Required',
    'Resolution Proposed',
    'Escalated',
  ],
  'Additional Information Required': ['Under Investigation', 'Awaiting Institution Response', 'Escalated'],
  'Resolution Proposed': ['Resolution Under Review', 'Under Investigation', 'Resolved', 'Escalated'],
  'Resolution Under Review': ['Resolved', 'Under Investigation', 'Escalated'],
  'Resolved': ['Closed', 'Reopened'],
  'Reopened': ['Assigned', 'Under Investigation', 'Awaiting Institution Response', 'Escalated'],
  'Closed': ['Reopened'],
  'Escalated': [
    'Assigned',
    'Under Investigation',
    'Awaiting Institution Response',
    'Resolution Proposed',
    'Resolution Under Review',
    'Resolved',
  ],
};

// Which roles are permitted to trigger specific target statuses
export const ROLE_TRANSITION_PERMISSIONS: Record<ComplaintStatus, UserRole[]> = {
  'Received': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER'],
  'Initial Review': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'],
  'Pending Assignment': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER'],
  'Assigned': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'],
  'Under Investigation': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'],
  'Awaiting Institution Response': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'],
  'Additional Information Required': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'],
  'Resolution Proposed': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'],
  'Resolution Under Review': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER'],
  'Resolved': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER'],
  'Reopened': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER'],
  'Closed': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER'],
  'Escalated': ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'],
};

export function validateStatusTransition(
  currentStatus: ComplaintStatus,
  targetStatus: ComplaintStatus,
  user: UserProfile,
  complaintBureauId: string,
  reason: string
): { valid: boolean; error?: string } {
  if (!reason || reason.trim().length < 5) {
    return { valid: false, error: 'A clear administrative reason (minimum 5 characters) is required for every lifecycle transition.' };
  }

  if (user.role === 'AUDITOR') {
    return { valid: false, error: 'Access Denied: Read-Only Auditors cannot modify complaint statuses.' };
  }

  if (user.role === 'INSTITUTION_LIAISON') {
    return { valid: false, error: 'Access Denied: Institution Liaison Officers can submit clarification responses but cannot directly change lifecycle status.' };
  }

  if (user.role === 'BUREAU_OFFICER' && user.bureauId && user.bureauId !== complaintBureauId) {
    return { valid: false, error: 'Access Denied: Bureau Officers may only update cases assigned to their authorized bureau/cell.' };
  }

  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid workflow transition: Cannot transition directly from "${currentStatus}" to "${targetStatus}". Allowed next states: ${allowedNext.join(', ')}.`,
    };
  }

  const permittedRoles = ROLE_TRANSITION_PERMISSIONS[targetStatus] || [];
  if (!permittedRoles.includes(user.role)) {
    return {
      valid: false,
      error: `Permission Denied: Role "${user.role}" is not authorized to transition a complaint to "${targetStatus}". Supervisory approval required.`,
    };
  }

  return { valid: true };
}

// 2. ROW-LEVEL SECURITY (RLS) SCOPING IN APPLICATION LAYER
export function canUserViewComplaint(user: UserProfile, complaint: Complaint): boolean {
  if (
    user.role === 'SUPER_ADMIN' ||
    user.role === 'CENTRAL_MONITORING_OFFICER' ||
    user.role === 'AUDITOR'
  ) {
    return true;
  }
  if (user.role === 'BUREAU_OFFICER') {
    return !user.bureauId || complaint.bureauId === user.bureauId;
  }
  if (user.role === 'INSTITUTION_LIAISON') {
    return !user.institutionId || complaint.institutionId === user.institutionId;
  }
  return false;
}

export function filterAuthorizedComplaints(user: UserProfile, complaints: Complaint[]): Complaint[] {
  return complaints.filter((c) => canUserViewComplaint(user, c));
}

export function canUserPerformAction(
  user: UserProfile,
  action:
    | 'REGISTER_COMPLAINT'
    | 'ASSIGN_COMPLAINT'
    | 'UPDATE_STATUS'
    | 'ADD_INTERNAL_NOTE'
    | 'REQUEST_INSTITUTION_INFO'
    | 'SUBMIT_INSTITUTION_RESPONSE'
    | 'MANAGE_USERS_AND_ROLES'
    | 'CONFIGURE_WORKFLOW'
    | 'IMPORT_INSTITUTIONS'
    | 'VIEW_AUDIT_LOGS'
    | 'EXPORT_REPORTS'
): boolean {
  switch (action) {
    case 'REGISTER_COMPLAINT':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'].includes(user.role);
    case 'ASSIGN_COMPLAINT':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'].includes(user.role);
    case 'UPDATE_STATUS':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'].includes(user.role);
    case 'ADD_INTERNAL_NOTE':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'].includes(user.role);
    case 'REQUEST_INSTITUTION_INFO':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER'].includes(user.role);
    case 'SUBMIT_INSTITUTION_RESPONSE':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'INSTITUTION_LIAISON'].includes(user.role);
    case 'MANAGE_USERS_AND_ROLES':
      return user.role === 'SUPER_ADMIN';
    case 'CONFIGURE_WORKFLOW':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER'].includes(user.role);
    case 'IMPORT_INSTITUTIONS':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER'].includes(user.role);
    case 'VIEW_AUDIT_LOGS':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'AUDITOR'].includes(user.role);
    case 'EXPORT_REPORTS':
      return ['SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER', 'AUDITOR'].includes(user.role);
    default:
      return false;
  }
}

export function generateComplaintReference(existingCount: number, year = 2026): string {
  const sequence = String(existingCount + 1).padStart(5, '0');
  return `AICTE-${year}-${sequence}`;
}

// 4. SMART ESCALATION & AGEING ENGINE
export function calculateCaseAgeingAndSla(
  complaint: Pick<Complaint, 'submittedAt' | 'slaDueAt' | 'status' | 'priority' | 'resolvedAt'>,
  priorityConfigs: PriorityConfig[],
  referenceNowIso = new Date().toISOString()
): {
  ageDays: number;
  ageHours: number;
  remainingHours: number;
  slaConsumedPercent: number;
  slaState: 'RESOLVED_ON_TIME' | 'RESOLVED_LATE' | 'WITHIN_TARGET' | 'APPROACHING_DEADLINE' | 'OVERDUE';
  recommendedEscalationLevel: number;
} {
  const submittedMs = new Date(complaint.submittedAt).getTime();
  const dueMs = new Date(complaint.slaDueAt).getTime();
  const endMs = complaint.resolvedAt ? new Date(complaint.resolvedAt).getTime() : new Date(referenceNowIso).getTime();

  const elapsedMs = Math.max(0, endMs - submittedMs);
  const totalSlaWindowMs = Math.max(3600_000, dueMs - submittedMs);
  const ageHours = Math.round(elapsedMs / 3600_000);
  const ageDays = Math.max(0, Math.floor(ageHours / 24));
  const remainingHours = Math.round((dueMs - endMs) / 3600_000);
  const slaConsumedPercent = Math.min(250, Math.round((elapsedMs / totalSlaWindowMs) * 100));

  const pConfig = priorityConfigs.find((p) => p.priority === complaint.priority);
  const warningThreshold = pConfig?.warningThresholdPercent ?? 75;

  const isTerminal = complaint.status === 'Resolved' || complaint.status === 'Closed';
  if (isTerminal) {
    return {
      ageDays,
      ageHours,
      remainingHours: 0,
      slaConsumedPercent,
      slaState: endMs <= dueMs ? 'RESOLVED_ON_TIME' : 'RESOLVED_LATE',
      recommendedEscalationLevel: 0,
    };
  }

  if (endMs > dueMs) {
    const overdueHours = Math.abs(remainingHours);
    const level = overdueHours > 120 ? 3 : overdueHours > 48 ? 2 : 1;
    return {
      ageDays,
      ageHours,
      remainingHours,
      slaConsumedPercent,
      slaState: 'OVERDUE',
      recommendedEscalationLevel: level,
    };
  }

  if (slaConsumedPercent >= warningThreshold) {
    return {
      ageDays,
      ageHours,
      remainingHours,
      slaConsumedPercent,
      slaState: 'APPROACHING_DEADLINE',
      recommendedEscalationLevel: 0,
    };
  }

  return {
    ageDays,
    ageHours,
    remainingHours,
    slaConsumedPercent,
    slaState: 'WITHIN_TARGET',
    recommendedEscalationLevel: 0,
  };
}

// 5. DETERMINISTIC EXPLAINABLE AI CLASSIFICATION, PRIORITY, SUMMARY & DUPLICATE DETECTION
export function sanitizeUntrustedText(raw: string): string {
  // Strip prompt-injection patterns and unsafe HTML tags
  return raw
    .replace(/<[^>]*>?/gm, '')
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[REDACTED_INSTRUCTION_OVERRIDE]')
    .replace(/system\s*prompt/gi, '[REDACTED_SYSTEM_TOKEN]')
    .trim();
}

export function generateDeterministicAIAssessment(
  complaint: {
    id: string;
    title: string;
    description: string;
    institutionName: string;
    affectedCount: number;
    category?: string;
    subcategory?: string;
  },
  categories: CategoryConfig[]
): AIAssessment {
  const cleanTitle = sanitizeUntrustedText(complaint.title);
  const cleanDesc = sanitizeUntrustedText(complaint.description);
  const combined = `${cleanTitle} ${cleanDesc}`.toLowerCase();

  // Rule-based keyword taxonomy
  const rules: {
    keywords: string[];
    category: string;
    subcategory: string;
    bureauId: string;
    basePriority: PriorityLevel;
  }[] = [
    {
      keywords: ['original certificate', 'fee refund', 'ragging', 'harassment', 'withheld', 'hostel safety', 'caution deposit'],
      category: 'Student grievances',
      subcategory: 'Retention of Original Certificates / Fee Refund Delay',
      bureauId: 'BUR-GRIEVANCE',
      basePriority: 'High',
    },
    {
      keywords: ['salary', 'faculty ratio', 'cadre', 'qualification', 'appointment', 'unpaid', 'pf', 'overload'],
      category: 'Faculty and staffing concerns',
      subcategory: 'Non-Payment of Prescribed Scale / Faculty Shortage',
      bureauId: 'BUR-ACADEMIC',
      basePriority: 'High',
    },
    {
      keywords: ['laboratory', 'building safety', 'fire noc', 'barrier-free', 'equipment', 'library', 'classroom'],
      category: 'Infrastructure and facilities',
      subcategory: 'Laboratory Equipment & Safety Deficit',
      bureauId: 'BUR-INFRA',
      basePriority: 'Medium',
    },
    {
      keywords: ['extension of approval', 'eoa', 'unapproved intake', 'excess admission', 'affiliation', 'noc'],
      category: 'Approval and affiliation-related concerns',
      subcategory: 'Excess Admission Beyond Sanctioned Intake',
      bureauId: 'BUR-APPROVAL',
      basePriority: 'Critical',
    },
    {
      keywords: ['scholarship', 'capitation', 'unauthorized fee', 'grant', 'fellowship', 'stipend', 'audit'],
      category: 'Financial and administrative issues',
      subcategory: 'Scholarship Disbursement Delay / Unauthorized Fee Levy',
      bureauId: 'BUR-FINANCE',
      basePriority: 'High',
    },
    {
      keywords: ['exam', 'syllabus', 'evaluation', 'attendance', 'credit', 'internship', 'curriculum'],
      category: 'Academic and examination-related matters',
      subcategory: 'Curriculum & Evaluation Irregularity',
      bureauId: 'BUR-ACADEMIC',
      basePriority: 'Medium',
    },
    {
      keywords: ['mandatory disclosure', 'website', 'governance', 'ombudsman', 'committee', 'compliance'],
      category: 'Institutional compliance',
      subcategory: 'Non-Disclosure of Mandatory Public Information',
      bureauId: 'BUR-APPROVAL',
      basePriority: 'Medium',
    },
  ];

  let matchedRule = rules[0];
  let maxHits = 0;

  for (const r of rules) {
    const hits = r.keywords.filter((kw) => combined.includes(kw)).length;
    if (hits > maxHits) {
      maxHits = hits;
      matchedRule = r;
    }
  }

  if (maxHits === 0 && categories.length > 0) {
    const fallbackCat = categories.find((c) => c.name === complaint.category) || categories[0];
    matchedRule = {
      keywords: [],
      category: fallbackCat.name,
      subcategory: fallbackCat.subcategories[0] || 'General Institutional Review',
      bureauId: fallbackCat.defaultBureauId,
      basePriority: fallbackCat.defaultPriority,
    };
  }

  // Transparent Priority Factors
  const priorityFactors: AIAssessment['priorityFactors'] = [];
  let priorityScore = 40;

  if (complaint.affectedCount >= 50) {
    priorityScore += 30;
    priorityFactors.push({
      factor: 'Cohort Scale Impact',
      impact: `${complaint.affectedCount} individuals reported affected (>= 50 threshold)`,
      scoreContribution: 30,
    });
  } else if (complaint.affectedCount >= 10) {
    priorityScore += 18;
    priorityFactors.push({
      factor: 'Group Impact',
      impact: `${complaint.affectedCount} individuals reported affected`,
      scoreContribution: 18,
    });
  } else {
    priorityFactors.push({
      factor: 'Individual / Localized Scope',
      impact: `${complaint.affectedCount} individual(s) reported`,
      scoreContribution: 8,
    });
    priorityScore += 8;
  }

  // Urgency and risk signals
  const urgencySignals: AIAssessment['urgencySignals'] = [];
  const signalCatalog: {
    terms: string[];
    category: AIAssessment['urgencySignals'][0]['signalCategory'];
    points: number;
    note: string;
  }[] = [
    {
      terms: ['safety', 'ragging', 'hazard', 'structural', 'fire', 'medical', 'threat'],
      category: 'Safety/Infrastructure',
      points: 28,
      note: 'Contains campus safety or student well-being risk terminology requiring expedited verification.',
    },
    {
      terms: ['original certificate', 'mark sheet', 'mark sheets', 'retained', 'deadline', 'admission cancellation', 'career', 'exam tomorrow', 'withheld'],
      category: 'Student Welfare',
      points: 24,
      note: 'Indicates time-sensitive academic progression or original document retention impact.',
    },
    {
      terms: ['unapproved', 'excess intake', 'forged', 'violation', 'non-compliance', 'fake'],
      category: 'Compliance Risk',
      points: 24,
      note: 'Flags potential regulatory norm deviation subject to documentary verification.',
    },
    {
      terms: ['capitation', 'stipend unpaid', 'salary', 'scholarship', 'fee refund', 'caution deposit', 'extortion'],
      category: 'Financial Impact',
      points: 18,
      note: 'Highlights financial hardship or fee/stipend irregularity.',
    },
    {
      terms: ['urgent', 'repeatedly ignored', 'helpless', 'distress', 'no response'],
      category: 'Distress Indicator',
      points: 10,
      note: 'Weak linguistic urgency signal; treated as contextual urgency indicator, not proof of allegation.',
    },
  ];

  for (const sig of signalCatalog) {
    const found = sig.terms.find((t) => combined.includes(t));
    if (found) {
      priorityScore += sig.points;
      urgencySignals.push({
        term: found,
        signalCategory: sig.category,
        note: sig.note,
      });
      priorityFactors.push({
        factor: sig.category,
        impact: `Matched indicator "${found}"`,
        scoreContribution: sig.points,
      });
    }
  }

  const suggestedPriority: PriorityLevel =
    priorityScore >= 82 ? 'Critical' : priorityScore >= 64 ? 'High' : priorityScore >= 48 ? 'Medium' : 'Low';

  const confidenceScore = Math.min(94, Math.max(68, 70 + maxHits * 7 + urgencySignals.length * 4));

  // Missing info check
  const missingInformation: string[] = [];
  if (!combined.includes('202') && !combined.includes('date') && !combined.includes('month')) {
    missingInformation.push('Specific chronological dates of the alleged incident or transaction.');
  }
  if (!combined.includes('receipt') && !combined.includes('order') && !combined.includes('letter') && !combined.includes('annexure')) {
    missingInformation.push('Documentary proof reference (e.g., fee receipt number, official circular, or written representation copy).');
  }
  if (missingInformation.length === 0) {
    missingInformation.push('Official institutional rebuttal and verified compliance register extract.');
  }

  return {
    id: `AI-ASSESS-${complaint.id}`,
    complaintId: complaint.id,
    engineMode: 'DETERMINISTIC_RULE_ENGINE',
    suggestedCategory: matchedRule.category,
    suggestedSubcategory: matchedRule.subcategory,
    suggestedPriority,
    suggestedBureauId: matchedRule.bureauId,
    confidenceScore,
    priorityFactors,
    executiveSummary: {
      coreIssue: `${cleanTitle} reported concerning ${complaint.institutionName}.`,
      institutionInvolved: complaint.institutionName,
      reportedAllegations: [
        `Complainant alleges: "${cleanDesc.slice(0, 180)}${cleanDesc.length > 180 ? '...' : ''}" (Unverified allegation pending inquiry).`,
        `Reported affected cohort size: ${complaint.affectedCount} person(s).`,
      ],
      evidenceSupplied: combined.includes('attached') || combined.includes('receipt') || combined.includes('document')
        ? 'Complainant references supporting documentation in text; requires officer verification.'
        : 'Initial narrative submission; primary documentary annexures should be verified.',
      missingInformation,
      suggestedNextStep: `Route to ${matchedRule.bureauId} and issue structured clarification notice to Institution Liaison Officer.`,
    },
    suggestedNextActions: [
      {
        action: 'Verify Jurisdiction & Assign Bureau Officer',
        rationale: `Keyword & taxonomy rules mapped case to ${matchedRule.category} (${matchedRule.bureauId}).`,
        ruleTriggered: 'RULE-TAXONOMY-01',
      },
      {
        action: 'Request Institutional Clarification & Documentary Records',
        rationale: missingInformation[0],
        ruleTriggered: 'RULE-EVIDENCE-02',
      },
      {
        action: suggestedPriority === 'Critical' || suggestedPriority === 'High'
          ? 'Enforce Priority SLA Monitoring Window'
          : 'Schedule Standard Bureau Review',
        rationale: `Calculated priority score of ${priorityScore}/100 recommends ${suggestedPriority} track.`,
        ruleTriggered: 'RULE-PRIORITY-03',
      },
    ],
    urgencySignals,
    explainabilityNotes:
      'Generated by the Deterministic Rule-Based Assistance Engine using transparent keyword taxonomy, affected cohort thresholds, and compliance risk weights. Allegations are explicitly separated from verified facts.',
    limitationsDisclosure:
      'AI/Rule-based assessment analyzes reported text only and cannot verify the authenticity of uploaded documents or institutional records. Consequential administrative decisions require authorized human officer confirmation.',
    humanReviewStatus: 'PENDING_REVIEW',
    reviewedByName: null,
    reviewedAt: null,
    generatedAt: new Date().toISOString(),
  };
}

// 6. DUPLICATE & RELATED COMPLAINT DETECTION
export function computeTextSimilarity(textA: string, textB: string): { score: number; sharedTerms: string[] } {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'been', 'were', 'are', 'was',
    'institution', 'college', 'institute', 'complaint', 'regarding', 'students', 'student', 'into',
  ]);
  const tokenize = (t: string) =>
    sanitizeUntrustedText(t)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));
  if (setA.size === 0 || setB.size === 0) return { score: 0, sharedTerms: [] };

  const sharedTerms: string[] = [];
  setA.forEach((word) => {
    if (setB.has(word)) sharedTerms.push(word);
  });

  const unionSize = new Set([...setA, ...setB]).size;
  const jaccard = sharedTerms.length / unionSize;
  return { score: Math.round(jaccard * 100), sharedTerms: sharedTerms.slice(0, 6) };
}

export function detectPotentialDuplicates(
  candidate: Pick<Complaint, 'id' | 'title' | 'description' | 'institutionId' | 'category' | 'submittedAt'>,
  existingComplaints: Complaint[]
): {
  targetComplaint: Complaint;
  similarityScore: number;
  matchReasons: string[];
  relationshipType: ComplaintRelationship['relationshipType'];
}[] {
  const results: {
    targetComplaint: Complaint;
    similarityScore: number;
    matchReasons: string[];
    relationshipType: ComplaintRelationship['relationshipType'];
  }[] = [];

  for (const existing of existingComplaints) {
    if (existing.id === candidate.id) continue;

    const reasons: string[] = [];
    let score = 0;

    const sameInstitution = existing.institutionId === candidate.institutionId;
    if (sameInstitution) {
      score += 35;
      reasons.push(`Identical Institution ID (${existing.institutionId})`);
    }

    const sameCategory = existing.category === candidate.category;
    if (sameCategory) {
      score += 20;
      reasons.push(`Matching Category (${existing.category})`);
    }

    const textSim = computeTextSimilarity(
      `${candidate.title} ${candidate.description}`,
      `${existing.title} ${existing.description}`
    );

    if (textSim.score > 0) {
      score += Math.min(45, Math.round(textSim.score * 0.9));
      if (textSim.sharedTerms.length > 0) {
        reasons.push(`Lexical overlap on key terms: ${textSim.sharedTerms.join(', ')}`);
      }
    }

    const daysDiff = Math.abs(
      (new Date(candidate.submittedAt).getTime() - new Date(existing.submittedAt).getTime()) / (1000 * 3600 * 24)
    );
    if (daysDiff <= 14) {
      score += 10;
      reasons.push(`Submitted within ${Math.max(1, Math.round(daysDiff))} day(s) of each other`);
    }

    const cappedScore = Math.min(98, score);
    if (cappedScore >= 52) {
      results.push({
        targetComplaint: existing,
        similarityScore: cappedScore,
        matchReasons: reasons,
        relationshipType:
          sameInstitution && sameCategory && textSim.score >= 22
            ? 'SUSPECTED_DUPLICATE'
            : 'RELATED_INSTITUTION_ISSUE',
      });
    }
  }

  return results.sort((a, b) => b.similarityScore - a.similarityScore);
}

// 7. CENTRAL COMMAND DASHBOARD METRICS & BOTTLENECK DETECTOR (COMPUTED FROM ACTUAL RECORDS)
export function computeDashboardAnalytics(
  complaints: Complaint[],
  bureaus: Bureau[],
  institutions: Institution[],
  statusHistory: StatusTransitionEvent[],
  priorityConfigs: PriorityConfig[],
  referenceNowIso = new Date().toISOString()
) {
  const total = complaints.length;
  const newlyReceived = complaints.filter((c) => c.status === 'Received' || c.status === 'Initial Review').length;
  const awaitingAssignment = complaints.filter((c) => c.status === 'Pending Assignment').length;
  const underInvestigation = complaints.filter(
    (c) => c.status === 'Under Investigation' || c.status === 'Assigned'
  ).length;
  const awaitingInstitution = complaints.filter(
    (c) => c.status === 'Awaiting Institution Response' || c.status === 'Additional Information Required'
  ).length;
  const resolved = complaints.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length;
  const reopened = complaints.filter((c) => c.status === 'Reopened').length;
  const escalated = complaints.filter((c) => c.status === 'Escalated' || c.escalationLevel > 0).length;
  const criticalPriority = complaints.filter((c) => c.priority === 'Critical').length;

  let overdueCount = 0;
  let approachingDeadlineCount = 0;
  let totalResolutionHours = 0;
  let resolvedWithTimestamps = 0;

  const ageingBuckets: Record<'0-3 Days' | '4-7 Days' | '8-14 Days' | '15+ Days', number> = {
    '0-3 Days': 0,
    '4-7 Days': 0,
    '8-14 Days': 0,
    '15+ Days': 0,
  };

  for (const c of complaints) {
    const sla = calculateCaseAgeingAndSla(c, priorityConfigs, referenceNowIso);
    if (sla.slaState === 'OVERDUE' || c.isOverdue) {
      overdueCount++;
    } else if (sla.slaState === 'APPROACHING_DEADLINE') {
      approachingDeadlineCount++;
    }

    if (c.status !== 'Resolved' && c.status !== 'Closed') {
      if (sla.ageDays <= 3) ageingBuckets['0-3 Days']++;
      else if (sla.ageDays <= 7) ageingBuckets['4-7 Days']++;
      else if (sla.ageDays <= 14) ageingBuckets['8-14 Days']++;
      else ageingBuckets['15+ Days']++;
    }

    if (c.resolvedAt) {
      const hours = Math.max(
        1,
        (new Date(c.resolvedAt).getTime() - new Date(c.submittedAt).getTime()) / 3600_000
      );
      totalResolutionHours += hours;
      resolvedWithTimestamps++;
    }
  }

  const avgResolutionDays =
    resolvedWithTimestamps > 0 ? Number((totalResolutionHours / resolvedWithTimestamps / 24).toFixed(1)) : 0;
  const resolutionRate = total > 0 ? Number(((resolved / total) * 100).toFixed(1)) : 0;

  // By Bureau workload
  const byBureau = bureaus.map((b) => {
    const bCases = complaints.filter((c) => c.bureauId === b.id);
    const activeCases = bCases.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed');
    const resolvedCases = bCases.filter((c) => c.status === 'Resolved' || c.status === 'Closed');
    const overdueCases = activeCases.filter(
      (c) => c.isOverdue || calculateCaseAgeingAndSla(c, priorityConfigs, referenceNowIso).slaState === 'OVERDUE'
    );
    return {
      bureauId: b.id,
      bureauCode: b.code,
      bureauName: b.name,
      total: bCases.length,
      activeBacklog: activeCases.length,
      resolved: resolvedCases.length,
      overdue: overdueCases.length,
      capacityLimit: b.capacityLimit,
      utilizationPercent: Math.round((activeCases.length / Math.max(1, b.capacityLimit)) * 100),
    };
  });

  // Case Ageing Heatmap (Bureau x Priority)
  const ageingHeatmap = bureaus.map((b) => {
    const bActive = complaints.filter(
      (c) => c.bureauId === b.id && c.status !== 'Resolved' && c.status !== 'Closed'
    );
    const byPriority: Record<PriorityLevel, { count: number; avgAgeDays: number; overdueCount: number }> = {
      Critical: { count: 0, avgAgeDays: 0, overdueCount: 0 },
      High: { count: 0, avgAgeDays: 0, overdueCount: 0 },
      Medium: { count: 0, avgAgeDays: 0, overdueCount: 0 },
      Low: { count: 0, avgAgeDays: 0, overdueCount: 0 },
    };

    (['Critical', 'High', 'Medium', 'Low'] as PriorityLevel[]).forEach((p) => {
      const subset = bActive.filter((c) => c.priority === p);
      if (subset.length > 0) {
        const ages = subset.map((c) => calculateCaseAgeingAndSla(c, priorityConfigs, referenceNowIso));
        const totalDays = ages.reduce((acc, a) => acc + a.ageDays, 0);
        const od = ages.filter((a) => a.slaState === 'OVERDUE').length;
        byPriority[p] = {
          count: subset.length,
          avgAgeDays: Number((totalDays / subset.length).toFixed(1)),
          overdueCount: od,
        };
      }
    });

    return {
      bureauId: b.id,
      bureauCode: b.code,
      bureauName: b.name,
      byPriority,
    };
  });

  // Status Distribution
  const byStatus = COMPLAINT_LIFECYCLE_STAGES.map((status) => ({
    status,
    count: complaints.filter((c) => c.status === status).length,
  })).filter((s) => s.count > 0);

  // Priority Distribution
  const byPriority: { priority: PriorityLevel; count: number }[] = (
    ['Critical', 'High', 'Medium', 'Low'] as PriorityLevel[]
  ).map((priority) => ({
    priority,
    count: complaints.filter((c) => c.priority === priority).length,
  }));

  // Category Distribution
  const categoryMap = new Map<string, number>();
  complaints.forEach((c) => {
    categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1);
  });
  const byCategory = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Institution Distribution
  const byInstitution = institutions
    .map((inst) => {
      const iCases = complaints.filter((c) => c.institutionId === inst.id);
      const pending = iCases.filter((c) => c.status === 'Awaiting Institution Response').length;
      const resolvedInst = iCases.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length;
      return {
        institutionId: inst.id,
        institutionCode: inst.institutionCode,
        institutionName: inst.name,
        state: inst.state,
        totalComplaints: iCases.length,
        pendingResponses: pending,
        resolvedComplaints: resolvedInst,
      };
    })
    .sort((a, b) => b.totalComplaints - a.totalComplaints);

  // Monthly Intake vs Resolution Trend (derived from actual submittedAt and resolvedAt timestamps)
  const monthBuckets = new Map<string, { month: string; intake: number; resolved: number; escalated: number }>();
  const sortedByDate = [...complaints].sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  );
  for (const c of sortedByDate) {
    const d = new Date(c.submittedAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthBuckets.has(key)) {
      monthBuckets.set(key, { month: key, intake: 0, resolved: 0, escalated: 0 });
    }
    const bucket = monthBuckets.get(key)!;
    bucket.intake++;
    if (c.escalationLevel > 0 || c.status === 'Escalated') {
      bucket.escalated++;
    }
    if (c.resolvedAt) {
      const rd = new Date(c.resolvedAt);
      const rKey = `${rd.getUTCFullYear()}-${String(rd.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!monthBuckets.has(rKey)) {
        monthBuckets.set(rKey, { month: rKey, intake: 0, resolved: 0, escalated: 0 });
      }
      monthBuckets.get(rKey)!.resolved++;
    }
  }
  const monthlyTrends = Array.from(monthBuckets.values()).sort((a, b) => a.month.localeCompare(b.month));

  // Bottleneck Detector (highlights stages where active complaints accumulate and average dwell time is highest)
  const activeStages: ComplaintStatus[] = [
    'Received',
    'Initial Review',
    'Pending Assignment',
    'Assigned',
    'Under Investigation',
    'Awaiting Institution Response',
    'Additional Information Required',
    'Resolution Proposed',
    'Resolution Under Review',
    'Escalated',
  ];

  const bottlenecks = activeStages
    .map((stage) => {
      const stageComplaints = complaints.filter((c) => c.status === stage);
      const avgAgeDays =
        stageComplaints.length > 0
          ? Number(
              (
                stageComplaints.reduce(
                  (acc, c) => acc + calculateCaseAgeingAndSla(c, priorityConfigs, referenceNowIso).ageDays,
                  0
                ) / stageComplaints.length
              ).toFixed(1)
            )
          : 0;
      const transitionCount = statusHistory.filter((h) => h.newStatus === stage).length;
      return {
        stage,
        activeCount: stageComplaints.length,
        avgDwellDays: avgAgeDays,
        historicalVolume: transitionCount,
        severity:
          stageComplaints.length >= 3 && avgAgeDays >= 7
            ? ('HIGH_BOTTLENECK' as const)
            : stageComplaints.length >= 2
            ? ('MODERATE_ACCUMULATION' as const)
            : ('NOMINAL' as const),
      };
    })
    .filter((b) => b.activeCount > 0)
    .sort((a, b) => b.activeCount * Math.max(1, b.avgDwellDays) - a.activeCount * Math.max(1, a.avgDwellDays));

  return {
    kpis: {
      total,
      newlyReceived,
      awaitingAssignment,
      underInvestigation,
      awaitingInstitution,
      resolved,
      reopened,
      overdueCount,
      approachingDeadlineCount,
      criticalPriority,
      escalated,
      avgResolutionDays,
      resolutionRate,
    },
    byBureau,
    ageingHeatmap,
    byStatus,
    byPriority,
    byCategory,
    byInstitution,
    monthlyTrends,
    ageingBuckets: Object.entries(ageingBuckets).map(([bucket, count]) => ({ bucket, count })),
    bottlenecks,
  };
}

// 8. CONTEXTUAL COMPLAINT INTELLIGENCE ASSISTANT (QUERYING ACTUAL AUTHORIZED DATA)
export function answerOperationalQuery(
  query: string,
  authorizedComplaints: Complaint[],
  bureaus: Bureau[],
  institutions: Institution[],
  priorityConfigs: PriorityConfig[],
  referenceNowIso = new Date().toISOString()
): {
  query: string;
  answerHeadline: string;
  supportingFacts: string[];
  referencedCases: { referenceNumber: string; title: string; status: ComplaintStatus; priority: PriorityLevel }[];
  dataScopeNote: string;
} {
  const analytics = computeDashboardAnalytics(
    authorizedComplaints,
    bureaus,
    institutions,
    [],
    priorityConfigs,
    referenceNowIso
  );
  const q = query.toLowerCase();

  if (authorizedComplaints.length === 0) {
    return {
      query,
      answerHeadline: 'No authorized complaint records match your current scope.',
      supportingFacts: ['The queryable dataset for your role/filter scope currently contains 0 complaints.'],
      referencedCases: [],
      dataScopeNote: 'Derived strictly from 0 authorized records in current scope.',
    };
  }

  if (q.includes('backlog') || q.includes('bureau') || q.includes('workload')) {
    const sortedBureaus = [...analytics.byBureau].sort((a, b) => b.activeBacklog - a.activeBacklog);
    const top = sortedBureaus[0];
    const topCases = authorizedComplaints
      .filter((c) => c.bureauId === top.bureauId && c.status !== 'Resolved' && c.status !== 'Closed')
      .slice(0, 4);
    return {
      query,
      answerHeadline: `${top.bureauName} (${top.bureauCode}) currently holds the largest active backlog with ${top.activeBacklog} open complaints (${top.overdue} overdue).`,
      supportingFacts: sortedBureaus.map(
        (b) =>
          `${b.bureauCode}: ${b.activeBacklog} active cases, ${b.resolved} resolved, ${b.overdue} overdue (${b.utilizationPercent}% capacity utilization).`
      ),
      referencedCases: topCases.map((c) => ({
        referenceNumber: c.referenceNumber,
        title: c.title,
        status: c.status,
        priority: c.priority,
      })),
      dataScopeNote: `Computed across ${authorizedComplaints.length} authorized complaint records and ${bureaus.length} configured bureaus.`,
    };
  }

  if (q.includes('overdue') || q.includes('exceeded') || q.includes('target') || q.includes('attention') || q.includes('first')) {
    const overdueCases = authorizedComplaints
      .filter(
        (c) =>
          c.status !== 'Resolved' &&
          c.status !== 'Closed' &&
          (c.isOverdue || calculateCaseAgeingAndSla(c, priorityConfigs, referenceNowIso).slaState === 'OVERDUE')
      )
      .sort((a, b) => new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime());

    return {
      query,
      answerHeadline: `${overdueCases.length} active complaint case(s) have exceeded their configured SLA targets and require immediate officer intervention.`,
      supportingFacts: [
        `Critical-priority active cases: ${authorizedComplaints.filter((c) => c.priority === 'Critical' && c.status !== 'Resolved' && c.status !== 'Closed').length}`,
        `Cases approaching deadline threshold: ${analytics.kpis.approachingDeadlineCount}`,
        `Cases currently in Escalated status or Level 1+ escalation: ${analytics.kpis.escalated}`,
      ],
      referencedCases: overdueCases.slice(0, 5).map((c) => ({
        referenceNumber: c.referenceNumber,
        title: c.title,
        status: c.status,
        priority: c.priority,
      })),
      dataScopeNote: `Evaluated against configured priority SLA targets across ${authorizedComplaints.length} authorized records.`,
    };
  }

  if (q.includes('category') || q.includes('categories') || q.includes('common')) {
    const topCat = analytics.byCategory[0];
    return {
      query,
      answerHeadline: topCat
        ? `"${topCat.category}" is the most frequent complaint category with ${topCat.count} registered cases (${Math.round((topCat.count / authorizedComplaints.length) * 100)}% of scope).`
        : 'No category breakdown available.',
      supportingFacts: analytics.byCategory.map(
        (c) => `${c.category}: ${c.count} case(s) (${Math.round((c.count / authorizedComplaints.length) * 100)}%)`
      ),
      referencedCases: authorizedComplaints
        .filter((c) => topCat && c.category === topCat.category)
        .slice(0, 4)
        .map((c) => ({
          referenceNumber: c.referenceNumber,
          title: c.title,
          status: c.status,
          priority: c.priority,
        })),
      dataScopeNote: `Aggregated from ${authorizedComplaints.length} authorized complaint records.`,
    };
  }

  // Default comprehensive performance & resolution summary
  return {
    query,
    answerHeadline: `Current Resolution Rate is ${analytics.kpis.resolutionRate}% (${analytics.kpis.resolved} of ${analytics.kpis.total} complaints resolved) with an average resolution cycle of ${analytics.kpis.avgResolutionDays} days.`,
    supportingFacts: [
      `Active Investigation Queue: ${analytics.kpis.underInvestigation} cases under investigation; ${analytics.kpis.awaitingInstitution} awaiting institutional response.`,
      `Primary Bottleneck Stage: ${analytics.bottlenecks[0] ? `${analytics.bottlenecks[0].stage} (${analytics.bottlenecks[0].activeCount} cases, avg ${analytics.bottlenecks[0].avgDwellDays}d dwell)` : 'None detected'}.`,
      `Overdue Cases Requiring Action: ${analytics.kpis.overdueCount} case(s).`,
    ],
    referencedCases: authorizedComplaints.slice(0, 4).map((c) => ({
      referenceNumber: c.referenceNumber,
      title: c.title,
      status: c.status,
      priority: c.priority,
    })),
    dataScopeNote: `Computed dynamically from ${authorizedComplaints.length} authorized stored records.`,
  };
}

// 9. CSV INSTITUTION IMPORTER & DATA QUALITY MONITOR
export function validateAndPreviewInstitutionCsv(
  csvText: string,
  existingInstitutions: Institution[]
): {
  totalRows: number;
  validRecords: Omit<Institution, 'id' | 'createdAt'>[];
  duplicateCodes: string[];
  errors: { rowNumber: number; fieldName: string; errorMessage: string }[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      totalRows: 0,
      validRecords: [],
      duplicateCodes: [],
      errors: [{ rowNumber: 1, fieldName: 'CSV_HEADER', errorMessage: 'CSV must include a header row and at least one data row.' }],
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const codeIdx = headers.findIndex((h) => h.includes('code') || h.includes('id'));
  const nameIdx = headers.findIndex((h) => h.includes('name'));
  const typeIdx = headers.findIndex((h) => h.includes('type'));
  const stateIdx = headers.findIndex((h) => h.includes('state'));
  const districtIdx = headers.findIndex((h) => h.includes('district'));
  const emailIdx = headers.findIndex((h) => h.includes('email'));

  const existingCodes = new Set(existingInstitutions.map((i) => i.institutionCode.toUpperCase()));
  const seenInBatch = new Set<string>();

  const validRecords: Omit<Institution, 'id' | 'createdAt'>[] = [];
  const duplicateCodes: string[] = [];
  const errors: { rowNumber: number; fieldName: string; errorMessage: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cols = lines[i].split(',').map((c) => sanitizeUntrustedText(c));
    const code = (codeIdx >= 0 ? cols[codeIdx] : cols[0] || '').toUpperCase();
    const name = nameIdx >= 0 ? cols[nameIdx] : cols[1] || '';
    const instTypeRaw = typeIdx >= 0 ? cols[typeIdx] : cols[2] || 'Engineering & Technology';
    const state = stateIdx >= 0 ? cols[stateIdx] : cols[3] || '';
    const district = districtIdx >= 0 ? cols[districtIdx] : cols[4] || '';
    const email = emailIdx >= 0 ? cols[emailIdx] : cols[5] || 'liaison@coep.ac.in';

    if (!code || !/^([0-9]-[0-9]+|AICTE-[A-Z0-9-]+|[A-Z0-9-]+)$/i.test(code)) {
      errors.push({
        rowNumber,
        fieldName: 'institution_code',
        errorMessage: `Invalid or missing institution identifier "${code}". Expected format like 1-10972311 or AICTE-INST-099.`,
      });
      continue;
    }

    if (!name || name.length < 5) {
      errors.push({
        rowNumber,
        fieldName: 'name',
        errorMessage: 'Institution name must be at least 5 characters.',
      });
      continue;
    }

    if (!state || !district) {
      errors.push({
        rowNumber,
        fieldName: 'state/district',
        errorMessage: 'Both State and District are required.',
      });
      continue;
    }

    if (existingCodes.has(code) || seenInBatch.has(code)) {
      duplicateCodes.push(code);
      errors.push({
        rowNumber,
        fieldName: 'institution_code',
        errorMessage: `Duplicate institution code "${code}" detected in directory or import batch.`,
      });
      continue;
    }

    seenInBatch.add(code);
    const allowedTypes: Institution['institutionType'][] = [
      'Engineering & Technology',
      'Management',
      'Pharmacy',
      'Architecture & Planning',
      'Polytechnic',
    ];
    const matchedType =
      allowedTypes.find((t) => t.toLowerCase().includes(instTypeRaw.toLowerCase())) || 'Engineering & Technology';

    validRecords.push({
      institutionCode: code,
      name,
      institutionType: matchedType,
      state,
      district,
      address: `${district}, ${state}, India`,
      approvalStatus: 'Approved',
      contactEmail: email || 'liaison@aicte-portal.in',
      contactPhone: '+91-11-2958-1000',
      sourceProvenance: 'AICTE CSV Authorized Batch Import',
      isDemoRecord: false,
    });
  }

  return {
    totalRows: lines.length - 1,
    validRecords,
    duplicateCodes,
    errors,
  };
}
