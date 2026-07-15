BEGIN;

CREATE SCHEMA IF NOT EXISTS first_llm;

DO $$ BEGIN
  CREATE ROLE first_llm_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS first_llm.organizations (
  id text PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS first_llm.workspaces (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES first_llm.organizations(id) ON DELETE CASCADE,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS first_llm.subjects (
  id text PRIMARY KEY,
  external_id text UNIQUE,
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS first_llm.memberships (
  subject_id text NOT NULL REFERENCES first_llm.subjects(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES first_llm.workspaces(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'builder', 'viewer')),
  PRIMARY KEY (subject_id, workspace_id)
);

CREATE TABLE IF NOT EXISTS first_llm.workspace_resources (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES first_llm.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

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
        WHEN 'admin' THEN memberships.role IN ('owner', 'admin')
        ELSE false
      END
  );
$$;

ALTER TABLE first_llm.workspace_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE first_llm.workspace_resources FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_resource_select ON first_llm.workspace_resources;
CREATE POLICY workspace_resource_select ON first_llm.workspace_resources
  FOR SELECT USING (first_llm.can_access_workspace(workspace_id, 'read'));

DROP POLICY IF EXISTS workspace_resource_insert ON first_llm.workspace_resources;
CREATE POLICY workspace_resource_insert ON first_llm.workspace_resources
  FOR INSERT WITH CHECK (first_llm.can_access_workspace(workspace_id, 'write'));

DROP POLICY IF EXISTS workspace_resource_update ON first_llm.workspace_resources;
CREATE POLICY workspace_resource_update ON first_llm.workspace_resources
  FOR UPDATE USING (first_llm.can_access_workspace(workspace_id, 'write'))
  WITH CHECK (first_llm.can_access_workspace(workspace_id, 'write'));

DROP POLICY IF EXISTS workspace_resource_delete ON first_llm.workspace_resources;
CREATE POLICY workspace_resource_delete ON first_llm.workspace_resources
  FOR DELETE USING (first_llm.can_access_workspace(workspace_id, 'admin'));

GRANT USAGE ON SCHEMA first_llm TO first_llm_app;
GRANT SELECT ON first_llm.workspace_resources TO first_llm_app;
GRANT INSERT, UPDATE, DELETE ON first_llm.workspace_resources TO first_llm_app;

COMMIT;
