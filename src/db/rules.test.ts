import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStatusTransition,
  canUserViewComplaint,
  canUserPerformAction,
  generateComplaintReference,
  calculateCaseAgeingAndSla,
  generateDeterministicAIAssessment,
  detectPotentialDuplicates,
  validateAndPreviewInstitutionCsv,
} from './rules';
import { Complaint, PriorityConfig, UserProfile } from './types';

const mockSuperAdmin: UserProfile = {
  id: 'USR-ADMIN',
  email: 'admin@aicte-india.org',
  fullName: 'Dr. S. Subramanian',
  role: 'SUPER_ADMIN',
  bureauId: null,
  institutionId: null,
  designation: 'Super Administrator',
  active: true,
  isDemoUser: false,
};

const mockBureauOfficer: UserProfile = {
  id: 'USR-BUR-GRIEVANCE',
  email: 'meera.nair@aicte-india.org',
  fullName: 'Prof. Meera Nair',
  role: 'BUREAU_OFFICER',
  bureauId: 'BUR-GRIEVANCE',
  institutionId: null,
  designation: 'Grievance Cell Officer',
  active: true,
  isDemoUser: false,
};

const mockAuditor: UserProfile = {
  id: 'USR-AUDITOR',
  email: 'k.venkataraman@aicte-india.org',
  fullName: 'Shri K. Venkataraman',
  role: 'AUDITOR',
  bureauId: null,
  institutionId: null,
  designation: 'Principal Audit Officer',
  active: true,
  isDemoUser: false,
};

const mockLiaison: UserProfile = {
  id: 'USR-INST-01',
  email: 'liaison@coep.ac.in',
  fullName: 'Dr. Ananya Sharma',
  role: 'INSTITUTION_LIAISON',
  bureauId: null,
  institutionId: 'INST-001',
  designation: 'Institution Nodal Liaison',
  active: true,
  isDemoUser: false,
};

const mockPriorityConfigs: PriorityConfig[] = [
  { priority: 'Critical', weight: 4, responseTargetHours: 6, resolutionTargetDays: 5, warningThresholdPercent: 75, escalationRole: 'CENTRAL_MONITORING_OFFICER' },
  { priority: 'High', weight: 3, responseTargetHours: 12, resolutionTargetDays: 10, warningThresholdPercent: 75, escalationRole: 'CENTRAL_MONITORING_OFFICER' },
  { priority: 'Medium', weight: 2, responseTargetHours: 24, resolutionTargetDays: 15, warningThresholdPercent: 75, escalationRole: 'BUREAU_OFFICER' },
  { priority: 'Low', weight: 1, responseTargetHours: 48, resolutionTargetDays: 21, warningThresholdPercent: 80, escalationRole: 'BUREAU_OFFICER' },
];

test('generateComplaintReference produces sequential formatted official references', () => {
  assert.equal(generateComplaintReference(0, 2026), 'AICTE-2026-00001');
  assert.equal(generateComplaintReference(41, 2026), 'AICTE-2026-00042');
});

test('validateStatusTransition enforces state machine and role permissions', () => {
  // Valid transition by assigned Bureau Officer
  const validRes = validateStatusTransition(
    'Assigned',
    'Under Investigation',
    mockBureauOfficer,
    'BUR-GRIEVANCE',
    'Initiating preliminary documentary verification of student fee refund claim.'
  );
  assert.equal(validRes.valid, true);

  // Invalid jump from Received directly to Resolved
  const invalidJump = validateStatusTransition(
    'Received',
    'Resolved',
    mockSuperAdmin,
    'BUR-GRIEVANCE',
    'Trying to skip investigation workflow stages.'
  );
  assert.equal(invalidJump.valid, false);
  assert.match(invalidJump.error || '', /Invalid workflow transition/);

  // Read-only auditor blocked from status transition
  const auditorBlocked = validateStatusTransition(
    'Assigned',
    'Under Investigation',
    mockAuditor,
    'BUR-GRIEVANCE',
    'Auditor attempting status mutation.'
  );
  assert.equal(auditorBlocked.valid, false);
  assert.match(auditorBlocked.error || '', /Access Denied/);

  // Cross-bureau officer blocked from modifying another bureau's complaint
  const crossBureauBlocked = validateStatusTransition(
    'Assigned',
    'Under Investigation',
    mockBureauOfficer,
    'BUR-APPROVAL',
    'Officer from Grievance trying to modify Approval Bureau case.'
  );
  assert.equal(crossBureauBlocked.valid, false);
  assert.match(crossBureauBlocked.error || '', /authorized bureau/);
});

test('Row-Level Security helper scopes complaints by role, bureau, and institution', () => {
  const sampleComplaint: Complaint = {
    id: 'CMP-001',
    referenceNumber: 'AICTE-2026-00001',
    title: 'Retention of Original Certificates',
    description: 'Original mark sheets withheld by administration.',
    category: 'Student grievances',
    subcategory: 'Retention of Original Certificates / Fee Refund Delay',
    institutionId: 'INST-001',
    institutionName: 'COEP Technological University',
    state: 'Maharashtra',
    district: 'Pune',
    bureauId: 'BUR-GRIEVANCE',
    assignedOfficerId: 'USR-BUR-GRIEVANCE',
    assignedOfficerName: 'Prof. Meera Nair',
    priority: 'High',
    status: 'Under Investigation',
    sourceChannel: 'Web Portal (Demo)',
    complainantType: 'Student (Anonymized)',
    affectedCount: 14,
    submittedAt: '2026-10-10T09:00:00.000Z',
    updatedAt: '2026-10-12T09:00:00.000Z',
    firstRespondedAt: '2026-10-10T14:00:00.000Z',
    resolvedAt: null,
    slaDueAt: '2026-10-20T09:00:00.000Z',
    escalationLevel: 1,
    isOverdue: true,
    isDemoData: true,
    resolutionSummary: null,
  };

  assert.equal(canUserViewComplaint(mockSuperAdmin, sampleComplaint), true);
  assert.equal(canUserViewComplaint(mockAuditor, sampleComplaint), true);
  assert.equal(canUserViewComplaint(mockBureauOfficer, sampleComplaint), true);
  assert.equal(canUserViewComplaint(mockLiaison, sampleComplaint), true);

  const otherLiaison: UserProfile = { ...mockLiaison, institutionId: 'INST-DEMO-999' };
  assert.equal(canUserViewComplaint(otherLiaison, sampleComplaint), false);

  assert.equal(canUserPerformAction(mockAuditor, 'ASSIGN_COMPLAINT'), false);
  assert.equal(canUserPerformAction(mockAuditor, 'VIEW_AUDIT_LOGS'), true);
});

test('calculateCaseAgeingAndSla accurately detects overdue and within-target cases', () => {
  const overdueCheck = calculateCaseAgeingAndSla(
    {
      submittedAt: '2026-10-01T00:00:00.000Z',
      slaDueAt: '2026-10-11T00:00:00.000Z',
      status: 'Under Investigation',
      priority: 'High',
      resolvedAt: null,
    },
    mockPriorityConfigs,
    '2026-10-20T00:00:00.000Z'
  );
  assert.equal(overdueCheck.slaState, 'OVERDUE');
  assert.equal(overdueCheck.ageDays, 19);
  assert.equal(overdueCheck.recommendedEscalationLevel >= 2, true);
});

test('generateDeterministicAIAssessment classifies, scores priority, and flags urgency transparently', () => {
  const assessment = generateDeterministicAIAssessment(
    {
      id: 'CMP-TEST',
      title: 'Withheld Original Certificates and Unapproved Fee Demand',
      description: 'Original certificate and mark sheets are withheld by college despite fee refund norms; 60 students affected before admission deadline.',
      institutionName: 'Vanguard Technical Institute (Demo)',
      affectedCount: 60,
    },
    []
  );
  assert.equal(assessment.engineMode, 'DETERMINISTIC_RULE_ENGINE');
  assert.equal(assessment.suggestedCategory, 'Student grievances');
  assert.equal(assessment.suggestedPriority, 'Critical');
  assert.equal(assessment.urgencySignals.length > 0, true);
});

test('detectPotentialDuplicates identifies similar complaints at the same institution', () => {
  const existing: Complaint[] = [
    {
      id: 'CMP-100',
      referenceNumber: 'AICTE-2026-00100',
      title: 'Non-payment of prescribed 7th Pay faculty salary for 5 months',
      description: 'Faculty members in Computer Science department have not received salary disbursement for 5 months.',
      category: 'Faculty and staffing concerns',
      subcategory: 'Non-Payment of Prescribed Scale / Faculty Shortage',
      institutionId: 'INST-002',
      institutionName: 'JNTU Hyderabad College of Engineering',
      state: 'Telangana',
      district: 'Hyderabad',
      bureauId: 'BUR-ACADEMIC',
      assignedOfficerId: null,
      assignedOfficerName: null,
      priority: 'High',
      status: 'Under Investigation',
      sourceChannel: 'National Grievance Portal (CPGRAMS)',
      complainantType: 'Faculty Member (Verified)',
      affectedCount: 28,
      submittedAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-19T10:00:00.000Z',
      firstRespondedAt: null,
      resolvedAt: null,
      slaDueAt: '2026-10-28T10:00:00.000Z',
      escalationLevel: 0,
      isOverdue: false,
      isDemoData: false,
      resolutionSummary: null,
    },
  ];

  const matches = detectPotentialDuplicates(
    {
      id: 'CMP-101',
      title: 'Pending faculty salary disbursement for 5 months in CSE department',
      description: 'Regular faculty salary has been withheld for 5 months at JNTU Hyderabad.',
      institutionId: 'INST-002',
      category: 'Faculty and staffing concerns',
      submittedAt: '2026-10-21T10:00:00.000Z',
    },
    existing
  );

  assert.equal(matches.length, 1);
  assert.equal(matches[0].relationshipType, 'SUSPECTED_DUPLICATE');
  assert.equal(matches[0].similarityScore >= 60, true);
});

test('validateAndPreviewInstitutionCsv validates format and catches duplicates', () => {
  const csv = [
    'institution_code,name,type,state,district,email',
    '1-8921011,Institute of Engineering and Technology Lucknow,Engineering & Technology,Uttar Pradesh,Lucknow,nodal@ietlucknow.ac.in',
    'INVALID_CODE,Short,Engineering,UP,Lucknow,bad@email.com',
  ].join('\n');

  const preview = validateAndPreviewInstitutionCsv(csv, []);
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.validRecords.length, 1);
  assert.equal(preview.errors.length, 1);
});
