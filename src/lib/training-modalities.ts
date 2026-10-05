// Curated catalog of training modalities the user can pick from each day,
// plus a deterministic session template per modality so the home screen can
// render a complete workout without hitting the AI gateway.

import type { DayPlan, DayExercise } from "@/lib/dashboard.functions";

export type ModalityCategory =
  | "strength"
  | "conditioning"
  | "cardio"
  | "mindbody"
  | "skill"
  | "recovery";

export type Modality = {
  id: string;
  label: string;
  category: ModalityCategory;
  equipment: string[];
  blurb: string;
};

export const MODALITY_CATEGORIES: { id: ModalityCategory; label: string; sub: string }[] = [
  { id: "strength",     label: "Strength",        sub: "Lift heavy. Build the body." },
  { id: "conditioning", label: "Conditioning",    sub: "Get your heart hammering." },
  { id: "cardio",       label: "Cardio",          sub: "Long, steady, repeatable." },
  { id: "mindbody",     label: "Mind-body",       sub: "Mobility, breath, calm." },
  { id: "skill",        label: "Skill / Sport",   sub: "Train a craft." },
  { id: "recovery",     label: "Recovery",        sub: "Less is more today." },
];

export const MODALITIES: Modality[] = [
  // Strength
  { id: "full_gym",        label: "Full gym",            category: "strength",     equipment: ["barbell", "rack", "dumbbells", "machines"], blurb: "Everything available" },
  { id: "home_gym",        label: "Home gym (barbell)",  category: "strength",     equipment: ["barbell", "rack"], blurb: "Barbell + rack" },
  { id: "dumbbells",       label: "Dumbbells only",      category: "strength",     equipment: ["dumbbells"], blurb: "A pair of DBs" },
  { id: "kettlebells",     label: "Kettlebells",         category: "strength",     equipment: ["kettlebell"], blurb: "One or two bells" },
  { id: "bodyweight",      label: "Bodyweight",          category: "strength",     equipment: [], blurb: "No equipment needed" },
  { id: "bands",           label: "Resistance bands",    category: "strength",     equipment: ["bands"], blurb: "Travel-friendly" },
  { id: "machines",        label: "Machines only",       category: "strength",     equipment: ["machines"], blurb: "Cable + selectorized" },

  // Conditioning
  { id: "hiit",            label: "HIIT",                category: "conditioning", equipment: [], blurb: "Short, brutal intervals" },
  { id: "metcon",          label: "Circuit / metcon",    category: "conditioning", equipment: ["dumbbells"], blurb: "Rounds for time" },
  { id: "sprints",         label: "Sprints",             category: "conditioning", equipment: [], blurb: "Track or hill" },
  { id: "rower",           label: "Rowing erg",          category: "conditioning", equipment: ["rower"], blurb: "Full-body cardio" },
  { id: "assault_bike",    label: "Assault bike",        category: "conditioning", equipment: ["bike"], blurb: "Lungs on fire" },
  { id: "jump_rope",       label: "Jump rope",           category: "conditioning", equipment: ["rope"], blurb: "Footwork + wind" },

  // Cardio
  { id: "easy_run",        label: "Easy run",            category: "cardio",       equipment: [], blurb: "Conversational pace" },
  { id: "long_run",        label: "Long run",            category: "cardio",       equipment: [], blurb: "Time on feet" },
  { id: "tempo_run",       label: "Tempo run",           category: "cardio",       equipment: [], blurb: "Comfortably hard" },
  { id: "cycle_road",      label: "Cycling (road)",      category: "cardio",       equipment: ["bike"], blurb: "Outdoor ride" },
  { id: "cycle_indoor",    label: "Cycling (indoor)",    category: "cardio",       equipment: ["bike"], blurb: "Spin / Peloton" },
  { id: "swim",            label: "Swimming",            category: "cardio",       equipment: ["pool"], blurb: "Low-impact cardio" },
  { id: "hike",            label: "Hiking",              category: "cardio",       equipment: [], blurb: "Trail miles" },
  { id: "incline_walk",    label: "Incline walk",        category: "cardio",       equipment: ["treadmill"], blurb: "12-3-30 style" },
  { id: "stair",           label: "Stair climber",       category: "cardio",       equipment: ["stair"], blurb: "Glute + lung burn" },

  // Mind-body
  { id: "yoga_vinyasa",    label: "Yoga (vinyasa)",      category: "mindbody",     equipment: ["mat"], blurb: "Flow + strength" },
  { id: "yoga_restorative",label: "Yoga (restorative)",  category: "mindbody",     equipment: ["mat"], blurb: "Long, calming holds" },
  { id: "pilates",         label: "Pilates / mat",       category: "mindbody",     equipment: ["mat"], blurb: "Core + control" },
  { id: "mobility",        label: "Mobility flow",       category: "mindbody",     equipment: [], blurb: "Joint by joint" },
  { id: "stretch",         label: "Stretching",          category: "mindbody",     equipment: [], blurb: "Long static holds" },
  { id: "breathwork",      label: "Breathwork",          category: "mindbody",     equipment: [], blurb: "Down-regulate" },

  // Skill / Sport
  { id: "boxing",          label: "Boxing",              category: "skill",        equipment: ["bag"], blurb: "Bag work + footwork" },
  { id: "mma",             label: "Kickboxing / MMA",    category: "skill",        equipment: [], blurb: "Striking practice" },
  { id: "climb",           label: "Climbing / bouldering", category: "skill",      equipment: ["wall"], blurb: "Grip + problem solving" },
  { id: "oly",             label: "Olympic lifting",     category: "skill",        equipment: ["barbell"], blurb: "Snatch + clean" },
  { id: "powerlifting",    label: "Powerlifting focus",  category: "skill",        equipment: ["barbell", "rack"], blurb: "SBD primary" },
  { id: "calisthenics",    label: "Calisthenics skills", category: "skill",        equipment: ["bar"], blurb: "Pull-up bar + floor" },
  { id: "dance",           label: "Dance / Zumba",       category: "skill",        equipment: [], blurb: "Move to music" },
  { id: "racquet",         label: "Tennis / pickleball", category: "skill",        equipment: ["racquet"], blurb: "Court session" },
  { id: "basketball",      label: "Basketball",          category: "skill",        equipment: ["ball"], blurb: "Shootaround or game" },
  { id: "soccer",          label: "Soccer",              category: "skill",        equipment: ["ball"], blurb: "Touch work or match" },
  { id: "golf",            label: "Golf practice",       category: "skill",        equipment: ["clubs"], blurb: "Range or course" },

  // Recovery
  { id: "active_recovery", label: "Active recovery walk", category: "recovery",    equipment: [], blurb: "20-40 min easy walk" },
  { id: "sauna",           label: "Sauna + walk",        category: "recovery",     equipment: ["sauna"], blurb: "Heat + movement" },
  { id: "foam_roll",       label: "Foam roll only",      category: "recovery",     equipment: ["roller"], blurb: "Tissue work" },
  { id: "rest",            label: "Full rest",           category: "recovery",     equipment: [], blurb: "Today is for rest" },
];

export function modalityById(id: string | null | undefined): Modality | null {
  if (!id) return null;
  return MODALITIES.find((m) => m.id === id) ?? null;
}

// --------- Session templates ---------

const TEMPLATES: Record<string, Omit<DayPlan, "day">> = {
  full_gym: {
    title: "Full gym push/pull/legs",
    type: "strength",
    exercises: [
      { name: "Barbell back squat", sets: 4, reps: "6-8", notes: "Add weight if last set is easy." },
      { name: "Bench press",        sets: 4, reps: "6-8", notes: "Pause briefly on the chest." },
      { name: "Barbell row",        sets: 3, reps: "8-10", notes: "Brace hard, no jerking." },
      { name: "Romanian deadlift",  sets: 3, reps: "8-10", notes: "Feel hamstrings, not lower back." },
      { name: "Overhead press",     sets: 3, reps: "6-8", notes: "Squeeze glutes, no leg drive." },
      { name: "Lat pulldown",       sets: 3, reps: "10-12", notes: "Drive elbows down." },
    ],
  },
  home_gym: {
    title: "Home gym barbell strength",
    type: "strength",
    exercises: [
      { name: "Back squat",        sets: 5, reps: "5", notes: "Heavy. Rest 2-3 min." },
      { name: "Bench press",       sets: 5, reps: "5", notes: "Tight upper back." },
      { name: "Barbell row",       sets: 3, reps: "8", notes: "Touch ribs each rep." },
      { name: "Romanian deadlift", sets: 3, reps: "8", notes: "Hinge, don't squat." },
    ],
  },
  dumbbells: {
    title: "Dumbbell full-body",
    type: "strength",
    exercises: [
      { name: "DB goblet squat",      sets: 4, reps: "10", notes: "Elbows tucked, chest tall." },
      { name: "DB bench press",       sets: 4, reps: "8-10", notes: "" },
      { name: "DB single-arm row",    sets: 3, reps: "10 each", notes: "" },
      { name: "DB RDL",               sets: 3, reps: "10", notes: "" },
      { name: "DB shoulder press",    sets: 3, reps: "8-10", notes: "" },
      { name: "DB curl + hammer",     sets: 2, reps: "10+10", notes: "Superset." },
    ],
  },
  kettlebells: {
    title: "Kettlebell complex",
    type: "strength",
    exercises: [
      { name: "KB swing",          sets: 5, reps: "20", notes: "Snap the hips." },
      { name: "KB goblet squat",   sets: 4, reps: "10", notes: "" },
      { name: "KB clean & press",  sets: 4, reps: "5 each", notes: "" },
      { name: "KB single-arm row", sets: 3, reps: "10 each", notes: "" },
      { name: "KB Turkish get-up", sets: 3, reps: "2 each", notes: "Slow + controlled." },
    ],
  },
  bodyweight: {
    title: "Bodyweight strength",
    type: "strength",
    exercises: [
      { name: "Push-up",                sets: 4, reps: "AMRAP", notes: "Stop 1 rep shy of failure." },
      { name: "Bulgarian split squat",  sets: 3, reps: "10 each", notes: "" },
      { name: "Inverted row (or door)", sets: 4, reps: "AMRAP", notes: "" },
      { name: "Glute bridge",           sets: 3, reps: "15", notes: "Pause at the top." },
      { name: "Plank",                  sets: 3, reps: "45 sec", notes: "" },
    ],
  },
  bands: {
    title: "Band full-body",
    type: "strength",
    exercises: [
      { name: "Band squat",        sets: 4, reps: "15", notes: "" },
      { name: "Band chest press",  sets: 4, reps: "12", notes: "" },
      { name: "Band row",          sets: 4, reps: "12", notes: "" },
      { name: "Band pull-apart",   sets: 3, reps: "15", notes: "" },
      { name: "Band glute bridge", sets: 3, reps: "15", notes: "" },
    ],
  },
  machines: {
    title: "Machine circuit",
    type: "strength",
    exercises: [
      { name: "Leg press",       sets: 4, reps: "10", notes: "" },
      { name: "Chest press",     sets: 4, reps: "10", notes: "" },
      { name: "Seated row",      sets: 4, reps: "10", notes: "" },
      { name: "Lat pulldown",    sets: 3, reps: "10", notes: "" },
      { name: "Leg curl",        sets: 3, reps: "12", notes: "" },
      { name: "Triceps pushdown",sets: 3, reps: "12", notes: "" },
    ],
  },

  hiit: {
    title: "HIIT — 20 min",
    type: "conditioning",
    exercises: [
      { name: "Warmup", sets: 1, reps: "3 min easy", notes: "Jog in place, arm circles." },
      { name: "Burpees",        sets: 8, reps: "30s on / 30s off", notes: "" },
      { name: "Mountain climbers", sets: 8, reps: "30s on / 30s off", notes: "Alternate with burpees." },
      { name: "Cooldown",      sets: 1, reps: "3 min walk", notes: "" },
    ],
  },
  metcon: {
    title: "Circuit metcon",
    type: "conditioning",
    exercises: [
      { name: "DB thrusters", sets: 5, reps: "10", notes: "5 rounds for time." },
      { name: "Push-ups",     sets: 5, reps: "15", notes: "" },
      { name: "Air squats",   sets: 5, reps: "20", notes: "" },
      { name: "Plank",        sets: 5, reps: "30s", notes: "" },
    ],
  },
  sprints: {
    title: "Sprint intervals",
    type: "conditioning",
    exercises: [
      { name: "Warmup jog",  sets: 1, reps: "5 min", notes: "Build to 70%." },
      { name: "Strides",     sets: 4, reps: "50m", notes: "Build, don't max." },
      { name: "Sprint",      sets: 8, reps: "100m @ 90%", notes: "Full recovery between." },
      { name: "Cooldown",    sets: 1, reps: "5 min walk", notes: "" },
    ],
  },
  rower: { title: "Rower intervals", type: "conditioning", exercises: [
    { name: "Warmup row",      sets: 1, reps: "5 min easy", notes: "" },
    { name: "500m intervals",  sets: 6, reps: "500m hard / 1 min rest", notes: "Hold consistent splits." },
    { name: "Cooldown",        sets: 1, reps: "3 min easy", notes: "" },
  ]},
  assault_bike: { title: "Assault bike intervals", type: "conditioning", exercises: [
    { name: "Warmup",       sets: 1, reps: "5 min easy", notes: "" },
    { name: "30s on / 30s off", sets: 10, reps: "All-out / easy", notes: "" },
    { name: "Cooldown",     sets: 1, reps: "3 min easy", notes: "" },
  ]},
  jump_rope: { title: "Jump rope conditioning", type: "conditioning", exercises: [
    { name: "Singles",      sets: 5, reps: "2 min", notes: "30s rest between rounds." },
    { name: "Double-unders / fast singles", sets: 5, reps: "1 min", notes: "" },
  ]},

  easy_run:  { title: "Easy run",  type: "cardio", exercises: [{ name: "Easy continuous run", sets: 1, reps: "30-40 min", notes: "Conversational pace." }] },
  long_run:  { title: "Long run",  type: "cardio", exercises: [{ name: "Long steady run", sets: 1, reps: "60-90 min", notes: "Slow on purpose. Fuel + hydrate." }] },
  tempo_run: { title: "Tempo run", type: "cardio", exercises: [
    { name: "Warmup",      sets: 1, reps: "10 min easy", notes: "" },
    { name: "Tempo",       sets: 1, reps: "20 min", notes: "Comfortably hard, ~80%." },
    { name: "Cooldown",    sets: 1, reps: "10 min easy", notes: "" },
  ]},
  cycle_road:   { title: "Road cycling",   type: "cardio", exercises: [{ name: "Steady ride", sets: 1, reps: "60-90 min", notes: "Zone 2." }] },
  cycle_indoor: { title: "Indoor cycling", type: "cardio", exercises: [
    { name: "Warmup",      sets: 1, reps: "5 min", notes: "" },
    { name: "Intervals",   sets: 5, reps: "3 min hard / 2 min easy", notes: "" },
    { name: "Cooldown",    sets: 1, reps: "5 min easy", notes: "" },
  ]},
  swim:        { title: "Swim",          type: "cardio", exercises: [{ name: "Continuous swim", sets: 1, reps: "30 min", notes: "Mix freestyle + breast." }] },
  hike:        { title: "Hike",          type: "cardio", exercises: [{ name: "Trail hike",      sets: 1, reps: "60+ min", notes: "Bring water + snacks." }] },
  incline_walk:{ title: "Incline walk",  type: "cardio", exercises: [{ name: "12 incline / 3.0 mph", sets: 1, reps: "30 min", notes: "12-3-30 style." }] },
  stair:       { title: "Stair climber", type: "cardio", exercises: [{ name: "Stairs",         sets: 1, reps: "25-30 min", notes: "Keep posture tall, no leaning." }] },

  yoga_vinyasa: { title: "Vinyasa flow", type: "mobility", exercises: [
    { name: "Sun salutations", sets: 5, reps: "rounds", notes: "Move with breath." },
    { name: "Warrior flow",    sets: 3, reps: "each side", notes: "" },
    { name: "Balance series",  sets: 1, reps: "tree, half-moon", notes: "" },
    { name: "Closing rest",    sets: 1, reps: "5 min savasana", notes: "" },
  ]},
  yoga_restorative: { title: "Restorative yoga", type: "mobility", exercises: [
    { name: "Child's pose",        sets: 1, reps: "3 min", notes: "" },
    { name: "Supine twist",        sets: 1, reps: "3 min each", notes: "" },
    { name: "Legs up the wall",    sets: 1, reps: "8 min", notes: "" },
    { name: "Savasana",            sets: 1, reps: "10 min", notes: "" },
  ]},
  pilates: { title: "Pilates mat", type: "mobility", exercises: [
    { name: "The hundred",    sets: 1, reps: "100 beats", notes: "" },
    { name: "Roll-up",        sets: 2, reps: "8", notes: "" },
    { name: "Single-leg circle", sets: 2, reps: "8 each", notes: "" },
    { name: "Teaser",         sets: 2, reps: "5", notes: "" },
    { name: "Side-lying leg series", sets: 2, reps: "10 each", notes: "" },
  ]},
  mobility:  { title: "Mobility flow", type: "mobility", exercises: [
    { name: "Cat-cow",            sets: 2, reps: "10", notes: "" },
    { name: "World's greatest stretch", sets: 2, reps: "5 each", notes: "" },
    { name: "90/90 hip switches", sets: 2, reps: "10", notes: "" },
    { name: "Thoracic openers",   sets: 2, reps: "10", notes: "" },
  ]},
  stretch:   { title: "Stretching", type: "mobility", exercises: [
    { name: "Hamstring stretch",  sets: 2, reps: "60s each", notes: "" },
    { name: "Hip flexor stretch", sets: 2, reps: "60s each", notes: "" },
    { name: "Pec doorway stretch",sets: 2, reps: "60s each", notes: "" },
    { name: "Pigeon pose",        sets: 2, reps: "60s each", notes: "" },
  ]},
  breathwork:{ title: "Breathwork", type: "mobility", exercises: [
    { name: "Box breathing",      sets: 1, reps: "5 min · 4-4-4-4", notes: "" },
    { name: "Physiological sigh", sets: 1, reps: "5 min", notes: "Two inhales, long exhale." },
  ]},

  boxing:    { title: "Boxing session", type: "skill", exercises: [
    { name: "Shadow box",  sets: 3, reps: "3 min", notes: "Focus on footwork." },
    { name: "Bag work",    sets: 5, reps: "3 min", notes: "1 min rest between." },
    { name: "Core finisher", sets: 3, reps: "1 min", notes: "Plank + Russian twists." },
  ]},
  mma: { title: "Striking practice", type: "skill", exercises: [
    { name: "Shadow boxing",   sets: 4, reps: "3 min", notes: "Combinations + footwork." },
    { name: "Kick technique",  sets: 4, reps: "10 each leg", notes: "" },
    { name: "Sprawls",         sets: 4, reps: "30s", notes: "" },
  ]},
  climb: { title: "Climbing session", type: "skill", exercises: [
    { name: "Warmup easy routes", sets: 1, reps: "15 min", notes: "" },
    { name: "Project attempts",   sets: 4, reps: "2-3 attempts", notes: "Rest fully between." },
    { name: "Cool-down volume",   sets: 1, reps: "15 min easy", notes: "" },
  ]},
  oly: { title: "Olympic lifting", type: "skill", exercises: [
    { name: "Snatch warmup complex", sets: 3, reps: "1+1+1", notes: "Empty bar to working." },
    { name: "Power snatch",          sets: 5, reps: "2", notes: "Build to a top double." },
    { name: "Clean & jerk",          sets: 5, reps: "1+1", notes: "" },
    { name: "Front squat",           sets: 3, reps: "3", notes: "" },
  ]},
  powerlifting: { title: "Powerlifting day", type: "strength", exercises: [
    { name: "Squat",   sets: 5, reps: "3 @ RPE 8", notes: "" },
    { name: "Bench",   sets: 5, reps: "3 @ RPE 8", notes: "" },
    { name: "Deadlift",sets: 3, reps: "3 @ RPE 8", notes: "" },
    { name: "Accessory: row", sets: 3, reps: "10", notes: "" },
  ]},
  calisthenics: { title: "Calisthenics skills", type: "skill", exercises: [
    { name: "Pull-up progression", sets: 5, reps: "5", notes: "" },
    { name: "Dip progression",     sets: 5, reps: "5", notes: "" },
    { name: "L-sit hold",          sets: 4, reps: "20s", notes: "" },
    { name: "Pistol squat work",   sets: 3, reps: "5 each", notes: "" },
  ]},
  dance:     { title: "Dance / Zumba",      type: "cardio", exercises: [{ name: "Follow-along class", sets: 1, reps: "45 min", notes: "Have fun." }] },
  racquet:   { title: "Racquet sport",      type: "skill",  exercises: [{ name: "Match or rally play", sets: 1, reps: "60 min", notes: "" }] },
  basketball:{ title: "Basketball",         type: "skill",  exercises: [
    { name: "Shooting drills", sets: 1, reps: "20 min", notes: "" },
    { name: "Pickup game",     sets: 1, reps: "as long as legs hold", notes: "" },
  ]},
  soccer:    { title: "Soccer",             type: "skill",  exercises: [{ name: "Touches, drills, or match", sets: 1, reps: "60-90 min", notes: "" }] },
  golf:      { title: "Golf practice",      type: "skill",  exercises: [
    { name: "Short game",  sets: 1, reps: "20 min", notes: "" },
    { name: "Range balls", sets: 1, reps: "40 min", notes: "" },
  ]},

  active_recovery: { title: "Active recovery walk", type: "recovery", exercises: [{ name: "Easy walk", sets: 1, reps: "20-40 min", notes: "Outdoors if you can." }] },
  sauna:    { title: "Sauna + walk",   type: "recovery", exercises: [
    { name: "Walk",  sets: 1, reps: "20 min easy", notes: "" },
    { name: "Sauna", sets: 3, reps: "15 min", notes: "Hydrate between." },
  ]},
  foam_roll:{ title: "Foam roll session", type: "recovery", exercises: [
    { name: "Quads",       sets: 1, reps: "60s each", notes: "" },
    { name: "Glutes",      sets: 1, reps: "60s each", notes: "" },
    { name: "Lats / T-spine", sets: 1, reps: "60s each", notes: "" },
    { name: "Calves",      sets: 1, reps: "60s each", notes: "" },
  ]},
  rest:     { title: "Full rest", type: "recovery", exercises: [] },
};

export function sessionFor(modalityId: string, dayNumber = 1): DayPlan | null {
  const t = TEMPLATES[modalityId];
  if (!t) return null;
  return { day: dayNumber, ...t };
}

export function exercisesFor(modalityId: string): DayExercise[] {
  return TEMPLATES[modalityId]?.exercises ?? [];
}
