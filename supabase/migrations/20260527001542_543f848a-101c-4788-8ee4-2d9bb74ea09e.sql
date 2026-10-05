
-- =============================================
-- medication_catalog
-- =============================================
CREATE TABLE public.medication_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'generic',
  default_unit TEXT NOT NULL DEFAULT 'mg',
  typical_route TEXT NOT NULL DEFAULT 'oral',
  guidance_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.medication_catalog TO authenticated;
GRANT ALL ON public.medication_catalog TO service_role;

ALTER TABLE public.medication_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog read all auth" ON public.medication_catalog
  FOR SELECT TO authenticated USING (true);

-- =============================================
-- user_medications
-- =============================================
CREATE TABLE public.user_medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  catalog_id UUID REFERENCES public.medication_catalog(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  dose_amount NUMERIC,
  dose_unit TEXT,
  route TEXT,
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  source_tag TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX user_medications_user_active_idx ON public.user_medications(user_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_medications TO authenticated;
GRANT ALL ON public.user_medications TO service_role;

ALTER TABLE public.user_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_medications self all" ON public.user_medications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_medications_touch_updated_at
  BEFORE UPDATE ON public.user_medications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================
-- medication_doses
-- =============================================
CREATE TABLE public.medication_doses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  medication_id UUID NOT NULL REFERENCES public.user_medications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  taken_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (medication_id, scheduled_at)
);

CREATE INDEX medication_doses_user_sched_idx ON public.medication_doses(user_id, scheduled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_doses TO authenticated;
GRANT ALL ON public.medication_doses TO service_role;

ALTER TABLE public.medication_doses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medication_doses self all" ON public.medication_doses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- Seed catalog (CandyRx-inspired + generics)
-- =============================================
INSERT INTO public.medication_catalog
  (slug, brand_name, generic_name, category, source, default_unit, typical_route, guidance_text, sort_order)
VALUES
  -- Weight Loss / GLP-1
  ('compounded-semaglutide', 'Compounded Semaglutide', 'Semaglutide', 'Weight Loss', 'candyrx', 'mg', 'subq', 'GLP-1 agonist. Typically weekly subcutaneous injection.', 10),
  ('compounded-tirzepatide-inj', 'Compounded Tirzepatide (Injection)', 'Tirzepatide', 'Weight Loss', 'candyrx', 'mg', 'subq', 'GLP-1/GIP agonist. Typically weekly subcutaneous injection.', 11),
  ('compounded-tirzepatide-odt', 'Compounded Tirzepatide (Oral)', 'Tirzepatide', 'Weight Loss', 'candyrx', 'mg', 'oral', 'Oral dissolving tablet. Follow prescriber schedule.', 12),
  ('glp-squared', 'GLP Squared Injection', 'Semaglutide + Tirzepatide', 'Weight Loss', 'candyrx', 'mg', 'subq', 'Combination GLP-1 injection.', 13),
  ('mounjaro', 'Mounjaro®', 'Tirzepatide', 'Weight Loss', 'candyrx', 'mg', 'subq', 'Brand tirzepatide. Weekly injection.', 14),
  ('micc-injection', 'MICC Injection', 'Methionine/Inositol/Choline/B12', 'Weight Loss', 'candyrx', 'ml', 'im', 'Lipotropic blend. Follow prescriber frequency.', 15),
  -- Hormonal / TRT
  ('testosterone-cypionate', 'Testosterone Cypionate', 'Testosterone Cypionate', 'Hormonal Therapy', 'candyrx', 'mg', 'im', 'TRT. Controlled substance. Follow prescriber dose and frequency exactly.', 20),
  ('enclomiphene', 'Enclomiphene', 'Enclomiphene Citrate', 'Hormonal Therapy', 'candyrx', 'mg', 'oral', 'SERM used to support endogenous testosterone.', 21),
  ('anastrozole', 'Anastrozole', 'Anastrozole', 'Hormonal Therapy', 'generic', 'mg', 'oral', 'Aromatase inhibitor. Follow prescriber dose.', 22),
  ('hcg', 'HCG', 'Human Chorionic Gonadotropin', 'Hormonal Therapy', 'candyrx', 'iu', 'subq', 'Follow prescriber protocol.', 23),
  -- Wellness / Anti-aging / Peptides
  ('nad-injection', 'NAD+ Injection', 'Nicotinamide Adenine Dinucleotide', 'Wellness / Anti-Aging', 'candyrx', 'mg', 'subq', 'Peptide therapy. Follow prescriber protocol for cycling.', 30),
  ('nad-nasal', 'NAD+ Nasal Spray', 'Nicotinamide Adenine Dinucleotide', 'Wellness / Anti-Aging', 'candyrx', 'spray', 'nasal', 'Daily nasal spray per prescriber.', 31),
  ('sermorelin', 'Sermorelin', 'Sermorelin Acetate', 'Wellness / Anti-Aging', 'candyrx', 'mg', 'subq', 'GHRH peptide. Typically evening subcutaneous.', 32),
  ('ipamorelin-cjc', 'Ipamorelin / CJC-1295', 'Ipamorelin + CJC-1295', 'Wellness / Anti-Aging', 'candyrx', 'mg', 'subq', 'GH-releasing peptide blend. Follow prescriber cycle.', 33),
  ('bpc-157', 'BPC-157', 'BPC-157', 'Wellness / Anti-Aging', 'candyrx', 'mg', 'subq', 'Recovery peptide. Follow prescriber protocol.', 34),
  -- Sexual Health
  ('tadalafil', 'Tadalafil', 'Tadalafil', 'Sexual Health', 'candyrx', 'mg', 'oral', 'PDE5 inhibitor. Daily or as-needed per prescriber.', 40),
  ('sildenafil', 'Sildenafil', 'Sildenafil', 'Sexual Health', 'candyrx', 'mg', 'oral', 'PDE5 inhibitor. As-needed per prescriber.', 41),
  -- Hair Growth
  ('finasteride', 'Finasteride', 'Finasteride', 'Hair Growth', 'candyrx', 'mg', 'oral', 'Daily oral.', 50),
  ('minoxidil-oral', 'Oral Minoxidil', 'Minoxidil', 'Hair Growth', 'candyrx', 'mg', 'oral', 'Low-dose oral. Follow prescriber.', 51),
  ('minoxidil-topical', 'Topical Minoxidil', 'Minoxidil', 'Hair Growth', 'candyrx', 'ml', 'topical', 'Apply per prescriber instructions.', 52),
  -- Skincare
  ('tretinoin', 'Tretinoin', 'Tretinoin', 'Skincare', 'candyrx', 'ml', 'topical', 'Topical retinoid. Nightly per prescriber.', 60),
  -- Generic catch-alls
  ('custom-oral', 'Other Oral Medication', NULL, 'Other', 'generic', 'mg', 'oral', NULL, 90),
  ('custom-injection', 'Other Injection', NULL, 'Other', 'generic', 'ml', 'subq', NULL, 91),
  ('custom-supplement', 'Supplement', NULL, 'Other', 'generic', 'mg', 'oral', NULL, 92);
