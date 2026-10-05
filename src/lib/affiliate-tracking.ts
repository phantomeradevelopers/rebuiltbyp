import { supabase } from "@/integrations/supabase/client";

export type AffiliatePartner = "candyrx" | "youthfullab";

/**
 * Fire-and-forget affiliate click logger. Records who clicked which partner
 * from which surface so the operator dashboard can show conversion-by-source.
 * Silent on failure — analytics must never block the outbound link.
 *
 * Demo accounts (no session) and signed-out users are skipped client-side;
 * the RLS policy also enforces `auth.uid() = user_id` server-side.
 */
export async function trackAffiliateClick(
  partner: AffiliatePartner,
  surface: string,
  url?: string,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;
    await supabase.from("affiliate_clicks").insert({
      user_id: uid,
      partner,
      surface,
      url: url ?? null,
    });
  } catch {
    /* swallow — analytics is never load-bearing */
  }
}
