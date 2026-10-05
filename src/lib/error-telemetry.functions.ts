import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceRateLimit } from "./rate-limit";

export const logClientError = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      message: z.string().min(1).max(2000),
      stack: z.string().max(8000).optional(),
      route: z.string().max(500).optional(),
      userAgent: z.string().max(500).optional(),
      appVersion: z.string().max(64).optional(),
      extra: z.record(z.string(), z.unknown()).optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    try {
      const request = getRequest();
      if (request) {
        const limited = enforceRateLimit(request, { id: "log_client_error", perMinute: 30 });
        if (limited) return { ok: false as const };
      }
      // user_id is intentionally null — this endpoint is unauthenticated and
      // accepting a client-supplied user id would allow spoofed attribution.
      await supabaseAdmin.from("client_errors").insert({
        user_id: null,
        message: data.message,
        stack: data.stack ?? null,
        route: data.route ?? null,
        user_agent: data.userAgent ?? null,
        app_version: data.appVersion ?? null,
        extra: (data.extra ?? null) as never,
      });
    } catch {
      // best-effort — never throw from telemetry
    }
    return { ok: true };
  });
