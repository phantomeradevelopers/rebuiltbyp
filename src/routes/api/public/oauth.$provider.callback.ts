/**
 * OAuth callback for wearable providers.
 *
 * Flow:
 *  1. Provider redirects here with ?code=...&state=...
 *  2. We look up the stored oauth_states row (matches user_id, provider, code_verifier)
 *  3. Exchange code → tokens at the provider's token endpoint
 *  4. Upsert wearable_connections row
 *  5. Redirect the browser back to /app/account with a success/error flag
 *
 * Public route (no auth header — provider redirects the user's browser).
 * Security comes from the random `state` token bound to a single user.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PROVIDERS,
  isProvider,
  getProviderCredentials,
  callbackUrl,
} from "@/lib/wearables/providers.server";
import { wrapPublicHandler } from "@/lib/server-log";

function redirect(origin: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/app/account?${qs}` },
  });
}

export const Route = createFileRoute("/api/public/oauth/$provider/callback")({
  server: {
    handlers: {
      GET: wrapPublicHandler({ route: "oauth/callback", id: "oauth/callback", perMinute: 20 }, async ({ request, params }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const provider = params.provider;

        if (!isProvider(provider)) {
          return new Response("Unknown provider", { status: 404 });
        }
        const cfg = PROVIDERS[provider];

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errParam = url.searchParams.get("error");

        if (errParam) {
          return redirect(origin, { connect_error: errParam, provider });
        }
        if (!code || !state) {
          return redirect(origin, { connect_error: "missing_code", provider });
        }

        // Look up + consume the state row
        const { data: stateRow } = await supabaseAdmin
          .from("oauth_states")
          .select("user_id, provider, code_verifier, expires_at")
          .eq("state", state)
          .maybeSingle();

        if (!stateRow || stateRow.provider !== provider) {
          return redirect(origin, { connect_error: "invalid_state", provider });
        }
        if (new Date(stateRow.expires_at).getTime() < Date.now()) {
          return redirect(origin, { connect_error: "state_expired", provider });
        }
        // Consume (single-use)
        await supabaseAdmin.from("oauth_states").delete().eq("state", state);

        const creds = getProviderCredentials(cfg);
        if (!creds) {
          return redirect(origin, { connect_error: "provider_not_configured", provider });
        }

        // Exchange code → tokens
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl(origin, provider),
        });
        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        };
        if (cfg.tokenAuth === "basic") {
          headers.Authorization =
            "Basic " + Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
        } else {
          body.set("client_id", creds.clientId);
          body.set("client_secret", creds.clientSecret);
        }
        if (cfg.pkce && stateRow.code_verifier) {
          body.set("code_verifier", stateRow.code_verifier);
        }

        let tokenJson: {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          scope?: string;
          user_id?: string;
        };
        try {
          const res = await fetch(cfg.tokenUrl, { method: "POST", headers, body });
          const text = await res.text();
          if (!res.ok) {
            console.error(`[oauth/${provider}] token exchange failed`, res.status, text.slice(0, 300));
            return redirect(origin, { connect_error: "token_exchange_failed", provider });
          }
          tokenJson = JSON.parse(text);
        } catch (e) {
          console.error(`[oauth/${provider}] token exchange exception`, e);
          return redirect(origin, { connect_error: "token_exchange_error", provider });
        }

        if (!tokenJson.access_token) {
          return redirect(origin, { connect_error: "no_access_token", provider });
        }

        const expiresAt = tokenJson.expires_in
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null;
        const scopes = (tokenJson.scope ?? cfg.scopes.join(" ")).split(/[\s,]+/).filter(Boolean);

        await supabaseAdmin
          .from("wearable_connections")
          .upsert(
            {
              user_id: stateRow.user_id,
              provider,
              provider_user_id: tokenJson.user_id ?? null,
              access_token: tokenJson.access_token,
              refresh_token: tokenJson.refresh_token ?? null,
              token_expires_at: expiresAt,
              scopes,
              status: "active",
              last_error: null,
            },
            { onConflict: "user_id,provider" }
          );

        return redirect(origin, { connected: provider });
      }),
    },
  },
});
