/**
 * Provider registry for wearable OAuth integrations.
 *
 * Server-only — never import from a route component or hook.
 */

export type ProviderId = "google_fit" | "oura" | "whoop";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** PKCE required */
  pkce: boolean;
  /** "basic" auth header on token exchange, or credentials in body */
  tokenAuth: "basic" | "body";
  /** Extra params appended to the authorize URL (e.g. Google offline access) */
  extraAuthParams?: Record<string, string>;
};

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  google_fit: {
    id: "google_fit",
    label: "Google Health",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.heart_rate.read",
      "https://www.googleapis.com/auth/fitness.sleep.read",
      "https://www.googleapis.com/auth/fitness.body.read",
    ],
    clientIdEnv: "GOOGLE_FIT_CLIENT_ID",
    clientSecretEnv: "GOOGLE_FIT_CLIENT_SECRET",
    pkce: true,
    tokenAuth: "body",
    extraAuthParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
  oura: {
    id: "oura",
    label: "Oura",
    authorizeUrl: "https://cloud.ouraring.com/oauth/authorize",
    tokenUrl: "https://api.ouraring.com/oauth/token",
    scopes: ["daily", "heartrate", "personal"],
    clientIdEnv: "OURA_CLIENT_ID",
    clientSecretEnv: "OURA_CLIENT_SECRET",
    pkce: false,
    tokenAuth: "body",
  },
  whoop: {
    id: "whoop",
    label: "Whoop",
    authorizeUrl: "https://api.prod.whoop.com/oauth/oauth2/auth",
    tokenUrl: "https://api.prod.whoop.com/oauth/oauth2/token",
    scopes: ["read:recovery", "read:sleep", "read:workout", "read:profile", "offline"],
    clientIdEnv: "WHOOP_CLIENT_ID",
    clientSecretEnv: "WHOOP_CLIENT_SECRET",
    pkce: false,
    tokenAuth: "basic",
  },
};

export function isProvider(value: string): value is ProviderId {
  return value === "google_fit" || value === "oura" || value === "whoop";
}

export function getProviderCredentials(p: ProviderConfig): { clientId: string; clientSecret: string } | null {
  const clientId = process.env[p.clientIdEnv];
  const clientSecret = process.env[p.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Absolute callback URL used in both authorize + token requests. */
export function callbackUrl(origin: string, providerId: ProviderId): string {
  return `${origin}/api/public/oauth/${providerId}/callback`;
}
