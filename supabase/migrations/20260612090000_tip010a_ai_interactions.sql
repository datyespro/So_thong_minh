-- TIP-010A: Persist one AI pipeline interaction per chat turn.

CREATE TABLE public.ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  intent TEXT,
  confidence NUMERIC,
  extracted JSONB,
  validated JSONB,
  model_version TEXT,
  latency_ms INTEGER,
  outcome TEXT NOT NULL,
  outcome_at TIMESTAMPTZ,
  error_stage TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_interactions_outcome_check CHECK (
    outcome IN ('proposed','answered','none','error','committed','dismissed','undone')
  )
);

CREATE INDEX ai_interactions_owner_created_idx
  ON public.ai_interactions (owner_id, created_at DESC);
CREATE INDEX ai_interactions_turn_idx
  ON public.ai_interactions (owner_id, turn_id);
CREATE INDEX ai_interactions_owner_outcome_idx
  ON public.ai_interactions (owner_id, outcome, created_at DESC);

REVOKE ALL ON TABLE public.ai_interactions FROM anon;
REVOKE ALL ON TABLE public.ai_interactions FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_interactions TO authenticated;
GRANT ALL ON TABLE public.ai_interactions TO service_role;

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_interactions_select_own
  ON public.ai_interactions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY ai_interactions_insert_own
  ON public.ai_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY ai_interactions_update_own
  ON public.ai_interactions
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);
