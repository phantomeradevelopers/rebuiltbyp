/**
 * Server functions for the wearable connect flow.
 *
 * Browser → startConnect(provider) → returns authorizeUrl
 *        → window.location = authorizeUrl
 *        → provider → /api/public/oauth/{provider}/callback (TanStack server route)
 *        → callback redirects browser to /app/account?connected={provider}
 *
 * listConnections / disconnect are simple CRUD wrappers used by the
 * Connected Apps settings UI.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PROVIDERS,
  isProvider,
  getProviderCredentials,
  callbackUrl,
  type ProviderId,
} from "./providers.server";

export type WearableConnectionRow = {
  provider: ProviderId;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
};

function b64url(input: Buffer): string {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export const startWearableConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      provider: z.enum(["google_fit", "oura", "whoop"]),
      origin: z.string().url(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const provider = data.provider as ProviderId;
    const cfg = PROVIDERS[provider];

    const creds = getProviderCredentials(cfg);
    if (!creds) {
      throw new Error(
        `${cfg.label} isn't configured yet. Add ${cfg.clientIdEnv} and ${cfg.clientSecretEnv} in project secrets.`
      );
    }

    const state = b64url(randomBytes(24));
    let codeVerifier: string | null = null;
    let codeChallenge: string | null = null;
    if (cfg.pkce) {
      codeVerifier = b64url(randomBytes(48));
      codeChallenge = b64url(createHash("sha256").update(codeVerifier).digest());
    }

    await supabaseAdmin.from("oauth_states").insert({
      state,
      user_id: userId,
      provider,
      code_verifier: codeVerifier,
      return_to: "/app/account",
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: creds.clientId,
      scope: cfg.scopes.join(" "),
      redirect_uri: callbackUrl(data.origin, provider),
      state,
    });
    if (codeChallenge) {
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", "S256");
    }
    if (cfg.extraAuthParams) {
      for (const [k, v] of Object.entries(cfg.extraAuthParams)) params.set(k, v);
    }

    return { authorizeUrl: `${cfg.authorizeUrl}?${params.toString()}` };
  });

export const listWearableConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WearableConnectionRow[]> => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("wearable_connections")
      .select("provider, status, last_synced_at, last_error, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    return (data ?? []) as WearableConnectionRow[];
  });

export const disconnectWearable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.enum(["google_fit", "oura", "whoop"]) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("wearable_connections")
      .delete()
      .eq("user_id", userId)
      .eq("provider", data.provider);
    if (error) throw new Error("Couldn't disconnect.");
    return { ok: true as const };
  });

export { isProvider };
