import { getCookie, setCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const COOKIE = "rb_admin_session";
const SESSION_HOURS = 8;
/** 5th wrong attempt starts a 15-minute timed lock. */
const TIMED_LOCK_AT = 5;
/** 10th wrong attempt in total locks the console permanently. */
const PERMANENT_LOCK_AT = 10;
const LOCKOUT_MINUTES = 15;

// Local dev runs over plain http, where a Secure cookie would be dropped.
function secureCookie() {
  // Local dev serves plain http, where a Secure cookie would be dropped.
  return process.env["NODE_ENV"] === "production";
}

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

function secret() {
  const s = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!s) throw new Error("Admin console is not configured on this server.");
  return s;
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

export function normalizePin(pin: unknown): string {
  const s = String(pin ?? "").trim();
  if (!/^\d{6}$/.test(s)) throw new Error("PIN must be exactly 6 digits.");
  return s;
}

type PinRow = {
  pin_hash: string | null;
  salt: string | null;
  failed_attempts: number;
  locked_until: string | null;
};

async function readRow(): Promise<PinRow> {
  const { data, error } = await supabaseAdmin
    .from("admin_pin")
    .select("pin_hash, salt, failed_attempts, locked_until")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    await supabaseAdmin.from("admin_pin").insert({ id: 1 });
    return { pin_hash: null, salt: null, failed_attempts: 0, locked_until: null };
  }
  return data as PinRow;
}

async function issueSession() {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const payload = `admin.${exp}`;
  const token = `${payload}.${await sign(payload)}`;
  setCookie(COOKIE, token, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearSession() {
  setCookie(COOKIE, "", { httpOnly: true, secure: secureCookie(), sameSite: "lax", path: "/", maxAge: 0 });
}

export async function hasAdminSession(): Promise<boolean> {
  const token = getCookie(COOKIE);
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [prefix, expRaw, sig] = parts;
  if (prefix !== "admin") return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return timingSafeEqual(sig!, await sign(`admin.${expRaw}`));
}

/** Server-side gate for every admin read and write. */
export async function requireAdminPin(): Promise<void> {
  if (!(await hasAdminSession())) throw new Error("Admin sign-in required.");
}

export async function pinStatus() {
  const row = await readRow();
  const attempts = row.failed_attempts ?? 0;
  const lockedUntil = row.locked_until ? new Date(row.locked_until).getTime() : 0;
  return {
    configured: Boolean(row.pin_hash),
    authed: await hasAdminSession(),
    lockedUntil: lockedUntil > Date.now() ? lockedUntil : null,
    attempts,
    attemptsLeft: Math.max(0, PERMANENT_LOCK_AT - attempts),
    permanentlyLocked: attempts >= PERMANENT_LOCK_AT,
  };
}

export async function setupPin(pinRaw: unknown) {
  const pin = normalizePin(pinRaw);
  const row = await readRow();
  if ((row.failed_attempts ?? 0) >= PERMANENT_LOCK_AT) {
    throw new Error("This console is permanently locked. Only the owner can restore access from the backend.");
  }
  // Idempotent: if a PIN is already stored and the submitted code matches it,
  // treat this as a sign-in instead of demanding a "current PIN" the operator
  // was never asked for. This covers the case where the setup screen was
  // rendered from stale status while the database already held a PIN.
  if (row.pin_hash && row.salt) {
    const existing = await pbkdf2(pin, row.salt);
    if (timingSafeEqual(existing, row.pin_hash)) {
      await supabaseAdmin
        .from("admin_pin")
        .update({ failed_attempts: 0, locked_until: null })
        .eq("id", 1);
      await issueSession();
      return { ok: true as const };
    }
    // Wrong code against an existing PIN: fall through to the normal sign-in
    // path so this counts as a failed attempt. Otherwise the setup screen
    // would be an unlimited, lock-free way to guess the code.
    return loginWithPin(pin);

  }
  const salt = crypto.randomUUID();
  const hash = await pbkdf2(pin, salt);
  const { error } = await supabaseAdmin
    .from("admin_pin")
    .update({ pin_hash: hash, salt, failed_attempts: 0, locked_until: null })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  await issueSession();
  return { ok: true as const };
}


export async function loginWithPin(pinRaw: unknown) {
  const pin = normalizePin(pinRaw);
  const row = await readRow();
  if ((row.failed_attempts ?? 0) >= PERMANENT_LOCK_AT) {
    throw new Error("This console is permanently locked. Only the owner can restore access from the backend.");
  }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000);
    throw new Error(`Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  if (!row.pin_hash || !row.salt) throw new Error("No PIN has been set yet.");

  const hash = await pbkdf2(pin, row.salt);
  if (!timingSafeEqual(hash, row.pin_hash)) {
    // The counter is cumulative and lives only in the database: it never resets
    // when a timed lock expires, and clearing the browser cannot touch it.
    const attempts = (row.failed_attempts ?? 0) + 1;
    const permanent = attempts >= PERMANENT_LOCK_AT;
    const timed = !permanent && attempts === TIMED_LOCK_AT;
    await supabaseAdmin
      .from("admin_pin")
      .update({
        failed_attempts: attempts,
        locked_until: timed ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : null,
      })
      .eq("id", 1);
    if (permanent) {
      throw new Error("This console is permanently locked. Only the owner can restore access from the backend.");
    }
    if (timed) {
      throw new Error(`Too many wrong attempts. Locked for ${LOCKOUT_MINUTES} minutes.`);
    }
    const left = (attempts < TIMED_LOCK_AT ? TIMED_LOCK_AT : PERMANENT_LOCK_AT) - attempts;
    const consequence = attempts < TIMED_LOCK_AT ? "a 15-minute lock" : "a permanent lock";
    throw new Error(`Wrong code. ${left} attempt${left === 1 ? "" : "s"} left before ${consequence}.`);
  }

  await supabaseAdmin.from("admin_pin").update({ failed_attempts: 0, locked_until: null }).eq("id", 1);
  await issueSession();
  return { ok: true as const };
}


export async function changePin(currentRaw: unknown, nextRaw: unknown) {
  await requireAdminPin();
  const current = normalizePin(currentRaw);
  const next = normalizePin(nextRaw);
  const row = await readRow();
  if (!row.pin_hash || !row.salt) throw new Error("No PIN has been set yet.");
  const hash = await pbkdf2(current, row.salt);
  if (!timingSafeEqual(hash, row.pin_hash)) throw new Error("Current PIN is wrong.");
  const salt = crypto.randomUUID();
  const { error } = await supabaseAdmin
    .from("admin_pin")
    .update({ pin_hash: await pbkdf2(next, salt), salt, failed_attempts: 0, locked_until: null })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
