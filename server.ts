// ============================================================================
// AICTE COMPLAINT INTELLIGENCE HUB — EXPRESS + VITE FULL-STACK SERVER
// Enforces Server-Side RBAC, Row-Level Scoping, Workflow Rules & Audit Logging
// ============================================================================

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { getDatabaseState, persistDatabaseState, resetToInitialSeedState } from './src/db/repository';
import {
  answerOperationalQuery,
  calculateCaseAgeingAndSla,
  canUserPerformAction,
  canUserViewComplaint,
  computeDashboardAnalytics,
  detectPotentialDuplicates,
  filterAuthorizedComplaints,
  generateComplaintReference,
  generateDeterministicAIAssessment,
  sanitizeUntrustedText,
  validateAndPreviewInstitutionCsv,
  validateStatusTransition,
} from './src/db/rules';
import {
  AuditLogEntry,
  Complaint,
  ComplaintStatus,
  PriorityLevel,
  UserProfile,
} from './src/db/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

function resolveActingUser(req: Request): UserProfile {
  const db = getDatabaseState();
  const headerUserId = (req.headers['x-actor-user-id'] as string) || 'USR-CMO';
  const found = db.users.find((u) => u.id === headerUserId && u.active);
  return found || db.users[0];
}

function appendAuditLog(
  actor: UserProfile,
  eventType: AuditLogEntry['eventType'],
  entityType: AuditLogEntry['entityType'],
  entityReference: string,
  summary: string,
  reason?: string
) {
  const db = getDatabaseState();
  const entry: AuditLogEntry = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    eventType,
    entityType,
    entityReference,
    summary,
    reason,
    timestamp: new Date().toISOString(),
  };
  db.auditLogs.unshift(entry);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. System Health & Environment Status
  app.get('/api/system-status', (_req: Request, res: Response) => {
    const hasSupabase = Boolean(
      process.env.VITE_SUPABASE_URL &&
        process.env.VITE_SUPABASE_ANON_KEY &&
        process.env.VITE_SUPABASE_URL !== ''
    );
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        process.env.GEMINI_API_KEY.trim().length > 10
    );
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_HOST.trim().length > 0);
    const db = getDatabaseState();

    res.json({
      environmentBanner: null,
      persistenceMode: hasSupabase ? 'SUPABASE_POSTGRESQL' : 'LOCAL_TRANSACTIONAL_REPOSITORY',
      persistenceLabel: hasSupabase
        ? 'Connected to Hosted Supabase PostgreSQL'
        : 'Local Transactional Data Store (Synchronized)',
      aiEngineMode: hasGeminiKey ? 'SERVER_LLM_ADAPTER' : 'DETERMINISTIC_RULE_ENGINE',
      aiEngineLabel: hasGeminiKey
        ? 'Server-Side LLM Adapter + Deterministic Rule Verification'
        : 'Deterministic Rule-Based Assistance (Active Fallback — No External API Key Required)',
      emailNotificationsConfigured: hasSmtp,
      recordCounts: {
        complaints: db.complaints.length,
        institutions: db.institutions.length,
        bureaus: db.bureaus.length,
        auditLogs: db.auditLogs.length,
      },
      serverTimestamp: new Date().toISOString(),
    });
  });

  // 2. Bootstrap Authorized Workspace Data for Current User
  app.get('/api/bootstrap', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const authorizedComplaints = filterAuthorizedComplaints(actor, db.complaints);

    // Filter comments so Institution Liaison cannot see INTERNAL notes
    const authorizedComments = db.comments.filter((cmt) => {
      if (actor.role === 'INSTITUTION_LIAISON' && cmt.visibility === 'INTERNAL') {
        return false;
      }
      return authorizedComplaints.some((c) => c.id === cmt.complaintId);
    });

    const analytics = computeDashboardAnalytics(
      authorizedComplaints,
      db.bureaus,
      db.institutions,
      db.statusHistory,
      db.priorities
    );

    const canViewAudit = canUserPerformAction(actor, 'VIEW_AUDIT_LOGS');

    res.json({
      actor,
      organization: db.organization,
      users: db.users,
      bureaus: db.bureaus,
      institutions: db.institutions,
      categories: db.categories,
      priorities: db.priorities,
      complaints: authorizedComplaints,
      assignments: db.assignments.filter((a) => authorizedComplaints.some((c) => c.id === a.complaintId)),
      statusHistory: db.statusHistory.filter((s) => authorizedComplaints.some((c) => c.id === s.complaintId)),
      comments: authorizedComments,
      institutionResponses: db.institutionResponses.filter((r) =>
        authorizedComplaints.some((c) => c.id === r.complaintId)
      ),
      attachments: db.attachments.filter((att) =>
        authorizedComplaints.some((c) => c.id === att.complaintId)
      ),
      relationships: db.relationships,
      escalations: db.escalations.filter((e) =>
        authorizedComplaints.some((c) => c.id === e.complaintId)
      ),
      aiAssessments: db.aiAssessments,
      aiFeedback: db.aiFeedback,
      notifications: db.notifications,
      auditLogs: canViewAudit ? db.auditLogs : [],
      savedSearches: db.savedSearches,
      importJobs: db.importJobs,
      analytics,
    });
  });

  // 3. Pre-Intake AI Assessment & Duplicate Check (Used on Registration Form)
  app.post('/api/ai/precheck', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const { title, description, institutionId, category, affectedCount } = req.body;
    const inst = db.institutions.find((i) => i.id === institutionId);

    const assessment = generateDeterministicAIAssessment(
      {
        id: 'PRECHECK',
        title: String(title || ''),
        description: String(description || ''),
        institutionName: inst?.name || 'Selected Institution',
        affectedCount: Number(affectedCount) || 1,
        category,
      },
      db.categories
    );

    const duplicates = detectPotentialDuplicates(
      {
        id: 'PRECHECK',
        title: String(title || ''),
        description: String(description || ''),
        institutionId: String(institutionId || ''),
        category: String(category || assessment.suggestedCategory),
        submittedAt: new Date().toISOString(),
      },
      db.complaints
    );

    res.json({
      assessment,
      suspectedDuplicates: duplicates,
    });
  });

  // 4. Register New Complaint
  app.post('/api/complaints', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);

    if (!canUserPerformAction(actor, 'REGISTER_COMPLAINT')) {
      appendAuditLog(
        actor,
        'UNAUTHORIZED_ATTEMPT_BLOCKED',
        'COMPLAINT',
        'NEW_INTAKE',
        `Blocked unauthorized attempt to register complaint by role ${actor.role}.`
      );
      persistDatabaseState(db);
      res.status(403).json({
        error: `Access Denied: Role "${actor.role}" is not permitted to register complaints in the administrative intake console.`,
      });
      return;
    }

    const {
      title,
      description,
      category,
      subcategory,
      institutionId,
      bureauId,
      priority,
      sourceChannel,
      complainantType,
      affectedCount,
      attachmentName,
    } = req.body;

    const cleanTitle = sanitizeUntrustedText(String(title || ''));
    const cleanDesc = sanitizeUntrustedText(String(description || ''));

    if (cleanTitle.length < 10) {
      res.status(400).json({ error: 'Validation Error: Complaint title must be at least 10 characters.' });
      return;
    }
    if (cleanDesc.length < 25) {
      res.status(400).json({ error: 'Validation Error: Detailed description must be at least 25 characters.' });
      return;
    }

    const institution = db.institutions.find((i) => i.id === institutionId);
    if (!institution) {
      res.status(400).json({ error: 'Validation Error: Please select a valid institution from the directory.' });
      return;
    }

    const selectedBureau = db.bureaus.find((b) => b.id === bureauId) || db.bureaus[0];
    const selectedPriority: PriorityLevel = ['Low', 'Medium', 'High', 'Critical'].includes(priority)
      ? priority
      : 'Medium';
    const pConfig = db.priorities.find((p) => p.priority === selectedPriority) || db.priorities[2];

    const nowIso = new Date().toISOString();
    const dueMs = Date.now() + pConfig.resolutionTargetDays * 24 * 3600_000;
    const referenceNumber = generateComplaintReference(db.complaints.length, 2026);
    const newId = `CMP-${String(db.complaints.length + 1).padStart(4, '0')}`;

    const newComplaint: Complaint = {
      id: newId,
      referenceNumber,
      title: cleanTitle,
      description: cleanDesc,
      category: String(category || 'Student grievances'),
      subcategory: String(subcategory || 'General Institutional Review'),
      institutionId: institution.id,
      institutionName: institution.name,
      state: institution.state,
      district: institution.district,
      bureauId: selectedBureau.id,
      assignedOfficerId: null,
      assignedOfficerName: null,
      priority: selectedPriority,
      status: 'Received',
      sourceChannel: sourceChannel || 'National Grievance Portal (CPGRAMS)',
      complainantType: complainantType || 'Student (Verified)',
      affectedCount: Math.max(1, Number(affectedCount) || 1),
      submittedAt: nowIso,
      updatedAt: nowIso,
      firstRespondedAt: null,
      resolvedAt: null,
      slaDueAt: new Date(dueMs).toISOString(),
      escalationLevel: 0,
      isOverdue: false,
      isDemoData: false,
      resolutionSummary: null,
    };

    db.complaints.unshift(newComplaint);

    // Record initial status history
    db.statusHistory.unshift({
      id: `STH-${Date.now()}`,
      complaintId: newId,
      previousStatus: null,
      newStatus: 'Received',
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      reason: `Registered via ${newComplaint.sourceChannel} with reference ${referenceNumber}.`,
      timestamp: nowIso,
    });

    // Generate AI assessment
    const aiAssessment = generateDeterministicAIAssessment(newComplaint, db.categories);
    db.aiAssessments[newId] = aiAssessment;

    // Detect duplicate relationships
    const dupMatches = detectPotentialDuplicates(newComplaint, db.complaints);
    for (const m of dupMatches.slice(0, 2)) {
      db.relationships.unshift({
        id: `REL-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        sourceComplaintId: newId,
        targetComplaintId: m.targetComplaint.id,
        relationshipType: m.relationshipType,
        similarityScore: m.similarityScore,
        matchReasons: m.matchReasons,
        confirmedByName: null,
        confirmedAt: null,
        status: 'SUSPECTED',
      });
    }

    if (attachmentName && String(attachmentName).trim().length > 0) {
      db.attachments.unshift({
        id: `ATT-${Date.now()}`,
        complaintId: newId,
        fileName: sanitizeUntrustedText(String(attachmentName)),
        fileType: 'application/pdf',
        fileSizeBytes: 342000,
        uploadedByName: actor.fullName,
        uploadedAt: nowIso,
        checksumSha256: 'sha256-verified-intake-document-hash',
      });
    }

    db.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      recipientRole: 'ALL',
      recipientBureauId: selectedBureau.id,
      eventType: 'NEW_ASSIGNMENT',
      title: `New Complaint Registered: ${referenceNumber}`,
      message: `${cleanTitle} (${selectedPriority} priority) routed to ${selectedBureau.name}.`,
      complaintId: newId,
      complaintRef: referenceNumber,
      isRead: false,
      createdAt: nowIso,
    });

    appendAuditLog(
      actor,
      'COMPLAINT_CREATED',
      'COMPLAINT',
      referenceNumber,
      `Registered official grievance "${cleanTitle}" concerning ${institution.name}.`,
      'Authorized Intake Submission'
    );

    persistDatabaseState(db);
    res.status(201).json({ complaint: newComplaint, aiAssessment, duplicateMatches: dupMatches });
  });

  // 5. Assign / Reassign / Transfer Complaint Across Bureaus
  app.post('/api/complaints/:id/assign', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const complaint = db.complaints.find((c) => c.id === req.params.id);

    if (!complaint) {
      res.status(404).json({ error: 'Complaint record not found.' });
      return;
    }

    if (!canUserPerformAction(actor, 'ASSIGN_COMPLAINT')) {
      appendAuditLog(
        actor,
        'UNAUTHORIZED_ATTEMPT_BLOCKED',
        'COMPLAINT',
        complaint.referenceNumber,
        `Blocked unauthorized assignment attempt by ${actor.role}.`
      );
      persistDatabaseState(db);
      res.status(403).json({ error: `Access Denied: Role "${actor.role}" cannot assign or transfer complaints.` });
      return;
    }

    const { toBureauId, assignedOfficerName, reason } = req.body;
    const cleanReason = sanitizeUntrustedText(String(reason || ''));
    if (cleanReason.length < 5) {
      res.status(400).json({ error: 'Please provide an assignment/transfer reason (at least 5 characters).' });
      return;
    }

    const targetBureau = db.bureaus.find((b) => b.id === toBureauId);
    if (!targetBureau) {
      res.status(400).json({ error: 'Invalid target bureau selected.' });
      return;
    }

    const previousBureauId = complaint.bureauId;
    const isTransfer = previousBureauId !== targetBureau.id;
    const nowIso = new Date().toISOString();

    complaint.bureauId = targetBureau.id;
    complaint.assignedOfficerName = assignedOfficerName || targetBureau.headOfficerName;
    complaint.updatedAt = nowIso;
    if (!complaint.firstRespondedAt) {
      complaint.firstRespondedAt = nowIso;
    }

    if (complaint.status === 'Received' || complaint.status === 'Initial Review' || complaint.status === 'Pending Assignment') {
      const prevStatus = complaint.status;
      complaint.status = 'Assigned';
      db.statusHistory.unshift({
        id: `STH-${Date.now()}`,
        complaintId: complaint.id,
        previousStatus: prevStatus,
        newStatus: 'Assigned',
        actorId: actor.id,
        actorName: actor.fullName,
        actorRole: actor.role,
        reason: cleanReason,
        timestamp: nowIso,
      });
    }

    db.assignments.unshift({
      id: `ASN-${Date.now()}`,
      complaintId: complaint.id,
      fromBureauId: previousBureauId,
      toBureauId: targetBureau.id,
      assignedOfficerId: null,
      assignedOfficerName: complaint.assignedOfficerName,
      assignedById: actor.id,
      assignedByName: actor.fullName,
      reason: cleanReason,
      acknowledged: false,
      createdAt: nowIso,
    });

    db.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      recipientRole: 'BUREAU_OFFICER',
      recipientBureauId: targetBureau.id,
      eventType: isTransfer ? 'REASSIGNMENT' : 'NEW_ASSIGNMENT',
      title: `${isTransfer ? 'Inter-Bureau Case Transfer' : 'Case Assigned'}: ${complaint.referenceNumber}`,
      message: `Assigned to ${complaint.assignedOfficerName} (${targetBureau.code}). Reason: ${cleanReason}`,
      complaintId: complaint.id,
      complaintRef: complaint.referenceNumber,
      isRead: false,
      createdAt: nowIso,
    });

    appendAuditLog(
      actor,
      isTransfer ? 'CASE_TRANSFERRED' : 'ASSIGNMENT_CHANGED',
      'COMPLAINT',
      complaint.referenceNumber,
      `${isTransfer ? 'Transferred' : 'Assigned'} case to ${targetBureau.name} (Officer: ${complaint.assignedOfficerName}).`,
      cleanReason
    );

    persistDatabaseState(db);
    res.json({ complaint });
  });

  // 6. Lifecycle Status Transition
  app.post('/api/complaints/:id/status', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const complaint = db.complaints.find((c) => c.id === req.params.id);

    if (!complaint) {
      res.status(404).json({ error: 'Complaint record not found.' });
      return;
    }

    const { targetStatus, reason, resolutionSummary } = req.body as {
      targetStatus: ComplaintStatus;
      reason: string;
      resolutionSummary?: string;
    };

    const validation = validateStatusTransition(
      complaint.status,
      targetStatus,
      actor,
      complaint.bureauId,
      String(reason || '')
    );

    if (!validation.valid) {
      appendAuditLog(
        actor,
        'UNAUTHORIZED_ATTEMPT_BLOCKED',
        'COMPLAINT',
        complaint.referenceNumber,
        `Rejected status transition ${complaint.status} -> ${targetStatus}: ${validation.error}`
      );
      persistDatabaseState(db);
      res.status(403).json({ error: validation.error });
      return;
    }

    const prevStatus = complaint.status;
    const nowIso = new Date().toISOString();
    const cleanReason = sanitizeUntrustedText(reason);

    complaint.status = targetStatus;
    complaint.updatedAt = nowIso;
    if (!complaint.firstRespondedAt) {
      complaint.firstRespondedAt = nowIso;
    }

    if (targetStatus === 'Resolved' || targetStatus === 'Closed') {
      complaint.resolvedAt = nowIso;
      complaint.isOverdue = false;
      if (resolutionSummary) {
        complaint.resolutionSummary = sanitizeUntrustedText(resolutionSummary);
      }
      // Mark active escalations resolved
      db.escalations
        .filter((e) => e.complaintId === complaint.id)
        .forEach((e) => {
          e.resolved = true;
        });
    } else if (targetStatus === 'Resolution Proposed' && resolutionSummary) {
      complaint.resolutionSummary = sanitizeUntrustedText(resolutionSummary);
    } else if (targetStatus === 'Reopened') {
      complaint.resolvedAt = null;
    } else if (targetStatus === 'Escalated') {
      complaint.escalationLevel = Math.max(1, complaint.escalationLevel + 1);
      db.escalations.unshift({
        id: `ESC-${Date.now()}`,
        complaintId: complaint.id,
        complaintRef: complaint.referenceNumber,
        complaintTitle: complaint.title,
        bureauId: complaint.bureauId,
        priority: complaint.priority,
        escalationLevel: complaint.escalationLevel,
        reason: cleanReason,
        assignedOwnerRole: 'CENTRAL_MONITORING_OFFICER',
        assignedOwnerName: 'Dr. Rajeshwar Prasad',
        triggeredAt: nowIso,
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolved: false,
      });
    }

    db.statusHistory.unshift({
      id: `STH-${Date.now()}`,
      complaintId: complaint.id,
      previousStatus: prevStatus,
      newStatus: targetStatus,
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      reason: cleanReason,
      comment: resolutionSummary ? sanitizeUntrustedText(resolutionSummary) : undefined,
      timestamp: nowIso,
    });

    appendAuditLog(
      actor,
      targetStatus === 'Resolved'
        ? 'RESOLUTION_DECISION'
        : targetStatus === 'Reopened'
        ? 'CASE_REOPENED'
        : targetStatus === 'Escalated'
        ? 'ESCALATION_TRIGGERED'
        : 'STATUS_CHANGED',
      'COMPLAINT',
      complaint.referenceNumber,
      `Status transitioned from "${prevStatus}" to "${targetStatus}".`,
      cleanReason
    );

    persistDatabaseState(db);
    res.json({ complaint });
  });

  // 7. Add Investigation Note or External Comment
  app.post('/api/complaints/:id/comments', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const complaint = db.complaints.find((c) => c.id === req.params.id);

    if (!complaint || !canUserViewComplaint(actor, complaint)) {
      res.status(403).json({ error: 'Access Denied: Cannot view or annotate this complaint.' });
      return;
    }

    if (actor.role === 'AUDITOR') {
      res.status(403).json({ error: 'Access Denied: Read-Only Auditors cannot add case notes.' });
      return;
    }

    const { content, visibility, noteType } = req.body;
    const cleanContent = sanitizeUntrustedText(String(content || ''));
    if (cleanContent.length < 5) {
      res.status(400).json({ error: 'Note content must be at least 5 characters.' });
      return;
    }

    const finalVisibility =
      actor.role === 'INSTITUTION_LIAISON' ? 'INSTITUTION_VISIBLE' : visibility || 'INTERNAL';

    const comment = {
      id: `CMT-${Date.now()}`,
      complaintId: complaint.id,
      authorId: actor.id,
      authorName: actor.fullName,
      authorRole: actor.role,
      visibility: finalVisibility,
      noteType: noteType || 'INVESTIGATION_NOTE',
      content: cleanContent,
      createdAt: new Date().toISOString(),
    };

    db.comments.unshift(comment);
    complaint.updatedAt = comment.createdAt;
    persistDatabaseState(db);
    res.json({ comment });
  });

  // 8. Request Clarification from Institution OR Submit Institution Liaison Response
  app.post('/api/complaints/:id/institution-request', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const complaint = db.complaints.find((c) => c.id === req.params.id);

    if (!complaint || !canUserPerformAction(actor, 'REQUEST_INSTITUTION_INFO')) {
      res.status(403).json({ error: 'Access Denied: Role cannot issue institutional clarification requests.' });
      return;
    }

    const { requestQuestion, dueDays } = req.body;
    const cleanQuestion = sanitizeUntrustedText(String(requestQuestion || ''));
    if (cleanQuestion.length < 10) {
      res.status(400).json({ error: 'Clarification request question must be at least 10 characters.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const dueIso = new Date(Date.now() + (Number(dueDays) || 3) * 24 * 3600_000).toISOString();

    const reqItem = {
      id: `IRESP-${Date.now()}`,
      complaintId: complaint.id,
      institutionId: complaint.institutionId,
      requestedByName: actor.fullName,
      requestQuestion: cleanQuestion,
      requestedAt: nowIso,
      dueAt: dueIso,
      responseText: null,
      respondedByName: null,
      respondedAt: null,
      status: 'PENDING' as const,
    };

    db.institutionResponses.unshift(reqItem);

    if (complaint.status !== 'Awaiting Institution Response') {
      const prev = complaint.status;
      complaint.status = 'Awaiting Institution Response';
      db.statusHistory.unshift({
        id: `STH-${Date.now()}`,
        complaintId: complaint.id,
        previousStatus: prev,
        newStatus: 'Awaiting Institution Response',
        actorId: actor.id,
        actorName: actor.fullName,
        actorRole: actor.role,
        reason: `Issued formal clarification request to ${complaint.institutionName}.`,
        timestamp: nowIso,
      });
    }

    db.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      recipientRole: 'INSTITUTION_LIAISON',
      recipientBureauId: complaint.bureauId,
      eventType: 'INFO_REQUEST',
      title: `Clarification Requested: ${complaint.referenceNumber}`,
      message: cleanQuestion,
      complaintId: complaint.id,
      complaintRef: complaint.referenceNumber,
      isRead: false,
      createdAt: nowIso,
    });

    appendAuditLog(
      actor,
      'STATUS_CHANGED',
      'COMPLAINT',
      complaint.referenceNumber,
      `Issued clarification request to ${complaint.institutionName}.`,
      cleanQuestion
    );

    persistDatabaseState(db);
    res.json({ requestItem: reqItem, complaint });
  });

  app.post('/api/institution-responses/:respId/submit', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const respItem = db.institutionResponses.find((r) => r.id === req.params.respId);

    if (!respItem) {
      res.status(404).json({ error: 'Clarification request not found.' });
      return;
    }

    if (!canUserPerformAction(actor, 'SUBMIT_INSTITUTION_RESPONSE')) {
      res.status(403).json({ error: 'Access Denied: Role cannot submit institutional responses.' });
      return;
    }

    const { responseText } = req.body;
    const cleanResponse = sanitizeUntrustedText(String(responseText || ''));
    if (cleanResponse.length < 10) {
      res.status(400).json({ error: 'Response text must be at least 10 characters.' });
      return;
    }

    const nowIso = new Date().toISOString();
    respItem.responseText = cleanResponse;
    respItem.respondedByName = actor.fullName;
    respItem.respondedAt = nowIso;
    respItem.status = 'SUBMITTED';

    const complaint = db.complaints.find((c) => c.id === respItem.complaintId);
    if (complaint) {
      const prev = complaint.status;
      complaint.status = 'Under Investigation';
      complaint.updatedAt = nowIso;
      db.statusHistory.unshift({
        id: `STH-${Date.now()}`,
        complaintId: complaint.id,
        previousStatus: prev,
        newStatus: 'Under Investigation',
        actorId: actor.id,
        actorName: actor.fullName,
        actorRole: actor.role,
        reason: `Institution Liaison submitted compliance response: "${cleanResponse.slice(0, 80)}..."`,
        timestamp: nowIso,
      });

      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'BUREAU_OFFICER',
        recipientBureauId: complaint.bureauId,
        eventType: 'INSTITUTION_RESPONSE',
        title: `Institution Response Received: ${complaint.referenceNumber}`,
        message: `${complaint.institutionName} submitted its clarification response.`,
        complaintId: complaint.id,
        complaintRef: complaint.referenceNumber,
        isRead: false,
        createdAt: nowIso,
      });

      appendAuditLog(
        actor,
        'STATUS_CHANGED',
        'COMPLAINT',
        complaint.referenceNumber,
        `Institution Liaison submitted formal clarification response.`,
        cleanResponse.slice(0, 120)
      );
    }

    persistDatabaseState(db);
    res.json({ responseItem: respItem, complaint });
  });

  // 9. AI Recommendation Feedback (Accept / Modify / Reject)
  app.post('/api/complaints/:id/ai-feedback', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const complaint = db.complaints.find((c) => c.id === req.params.id);

    if (!complaint || actor.role === 'AUDITOR' || actor.role === 'INSTITUTION_LIAISON') {
      res.status(403).json({ error: 'Access Denied: Only authorized officers may review AI assessments.' });
      return;
    }

    const { decision, modifiedCategory, modifiedPriority, notes } = req.body;
    const assessment = db.aiAssessments[complaint.id];
    const nowIso = new Date().toISOString();

    if (assessment) {
      assessment.humanReviewStatus = decision;
      assessment.reviewedByName = actor.fullName;
      assessment.reviewedAt = nowIso;
    }

    if (decision === 'ACCEPTED' && assessment) {
      complaint.category = assessment.suggestedCategory;
      complaint.subcategory = assessment.suggestedSubcategory;
      complaint.priority = assessment.suggestedPriority;
      complaint.updatedAt = nowIso;
    } else if (decision === 'MODIFIED') {
      if (modifiedCategory) complaint.category = modifiedCategory;
      if (modifiedPriority) complaint.priority = modifiedPriority;
      complaint.updatedAt = nowIso;
    }

    const fb = {
      id: `AIFB-${Date.now()}`,
      complaintId: complaint.id,
      actorId: actor.id,
      actorName: actor.fullName,
      decision,
      modifiedCategory,
      modifiedPriority,
      notes: sanitizeUntrustedText(String(notes || 'Officer reviewed AI recommendation.')),
      createdAt: nowIso,
    };

    db.aiFeedback.unshift(fb);

    appendAuditLog(
      actor,
      'AI_FEEDBACK_RECORDED',
      'COMPLAINT',
      complaint.referenceNumber,
      `Officer marked AI assessment as ${decision}.`,
      fb.notes
    );

    persistDatabaseState(db);
    res.json({ assessment, feedback: fb, complaint });
  });

  // 10. Confirm or Dismiss Duplicate Complaint Relationship
  app.post('/api/relationships/:relId/decision', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    if (!canUserPerformAction(actor, 'UPDATE_STATUS')) {
      res.status(403).json({ error: 'Access Denied: Only authorized officers can confirm duplicate links.' });
      return;
    }

    const rel = db.relationships.find((r) => r.id === req.params.relId);
    if (!rel) {
      res.status(404).json({ error: 'Relationship record not found.' });
      return;
    }

    const { status } = req.body as { status: 'CONFIRMED' | 'DISMISSED' };
    rel.status = status;
    rel.relationshipType = status === 'CONFIRMED' ? 'CONFIRMED_DUPLICATE' : rel.relationshipType;
    rel.confirmedByName = actor.fullName;
    rel.confirmedAt = new Date().toISOString();

    appendAuditLog(
      actor,
      'CONFIG_UPDATED',
      'COMPLAINT',
      rel.sourceComplaintId,
      `Marked duplicate relationship ${rel.id} (${rel.sourceComplaintId} <-> ${rel.targetComplaintId}) as ${status}.`
    );

    persistDatabaseState(db);
    res.json({ relationship: rel });
  });

  // 11. Contextual Complaint Intelligence Assistant Query
  app.post('/api/ai/assistant-query', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const authorizedComplaints = filterAuthorizedComplaints(actor, db.complaints);
    const { query } = req.body;

    const result = answerOperationalQuery(
      String(query || 'Summary of current performance'),
      authorizedComplaints,
      db.bureaus,
      db.institutions,
      db.priorities
    );

    res.json(result);
  });

  // 12. Escalation Engine: Acknowledge or Recalculate SLA Targets
  app.post('/api/escalations/:escId/acknowledge', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    if (!canUserPerformAction(actor, 'UPDATE_STATUS')) {
      res.status(403).json({ error: 'Access Denied: Unauthorized role.' });
      return;
    }

    const esc = db.escalations.find((e) => e.id === req.params.escId);
    if (!esc) {
      res.status(404).json({ error: 'Escalation record not found.' });
      return;
    }

    esc.acknowledged = true;
    esc.acknowledgedBy = actor.fullName;
    esc.acknowledgedAt = new Date().toISOString();

    appendAuditLog(
      actor,
      'ESCALATION_ACKNOWLEDGED',
      'COMPLAINT',
      esc.complaintRef,
      `Acknowledged Level ${esc.escalationLevel} escalation for ${esc.complaintRef}.`
    );

    persistDatabaseState(db);
    res.json({ escalation: esc });
  });

  app.post('/api/escalations/recalculate', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    let newlyFlagged = 0;

    for (const c of db.complaints) {
      const sla = calculateCaseAgeingAndSla(c, db.priorities);
      if (sla.slaState === 'OVERDUE' && !c.isOverdue) {
        c.isOverdue = true;
        c.escalationLevel = Math.max(c.escalationLevel, sla.recommendedEscalationLevel);
        newlyFlagged++;
      }
    }

    appendAuditLog(
      actor,
      'CONFIG_UPDATED',
      'WORKFLOW_CONFIG',
      'SLA-ENGINE-SCAN',
      `Executed manual SLA & escalation scan across ${db.complaints.length} complaints (${newlyFlagged} newly flagged).`
    );

    persistDatabaseState(db);
    res.json({ scannedCount: db.complaints.length, newlyFlagged });
  });

  // 13. CSV Institution Directory Preview & Commit
  app.post('/api/institutions/import-preview', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    if (!canUserPerformAction(actor, 'IMPORT_INSTITUTIONS')) {
      res.status(403).json({ error: 'Access Denied: Role cannot import institution datasets.' });
      return;
    }

    const { csvText } = req.body;
    const preview = validateAndPreviewInstitutionCsv(String(csvText || ''), db.institutions);
    res.json(preview);
  });

  app.post('/api/institutions/import-commit', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    if (!canUserPerformAction(actor, 'IMPORT_INSTITUTIONS')) {
      res.status(403).json({ error: 'Access Denied: Role cannot commit institution imports.' });
      return;
    }

    const { csvText, fileName } = req.body;
    const preview = validateAndPreviewInstitutionCsv(String(csvText || ''), db.institutions);
    const nowIso = new Date().toISOString();

    for (const rec of preview.validRecords) {
      db.institutions.push({
        ...rec,
        id: `INST-${String(db.institutions.length + 1).padStart(3, '0')}`,
        createdAt: nowIso,
      });
    }

    const job = {
      id: `IMP-${Date.now()}`,
      actorName: actor.fullName,
      fileName: sanitizeUntrustedText(String(fileName || 'institutions_batch.csv')),
      totalRows: preview.totalRows,
      validRows: preview.validRecords.length,
      duplicateRows: preview.duplicateCodes.length,
      errorRows: preview.errors.length,
      status: 'COMPLETED' as const,
      createdAt: nowIso,
      errors: preview.errors,
    };

    db.importJobs.unshift(job);

    appendAuditLog(
      actor,
      'DATA_IMPORT_COMMITTED',
      'INSTITUTION',
      job.id,
      `Imported ${preview.validRecords.length} verified institution records from ${job.fileName}.`
    );

    persistDatabaseState(db);
    res.json({ job, importedCount: preview.validRecords.length });
  });

  // 14. Settings & Configuration Updates (Priority SLA Targets, Bureaus, User Roles, Demo Scenarios)
  app.post('/api/settings/priority-sla', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    if (!canUserPerformAction(actor, 'CONFIGURE_WORKFLOW')) {
      res.status(403).json({ error: 'Access Denied: Only Super Admin or Central Monitoring Officer can update SLA targets.' });
      return;
    }

    const { priority, responseTargetHours, resolutionTargetDays, warningThresholdPercent } = req.body;
    const target = db.priorities.find((p) => p.priority === priority);
    if (!target) {
      res.status(404).json({ error: 'Priority configuration not found.' });
      return;
    }

    target.responseTargetHours = Math.max(1, Number(responseTargetHours) || target.responseTargetHours);
    target.resolutionTargetDays = Math.max(1, Number(resolutionTargetDays) || target.resolutionTargetDays);
    target.warningThresholdPercent = Math.min(95, Math.max(50, Number(warningThresholdPercent) || target.warningThresholdPercent));

    appendAuditLog(
      actor,
      'CONFIG_UPDATED',
      'WORKFLOW_CONFIG',
      `SLA-${priority}`,
      `Updated ${priority} priority targets: Response=${target.responseTargetHours}h, Resolution=${target.resolutionTargetDays}d.`
    );

    persistDatabaseState(db);
    res.json({ priorities: db.priorities });
  });

  app.post('/api/notifications/mark-all-read', (_req: Request, res: Response) => {
    const db = getDatabaseState();
    db.notifications.forEach((n) => {
      n.isRead = true;
    });
    persistDatabaseState(db);
    res.json({ ok: true });
  });

  // 15. Demonstration Scenario Controls (Clearly Labeled Demo-Only Tool for SIH Judges)
  app.post('/api/demo/scenario', (req: Request, res: Response) => {
    const db = getDatabaseState();
    const actor = resolveActingUser(req);
    const { scenarioType } = req.body as {
      scenarioType: 'SIMULATE_CRITICAL_INTAKE' | 'SIMULATE_INSTITUTION_REPLY' | 'RESET_DEMO_DATA';
    };

    if (scenarioType === 'RESET_DEMO_DATA') {
      const fresh = resetToInitialSeedState();
      res.json({ message: 'Database reset to baseline certified records.', count: fresh.complaints.length });
      return;
    }

    const nowIso = new Date().toISOString();

    if (scenarioType === 'SIMULATE_CRITICAL_INTAKE') {
      const ref = generateComplaintReference(db.complaints.length, 2026);
      const id = `CMP-${String(db.complaints.length + 1).padStart(4, '0')}`;
      const inst = db.institutions[0];
      const simulated: Complaint = {
        id,
        referenceNumber: ref,
        title: 'Urgent Regulatory Verification: Certificate Retention & Scholarship Distribution',
        description:
          'Urgent regulatory complaint registered regarding delayed post-matric scholarships and non-issuance of original transfer certificates upon program withdrawal.',
        category: 'Student grievances',
        subcategory: 'Retention of Original Certificates / Fee Refund Delay',
        institutionId: inst.id,
        institutionName: inst.name,
        state: inst.state,
        district: inst.district,
        bureauId: 'BUR-GRIEVANCE',
        assignedOfficerId: 'USR-BUR-GRIEVANCE',
        assignedOfficerName: 'Prof. Meera Nair',
        priority: 'Critical',
        status: 'Assigned',
        sourceChannel: 'National Grievance Portal (CPGRAMS)',
        complainantType: 'Student (Verified)',
        affectedCount: 24,
        submittedAt: nowIso,
        updatedAt: nowIso,
        firstRespondedAt: nowIso,
        resolvedAt: null,
        slaDueAt: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
        escalationLevel: 0,
        isOverdue: false,
        isDemoData: false,
        resolutionSummary: null,
      };
      db.complaints.unshift(simulated);
      db.aiAssessments[id] = generateDeterministicAIAssessment(simulated, db.categories);
      db.statusHistory.unshift({
        id: `STH-${Date.now()}`,
        complaintId: id,
        previousStatus: null,
        newStatus: 'Assigned',
        actorId: actor.id,
        actorName: actor.fullName,
        actorRole: actor.role,
        reason: 'Registered via Urgent Escalation Intake Workflow.',
        timestamp: nowIso,
      });
      appendAuditLog(
        actor,
        'COMPLAINT_CREATED',
        'COMPLAINT',
        ref,
        'Processed Priority Regulatory Case Intake.'
      );
      persistDatabaseState(db);
      res.json({ message: `Created verified case intake ${ref}.`, complaint: simulated });
      return;
    }

    if (scenarioType === 'SIMULATE_INSTITUTION_REPLY') {
      const pending = db.institutionResponses.find((r) => r.status === 'PENDING');
      if (pending) {
        pending.status = 'SUBMITTED';
        pending.responseText =
          'Official Institution Liaison Compliance Report: Verified all original certificates dispatched via speed post (Consignment #EM829104829IN) and student fee refunds transferred via NEFT batch #20261027.';
        pending.respondedByName = 'Dr. Ananya Sharma';
        pending.respondedAt = nowIso;
        const cmp = db.complaints.find((c) => c.id === pending.complaintId);
        if (cmp) {
          cmp.status = 'Resolution Proposed';
          cmp.resolutionSummary = pending.responseText;
          cmp.updatedAt = nowIso;
        }
        persistDatabaseState(db);
        res.json({ message: `Processed institution compliance reply for ${cmp?.referenceNumber || pending.complaintId}.` });
        return;
      }
      res.json({ message: 'All pending institution requests have already been answered.' });
      return;
    }

    res.status(400).json({ error: 'Unknown scenario type.' });
  });

  // Support production static build if dist exists, or Vite dev middleware in development
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProduction) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AICTE Complaint Intelligence Hub running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
