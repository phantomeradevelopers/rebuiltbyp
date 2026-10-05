CREATE TABLE public.journal_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_replies_journal ON public.journal_replies(journal_id);
CREATE INDEX idx_journal_replies_user ON public.journal_replies(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.journal_replies TO authenticated;
GRANT ALL ON public.journal_replies TO service_role;

ALTER TABLE public.journal_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own journal replies"
ON public.journal_replies FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users update their own journal replies"
ON public.journal_replies FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own journal replies"
ON public.journal_replies FOR DELETE
USING (auth.uid() = user_id);