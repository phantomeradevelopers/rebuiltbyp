import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const restoreMyPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("restore_my_purchase");
    if (error) throw new Error(error.message);
    return { entitlement: (data as string | null) ?? "free" };
  });

export const redeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const code = (input as { code?: string })?.code?.trim().toUpperCase() ?? "";
    if (code.length < 4 || code.length > 32 || !/^[A-Z0-9-]+$/.test(code)) {
      throw new Error("Enter a valid code.");
    }
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: granted, error } = await (supabase.rpc as any)("redeem_code", { p_code: data.code });
    if (error) throw new Error(error.message || "Code is invalid or already used.");
    return { entitlement: granted as string };
  });
