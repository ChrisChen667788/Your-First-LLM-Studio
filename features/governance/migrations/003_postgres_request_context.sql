BEGIN;

CREATE OR REPLACE FUNCTION first_llm.set_request_context(subject_id text, workspace_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF subject_id IS NULL OR btrim(subject_id) = '' OR workspace_id IS NULL OR btrim(workspace_id) = '' THEN
    RAISE EXCEPTION 'subject_id and workspace_id are required';
  END IF;
  PERFORM set_config('first_llm.subject_id', subject_id, true);
  PERFORM set_config('first_llm.workspace_id', workspace_id, true);
END;
$$;

GRANT EXECUTE ON FUNCTION first_llm.set_request_context(text, text) TO first_llm_app;

COMMIT;
