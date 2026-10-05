export function safeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/app";
  if (!value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}
