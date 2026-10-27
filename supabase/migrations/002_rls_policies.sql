-- ============================================================================
-- AICTE COMPLAINT INTELLIGENCE HUB — DATABASE MIGRATION 002
-- Row Level Security (RLS) Policies & Immutable Audit Trail Enforcement
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_institution_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_configurations ENABLE ROW LEVEL SECURITY;

-- Helper function to retrieve authenticated user role from profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()::varchar;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_bureau()
RETURNS VARCHAR AS $$
  SELECT bureau_id FROM public.profiles WHERE id = auth.uid()::varchar;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_institution()
RETURNS VARCHAR AS $$
  SELECT institution_id FROM public.profiles WHERE id = auth.uid()::varchar;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1. Complaints Visibility Policy (Enforces Bureau & Institution Boundaries)
CREATE POLICY "Authorized roles view complaints within scope"
ON complaints FOR SELECT
USING (
  public.current_user_role() IN ('SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'AUDITOR')
  OR (public.current_user_role() = 'BUREAU_OFFICER' AND bureau_id = public.current_user_bureau())
  OR (public.current_user_role() = 'INSTITUTION_LIAISON' AND institution_id = public.current_user_institution())
);

-- 2. Complaints Modification Policy (Read-Only Auditor & Institution Liaison blocked from direct status mutation)
CREATE POLICY "Authorized officers update complaints in scope"
ON complaints FOR UPDATE
USING (
  public.current_user_role() IN ('SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER')
  OR (public.current_user_role() = 'BUREAU_OFFICER' AND bureau_id = public.current_user_bureau())
);

-- 3. Internal Notes Protection (Institution Liaison cannot view INTERNAL investigation comments)
CREATE POLICY "Internal notes hidden from Institution Liaison"
ON complaint_comments FOR SELECT
USING (
  public.current_user_role() IN ('SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'BUREAU_OFFICER', 'AUDITOR')
  OR (public.current_user_role() = 'INSTITUTION_LIAISON' AND visibility != 'INTERNAL')
);

-- 4. Immutable Audit Logs (Insert-only via server/triggers; NO UPDATE or DELETE for any role)
CREATE POLICY "Authorized roles read audit logs"
ON audit_logs FOR SELECT
USING (
  public.current_user_role() IN ('SUPER_ADMIN', 'CENTRAL_MONITORING_OFFICER', 'AUDITOR')
);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Security Violation: Audit log records are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
