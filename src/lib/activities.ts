/** Shared activity/lifestyle/experience constants used by onboarding + plan generator. */

export const ACTIVITY_OPTIONS = [
  "Surf",
  "Hike",
  "Run",
  "Cycle",
  "Swim",
  "Yoga",
  "Pilates",
  "Climb",
  "Basketball",
  "Soccer",
  "Tennis",
  "Pickleball",
  "Boxing",
  "Martial arts",
  "Dance",
  "Skate",
  "Ski / Snowboard",
  "Walking",
  "Dog walking",
  "Golf",
  "Volleyball",
  "Treadmill",
  "Stationary bike",
  "Rowing",
] as const;

export type ActivityName = (typeof ACTIVITY_OPTIONS)[number];

export const EXPERIENCE_OPTIONS = [
  {
    value: "new",
    label: "New to lifting",
    sub: "Never really trained — we'll start gentle and build confidence.",
  },
  {
    value: "returning",
    label: "Getting back into it",
    sub: "You've trained before. We'll meet you where you are.",
  },
  {
    value: "intermediate",
    label: "Lifting for a while",
    sub: "1+ years consistent. We'll push without breaking you.",
  },
  {
    value: "advanced",
    label: "Advanced lifter",
    sub: "Multi-year lifter. We'll write something that actually challenges you.",
  },
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_OPTIONS)[number]["value"];

export const WORKOUT_STYLE_OPTIONS = [
  { value: "short_intense", label: "Short & intense", sub: "30–40 min, no wasted reps" },
  { value: "long_steady", label: "Long & steady", sub: "60+ min, classic splits" },
  { value: "varied", label: "Mix it up", sub: "Keep me guessing" },
  { value: "fun_first", label: "Whatever's fun", sub: "Circuits, games, novelty" },
] as const;

export type WorkoutStyle = (typeof WORKOUT_STYLE_OPTIONS)[number]["value"];
