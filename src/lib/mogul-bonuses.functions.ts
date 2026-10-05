import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_BONUSES, FREE_BONUS_SLUG } from "@/lib/mogul-bonuses";

/**
 * Mints a short-lived signed URL for a Mogul guide, but only for someone who
 * actually owns it: bought the bundle or the course, or holds a paid tier.
 * THE CODE is the free signup gift and is always allowed.
 */
export const getBonusDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(2).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const bonus = ALL_BONUSES.find((b) => b.slug === data.slug);
    if (!bonus) throw new Error("Guide not found.");

    if (bonus.slug !== FREE_BONUS_SLUG) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bought } = await (supabase.rpc as any)("has_purchase", {
        _user_id: userId,
        _product_key: "mogul_bundle",
      });

      let allowed = bought === true;
      if (!allowed) {
        const { data: profileRow } = await supabase
          .from("user_profile")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select("tier, entitlement" as any)
          .eq("user_id", userId)
          .maybeSingle();
        const p = (profileRow ?? {}) as Record<string, unknown>;
        allowed =
          p.entitlement === "lifetime" ||
          p.entitlement === "subscriber" ||
          p.tier === "pro" ||
          p.tier === "elite" ||
          p.tier === "lifetime_pro";
      }
      if (!allowed) {
        throw new Error(
          "This guide is part of the REBUILT Mogul Bundle. Grab the bundle to unlock it.",
        );
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("mogul-bonuses")
      .createSignedUrl(bonus.file, 60 * 10, { download: bonus.file });
    if (error || !signed?.signedUrl) {
      throw new Error("Could not open that guide. Try again.");
    }
    return { url: signed.signedUrl };
  });

/** True when the signed-in user bought the standalone $99 Mogul Bundle. */
export const hasMogulBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)("has_purchase", {
      _user_id: userId,
      _product_key: "mogul_bundle",
    });
    return { owned: data === true };
  });
