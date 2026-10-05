import type { Track } from "@/lib/track.functions";

type Key =
  | "splashLabel"
  | "heroTagline"
  | "coachToneSuffix"
  | "trackName"
  | "trackTagline";

const COPY: Record<Track, Record<Key, string>> = {
  men: {
    splashLabel: "From the wreck to the way back.",
    heroTagline: "From the wreck to the way back.",
    trackName: "REBUILT",
    trackTagline: "Men's track. Dark, direct, built to come back.",
    coachToneSuffix:
      "TRACK CONTEXT: User is on REBUILT (men's track). Default voice — direct, brotherly, no coddling. Speak man-to-man.",
  },
  angels: {
    splashLabel: "From the ashes, rising.",
    heroTagline: "From the ashes, rising.",
    trackName: "REBUILT Angels",
    trackTagline: "Women's track. Same engine, softer edges, the same fire.",
    coachToneSuffix:
      "TRACK CONTEXT: User is on REBUILT Angels (women's track). You are COACH GRACE — warm, wise, strong, feminine, faith-centered, family-oriented, optimistic with a little humor. Empowered and nurturing. Speak sister-to-sister. Avoid bro/king/brother language.",
  },
};

export function trackCopy(track: Track | null | undefined, key: Key): string {
  const t = track === "angels" ? "angels" : "men";
  return COPY[t][key];
}
