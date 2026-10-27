-- ============================================================================
-- AICTE COMPLAINT INTELLIGENCE HUB — DATABASE MIGRATION 001
-- Normalized PostgreSQL Schema for Institutional Complaint Intelligence
-- Proposed SIH Prototype — Demonstration & Production Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations & Bureaus
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT TRUE,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  data_retention_days INTEGER NOT NULL DEFAULT 1825,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bureaus (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  head_officer_name VARCHAR(255) NOT NULL,
  sla_response_hours INTEGER NOT NULL DEFAULT 24,
  sla_resolution_days INTEGER NOT NULL DEFAULT 14,
  capacity_limit INTEGER NOT NULL DEFAULT 25,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo_config BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Roles, Permissions, Profiles & Role Assignments
CREATE TABLE roles (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE permissions (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(128) UNIQUE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE profiles (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL REFERENCES roles(id),
  bureau_id VARCHAR(64) REFERENCES bureaus(id),
  institution_id VARCHAR(64),
  designation VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo_user BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by VARCHAR(64) REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- 3. Institution Directory
CREATE TABLE institution_directory (
  id VARCHAR(64) PRIMARY KEY,
  institution_code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  institution_type VARCHAR(128) NOT NULL,
  state VARCHAR(128) NOT NULL,
  district VARCHAR(128) NOT NULL,
  address TEXT,
  approval_status VARCHAR(64) NOT NULL DEFAULT 'Verified (Demo)',
  contact_email VARCHAR(255),
  contact_phone VARCHAR(64),
  source_provenance VARCHAR(255) NOT NULL DEFAULT 'SIH Synthetic Demo Dataset',
  is_demo_record BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_institutions_state_district ON institution_directory(state, district);
CREATE INDEX idx_institutions_code ON institution_directory(institution_code);

-- 4. Configuration Tables (Categories, Priorities, Escalation Rules, Workflows)
CREATE TABLE category_configurations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  subcategories JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_bureau_id VARCHAR(64) REFERENCES bureaus(id),
  default_priority VARCHAR(32) NOT NULL DEFAULT 'Medium',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo_config BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE priority_configurations (
  priority VARCHAR(32) PRIMARY KEY,
  weight INTEGER NOT NULL,
  response_target_hours INTEGER NOT NULL,
  resolution_target_days INTEGER NOT NULL,
  warning_threshold_percent INTEGER NOT NULL DEFAULT 75,
  escalation_role VARCHAR(64) NOT NULL
);

CREATE TABLE workflow_configurations (
  status VARCHAR(64) PRIMARY KEY,
  stage_order INTEGER NOT NULL,
  allowed_next_statuses JSONB NOT NULL,
  allowed_roles JSONB NOT NULL,
  requires_reason BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE escalation_configurations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  priority VARCHAR(32) NOT NULL REFERENCES priority_configurations(priority),
  trigger_condition VARCHAR(255) NOT NULL,
  target_hours INTEGER NOT NULL,
  escalation_level INTEGER NOT NULL,
  assign_to_role VARCHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 5. Core Complaints Table
CREATE TABLE complaints (
  id VARCHAR(64) PRIMARY KEY,
  reference_number VARCHAR(64) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(255) NOT NULL,
  subcategory VARCHAR(255) NOT NULL,
  institution_id VARCHAR(64) NOT NULL REFERENCES institution_directory(id),
  institution_name VARCHAR(255) NOT NULL,
  state VARCHAR(128) NOT NULL,
  district VARCHAR(128) NOT NULL,
  bureau_id VARCHAR(64) NOT NULL REFERENCES bureaus(id),
  assigned_officer_id VARCHAR(64) REFERENCES profiles(id),
  assigned_officer_name VARCHAR(255),
  priority VARCHAR(32) NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  status VARCHAR(64) NOT NULL CHECK (status IN (
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
    'Escalated'
  )),
  source_channel VARCHAR(64) NOT NULL,
  complainant_type VARCHAR(64) NOT NULL,
  affected_count INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ NOT NULL,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo_data BOOLEAN NOT NULL DEFAULT TRUE,
  resolution_summary TEXT,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_bureau ON complaints(bureau_id);
CREATE INDEX idx_complaints_institution ON complaints(institution_id);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_submitted_at ON complaints(submitted_at DESC);

-- 6. Assignments, Status History, Comments, Responses, Attachments, Relationships, Escalations
CREATE TABLE complaint_assignments (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  from_bureau_id VARCHAR(64),
  to_bureau_id VARCHAR(64) NOT NULL REFERENCES bureaus(id),
  assigned_officer_id VARCHAR(64) REFERENCES profiles(id),
  assigned_by_id VARCHAR(64) NOT NULL REFERENCES profiles(id),
  assigned_by_name VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE complaint_status_history (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  previous_status VARCHAR(64),
  new_status VARCHAR(64) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  comment TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE complaint_comments (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_id VARCHAR(64) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_role VARCHAR(64) NOT NULL,
  visibility VARCHAR(32) NOT NULL CHECK (visibility IN ('INTERNAL', 'INSTITUTION_VISIBLE', 'PUBLIC_SUMMARY')),
  note_type VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE complaint_institution_responses (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  institution_id VARCHAR(64) NOT NULL REFERENCES institution_directory(id),
  requested_by_name VARCHAR(255) NOT NULL,
  request_question TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL,
  response_text TEXT,
  responded_by_name VARCHAR(255),
  responded_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'SUBMITTED', 'VERIFIED'))
);

CREATE TABLE complaint_attachments (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(128) NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  uploaded_by_name VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum_sha256 VARCHAR(128) NOT NULL
);

CREATE TABLE complaint_relationships (
  id VARCHAR(64) PRIMARY KEY,
  source_complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  target_complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  relationship_type VARCHAR(64) NOT NULL CHECK (relationship_type IN ('SUSPECTED_DUPLICATE', 'CONFIRMED_DUPLICATE', 'RELATED_INSTITUTION_ISSUE')),
  similarity_score NUMERIC(5,2) NOT NULL,
  match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmed_by_name VARCHAR(255),
  confirmed_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL CHECK (status IN ('SUSPECTED', 'CONFIRMED', 'DISMISSED'))
);

CREATE TABLE complaint_escalations (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  escalation_level INTEGER NOT NULL,
  reason TEXT NOT NULL,
  assigned_owner_role VARCHAR(64) NOT NULL,
  assigned_owner_name VARCHAR(255) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN NOT NULL DEFAULT FALSE
);

-- 7. Explainable AI Assessments & Human Feedback
CREATE TABLE complaint_ai_assessments (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(64) UNIQUE NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  engine_mode VARCHAR(64) NOT NULL CHECK (engine_mode IN ('DETERMINISTIC_RULE_ENGINE', 'SERVER_LLM_ADAPTER')),
  suggested_category VARCHAR(255) NOT NULL,
  suggested_subcategory VARCHAR(255) NOT NULL,
  suggested_priority VARCHAR(32) NOT NULL,
  suggested_bureau_id VARCHAR(64) NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL,
  priority_factors JSONB NOT NULL,
  executive_summary JSONB NOT NULL,
  suggested_next_actions JSONB NOT NULL,
  urgency_signals JSONB NOT NULL,
  explainability_notes TEXT NOT NULL,
  limitations_disclosure TEXT NOT NULL,
  human_review_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (human_review_status IN ('PENDING_REVIEW', 'ACCEPTED', 'MODIFIED', 'REJECTED')),
  reviewed_by_name VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_feedback (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(64) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  actor_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  decision VARCHAR(32) NOT NULL CHECK (decision IN ('ACCEPTED', 'MODIFIED', 'REJECTED')),
  modified_category VARCHAR(255),
  modified_priority VARCHAR(32),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Notifications, Saved Searches, Imports & Immutable Audit Logs
CREATE TABLE notifications (
  id VARCHAR(64) PRIMARY KEY,
  recipient_role VARCHAR(64),
  recipient_bureau_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  complaint_id VARCHAR(64) REFERENCES complaints(id) ON DELETE SET NULL,
  complaint_ref VARCHAR(64),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notify_on_assignment BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_escalation BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_institution_response BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE saved_searches (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_jobs (
  id VARCHAR(64) PRIMARY KEY,
  actor_name VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL,
  valid_rows INTEGER NOT NULL,
  duplicate_rows INTEGER NOT NULL,
  error_rows INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_job_id VARCHAR(64) NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  field_name VARCHAR(128) NOT NULL,
  error_message TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_reference VARCHAR(128) NOT NULL,
  summary TEXT NOT NULL,
  reason TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
