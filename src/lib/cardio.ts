/**
 * Pure decision helper: given a user's lifestyle prefs and today's session
 * minutes, return one or more cardio blocks to recommend.
 *
 * Used by the Outdoor page (header + ordering) and the Plan/Today views
 * (replaces hardcoded "30 min cardio" strings with lifestyle-aware copy).
 */

import type {
  CardioPreference,
  NaturePreference,
  OutdoorPrefs,
} from "./outdoor.functions";

export type CardioBlock = {
  key: string;
  /** UI label, e.g. "Morning dog walk" or "Treadmill — Zone 2" */
  label: string;
  /** Short helper text, e.g. "Easy pace, 20 minutes" */
  sub: string;
  minutes: number;
  /** What activity to do. */
  kind: "dog_walk" | "outdoor_loop" | "outdoor_walk" | "treadmill" | "rest";
  /** Time-of-day hint (for split sessions) — undefined means anytime. */
  when?: "am" | "pm";
};

export type CardioPlan = {
  blocks: CardioBlock[];
  /** One-line summary describing the recommended cardio shape for the day. */
  summary: string;
  /** Whether at least one block requires being outdoors. */
  needsOutdoor: boolean;
};

const DEFAULT_MIN = 20;
const MIN_BLOCK = 10;

function blocksForDog(totalMinutes: number, intensity: "easy" | "split"): CardioBlock[] {
  if (intensity === "split") {
    const per = Math.max(MIN_BLOCK, Math.round(totalMinutes / 2));
    return [
      {
        key: "dog_am",
        kind: "dog_walk",
        label: "Morning dog walk",
        sub: `Easy pace · ${per} min`,
        minutes: per,
        when: "am",
      },
      {
        key: "dog_pm",
        kind: "dog_walk",
        label: "Evening dog walk",
        sub: `Easy pace · ${per} min`,
        minutes: per,
        when: "pm",
      },
    ];
  }
  return [
    {
      key: "dog_solo",
      kind: "dog_walk",
      label: "Dog walk",
      sub: `Easy pace · ${totalMinutes} min`,
      minutes: totalMinutes,
    },
  ];
}

/**
 * Build today's cardio prescription. `sessionMinutes` is the user's
 * onboarding-declared session length (or null for default).
 */
export function getCardioPrescription(
  prefs: OutdoorPrefs,
  sessionMinutes?: number | null,
): CardioPlan {
  const total = Math.max(MIN_BLOCK, sessionMinutes ?? DEFAULT_MIN);
  const cp: CardioPreference = prefs.cardio_preference ?? "outdoor";
  const nature: NaturePreference = prefs.nature_preference ?? "neutral";
  const hasDog = prefs.has_dog;

  if (cp === "none") {
    return {
      blocks: [
        {
          key: "rest",
          kind: "rest",
          label: "Rest day cardio",
          sub: "Optional light walk if you feel like it.",
          minutes: 0,
        },
      ],
      summary: "Cardio is off today — focus on training and recovery.",
      needsOutdoor: false,
    };
  }

  if (cp === "treadmill") {
    return {
      blocks: [
        {
          key: "treadmill",
          kind: "treadmill",
          label: "Treadmill — Zone 2",
          sub: `${total} min · steady, conversational pace`,
          minutes: total,
        },
      ],
      summary: `${total} min treadmill, Zone 2.`,
      needsOutdoor: false,
    };
  }

  if (cp === "mix") {
    // Half outdoor, half treadmill — or if dog, split the outdoor half across AM/PM.
    const outdoorMin = Math.round(total / 2);
    const treadMin = total - outdoorMin;
    const outdoorBlock: CardioBlock = hasDog
      ? {
          key: "dog_am",
          kind: "dog_walk",
          label: "Morning dog walk",
          sub: `Easy pace · ${outdoorMin} min`,
          minutes: outdoorMin,
          when: "am",
        }
      : {
          key: "outdoor_am",
          kind: nature === "prefers_urban" ? "outdoor_walk" : "outdoor_loop",
          label: nature === "prefers_urban" ? "Morning walk" : "Outdoor loop",
          sub: `Easy pace · ${outdoorMin} min`,
          minutes: outdoorMin,
          when: "am",
        };
    return {
      blocks: [
        outdoorBlock,
        {
          key: "tread_pm",
          kind: "treadmill",
          label: "Treadmill finisher",
          sub: `${treadMin} min · Zone 2`,
          minutes: treadMin,
          when: "pm",
        },
      ],
      summary: hasDog
        ? `Dog walk this morning, ${treadMin} min treadmill later.`
        : `${outdoorMin} min outside, ${treadMin} min treadmill.`,
      needsOutdoor: true,
    };
  }

  // cp === "outdoor"
  if (hasDog) {
    const blocks = blocksForDog(total, "split");
    return {
      blocks,
      summary: `Two short dog walks today (${blocks[0].minutes} min × 2).`,
      needsOutdoor: true,
    };
  }

  return {
    blocks: [
      {
        key: "outdoor",
        kind: nature === "prefers_urban" ? "outdoor_walk" : "outdoor_loop",
        label: nature === "loves_nature" ? "Outdoor loop / trail" : "Outdoor loop",
        sub: `${total} min · steady pace`,
        minutes: total,
      },
    ],
    summary: `${total} min outside.`,
    needsOutdoor: true,
  };
}
