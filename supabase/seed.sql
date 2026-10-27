-- ============================================================================
-- AICTE COMPLAINT INTELLIGENCE HUB — SEED SCRIPT (SYNTHETIC DEMO DATA)
-- Clearly Labeled Demonstration Records — Not Official AICTE Records
-- ============================================================================

INSERT INTO organizations (code, name, is_demo, timezone, data_retention_days)
VALUES ('AICTE-DEMO-ORG', 'AICTE Complaint Intelligence Hub (SIH Proposed Prototype)', TRUE, 'Asia/Kolkata', 1825)
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (id, name, description) VALUES
  ('SUPER_ADMIN', 'Super Administrator', 'Full governance over users, roles, bureaus, workflows, and security audit reports.'),
  ('CENTRAL_MONITORING_OFFICER', 'Central Monitoring Officer', 'Consolidated monitoring across bureaus, case assignment, escalation review, and executive reporting.'),
  ('BUREAU_OFFICER', 'Bureau/Cell Officer', 'Case investigation, status transitions, clarification requests, and resolution proposals within assigned bureau.'),
  ('INSTITUTION_LIAISON', 'Institution Liaison Officer', 'Responds to clarification requests and views authorized institutional complaints.'),
  ('AUDITOR', 'Read-Only Auditor', 'Inspects immutable case timelines, audit logs, and compliance reports without write permissions.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bureaus (id, code, name, description, head_officer_name, sla_response_hours, sla_resolution_days, capacity_limit) VALUES
  ('BUR-APPROVAL', 'AB-DEMO', 'Approval & Affiliation Bureau (Demo)', 'Handles institutional extension of approval, intake norms, and affiliation compliance.', 'Dr. R. K. Verma (Demo)', 24, 14, 25),
  ('BUR-GRIEVANCE', 'PGRC-DEMO', 'Public Grievance & Student Redressal Cell (Demo)', 'Monitors student fee refund, document retention, and anti-ragging compliance.', 'Prof. Meera Nair (Demo)', 12, 10, 30),
  ('BUR-ACADEMIC', 'AQB-DEMO', 'Academic Quality & Faculty Norms Bureau (Demo)', 'Investigates faculty-to-student ratios, salary disbursement, and curriculum standards.', 'Dr. Arvind Deshmukh (Demo)', 24, 15, 20),
  ('BUR-INFRA', 'IFC-DEMO', 'Infrastructure & Lab Vigilance Cell (Demo)', 'Audits laboratory deficiencies, safety norms, and barrier-free campus compliance.', 'Smt. Kavita Rao (Demo)', 24, 18, 20),
  ('BUR-FINANCE', 'FGC-DEMO', 'Financial & Scholarship Governance Cell (Demo)', 'Reviews scholarship disbursement delays, unauthorized fee levies, and grant utilization.', 'Shri S. Natarajan (Demo)', 16, 12, 20)
ON CONFLICT (id) DO NOTHING;
