BEGIN;

CREATE OR REPLACE FUNCTION first_llm.can_access_workspace(target_workspace text, requested_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = first_llm, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships
    WHERE memberships.subject_id = current_setting('first_llm.subject_id', true)
      AND memberships.workspace_id = target_workspace
      AND target_workspace = current_setting('first_llm.workspace_id', true)
      AND CASE requested_action
        WHEN 'read' THEN memberships.role IN ('owner', 'admin', 'builder', 'viewer')
        WHEN 'write' THEN memberships.role IN ('owner', 'admin', 'builder')
        WHEN 'execute' THEN memberships.role IN ('owner', 'admin', 'builder')
        WHEN 'admin' THEN memberships.role IN ('owner', 'admin')
        ELSE false
      END
  );
$$;

CREATE TABLE IF NOT EXISTS first_llm.workspace_audit_events (
  id text PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id text NOT NULL,
  subject_id text NOT NULL,
  workspace_id text NOT NULL,
  action text NOT NULL,
  resource_id text,
  resource_kind text,
  outcome text NOT NULL CHECK (outcome IN ('allowed', 'denied')),
  reason text NOT NULL
);

CREATE INDEX IF NOT EXISTS workspace_audit_workspace_time_idx
  ON first_llm.workspace_audit_events(workspace_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION first_llm.reject_workspace_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'workspace audit events are immutable';
END;
$$;

DROP TRIGGER IF EXISTS workspace_audit_no_update ON first_llm.workspace_audit_events;
CREATE TRIGGER workspace_audit_no_update
  BEFORE UPDATE ON first_llm.workspace_audit_events
  FOR EACH ROW EXECUTE FUNCTION first_llm.reject_workspace_audit_mutation();

DROP TRIGGER IF EXISTS workspace_audit_no_delete ON first_llm.workspace_audit_events;
CREATE TRIGGER workspace_audit_no_delete
  BEFORE DELETE ON first_llm.workspace_audit_events
  FOR EACH ROW EXECUTE FUNCTION first_llm.reject_workspace_audit_mutation();

ALTER TABLE first_llm.workspace_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE first_llm.workspace_audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_audit_select ON first_llm.workspace_audit_events;
CREATE POLICY workspace_audit_select ON first_llm.workspace_audit_events
  FOR SELECT USING (first_llm.can_access_workspace(workspace_id, 'admin'));

CREATE OR REPLACE FUNCTION first_llm.record_workspace_audit(
  event_id text,
  request_id text,
  target_workspace text,
  action text,
  resource_id text,
  resource_kind text,
  outcome text,
  reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = first_llm, pg_temp
AS $$
BEGIN
  IF target_workspace IS DISTINCT FROM current_setting('first_llm.workspace_id', true) THEN
    RAISE EXCEPTION 'audit workspace does not match transaction context';
  END IF;
  IF NOT first_llm.can_access_workspace(target_workspace, 'read') THEN
    RAISE EXCEPTION 'workspace membership is required to record audit';
  END IF;
  INSERT INTO first_llm.workspace_audit_events(
    id, request_id, subject_id, workspace_id, action,
    resource_id, resource_kind, outcome, reason
  ) VALUES (
    event_id,
    request_id,
    current_setting('first_llm.subject_id', true),
    target_workspace,
    action,
    resource_id,
    resource_kind,
    outcome,
    reason
  );
END;
$$;

REVOKE ALL ON first_llm.workspace_audit_events FROM first_llm_app;
GRANT SELECT ON first_llm.workspace_audit_events TO first_llm_app;
GRANT EXECUTE ON FUNCTION first_llm.record_workspace_audit(text, text, text, text, text, text, text, text) TO first_llm_app;

COMMIT;
