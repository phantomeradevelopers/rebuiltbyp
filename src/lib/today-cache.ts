/**
 * Persisted snapshot for Today queries.
 *
 * Keeps the last-known shape of getToday / getTodayNutrition / etc. in
 * localStorage so cold opens of /app render the dashboard INSTANTLY from
 * the previous session's data, while fresh values hydrate in the background.
 *
 * SSR-safe (window-guarded). Best-effort — failures are silent.
 */

const PREFIX = "rebuilt.today-cache.v1";

function key(name: string, date: string): string {
  return `${PREFIX}:${name}:${date}`;
}

export function readSnapshot<T>(name: string, date: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key(name, date));
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeSnapshot<T>(name: string, date: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(name, date), JSON.stringify(value));
  } catch {
    // Quota / privacy mode — silent.
  }
}

/**
 * Returns a queryFn wrapper that writes successful responses to the cache,
 * and an `initialData` value to seed the query from cache on mount.
 */
export function persisted<T>(
  name: string,
  date: string,
  fetcher: () => Promise<T>,
): { queryFn: () => Promise<T>; initialData: T | undefined } {
  return {
    initialData: readSnapshot<T>(name, date),
    queryFn: async () => {
      const v = await fetcher();
      writeSnapshot(name, date, v);
      return v;
    },
  };
}
