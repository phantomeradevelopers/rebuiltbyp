// Curated map of exercise name → instructional YouTube video.
// Names are normalized: lowercased, punctuation stripped, common suffixes removed.
// Fallback: a YouTube search URL so nothing is ever a dead end.

export type ExerciseInfo = {
  videoId: string | null;
  searchUrl: string;
  blurb: string;
};

// Trusted instructional channels (Jeff Nippard, Athlean-X, Squat University,
// Onnit, GMB, Yoga With Adriene, Concept2). Curated for clarity & form focus.
const LIBRARY: Record<string, { videoId: string | null; blurb: string }> = {
  // ─── Squat / lower body ───
  "back squat": { videoId: "ultWZbUMPL8", blurb: "Feet shoulder-width, brace, drive knees out, sit between hips." },
  "front squat": { videoId: "tlfahNdNPPI", blurb: "Elbows high, upright torso, full depth." },
  "goblet squat": { videoId: "MeIiIdhvXT4", blurb: "Hold the weight at chest, sink straight down." },
  "bulgarian split squat": { videoId: "2C-uNgKwPLE", blurb: "Long stance, front foot flat, knee tracks over toes." },
  "lunge": { videoId: "QOVaHwm-Q6U", blurb: "Step long, drop the back knee, drive through the front heel." },
  "reverse lunge": { videoId: "QOVaHwm-Q6U", blurb: "Step back, lower, drive through the front heel." },
  "walking lunge": { videoId: "L8fvypPrzzs", blurb: "Long step, knee taps, stay tall." },
  "step up": { videoId: "WCFCdxzFBa4", blurb: "Drive through the top foot. Don't push off the bottom." },
  "leg press": { videoId: "IZxyjW7MPJQ", blurb: "Full range, control the negative, knees track toes." },
  "leg extension": { videoId: "YyvSfVjQeL0", blurb: "Squeeze the quad at the top. Slow descent." },
  "leg curl": { videoId: "ELOCsoDSmrg", blurb: "Pull the heel under the bench, control the negative." },
  "calf raise": { videoId: "-M4-G8p8fmc", blurb: "Full stretch at the bottom, pause at the top." },

  // ─── Hinge / posterior chain ───
  "deadlift": { videoId: "op9kVnSso6Q", blurb: "Bar over mid-foot, brace hard, push the floor away." },
  "romanian deadlift": { videoId: "JCXUYuzwNrM", blurb: "Soft knees, hinge from the hips, bar stays close." },
  "rdl": { videoId: "JCXUYuzwNrM", blurb: "Soft knees, hinge from the hips, bar stays close." },
  "single leg rdl": { videoId: null, blurb: "Hinge from the hip, back leg in line with torso." },
  "hip thrust": { videoId: "LM8XHLYJoYs", blurb: "Tuck the chin, drive through the heels, squeeze the glutes." },
  "glute bridge": { videoId: "wPM8icPu6H8", blurb: "Posterior tilt, press through heels, hold at the top." },
  "good morning": { videoId: null, blurb: "Soft knees, hinge with a flat back." },
  "kettlebell swing": { videoId: "cKx8xE8jJZs", blurb: "Hinge, snap the hips, the bell floats — don't lift with the arms." },
  "kb swing": { videoId: "cKx8xE8jJZs", blurb: "Hinge, snap the hips, the bell floats." },
  "kettlebell deadlift": { videoId: null, blurb: "Hinge to the bell, flat back, drive up." },

  // ─── Push ───
  "bench press": { videoId: "vcBig73ojpE", blurb: "Feet planted, slight arch, bar to mid-chest, drive through the floor." },
  "incline bench press": { videoId: "DbFgADa2PL8", blurb: "30–45° angle, bar to upper chest." },
  "dumbbell bench press": { videoId: "VmB1G1K7v94", blurb: "Wrists stacked, bar path slightly arcs in." },
  "overhead press": { videoId: "2yjwXTZQDDI", blurb: "Tight glutes, bar over mid-foot at lockout." },
  "ohp": { videoId: "2yjwXTZQDDI", blurb: "Tight glutes, bar over mid-foot at lockout." },
  "shoulder press": { videoId: "2yjwXTZQDDI", blurb: "Press straight up, finish with biceps by ears." },
  "push up": { videoId: "IODxDxX7oi4", blurb: "Plank body, elbows ~45°, full lockout." },
  "pushup": { videoId: "IODxDxX7oi4", blurb: "Plank body, elbows ~45°, full lockout." },
  "dip": { videoId: "wjUmnZH528Y", blurb: "Lean slightly forward, control the descent." },
  "lateral raise": { videoId: "3VcKaXpzqRo", blurb: "Lead with elbows, stop at shoulder height." },
  "tricep extension": { videoId: "_gsUck-7M74", blurb: "Elbows in, full stretch, squeeze at lockout." },
  "tricep pushdown": { videoId: "2-LAMcpzODU", blurb: "Elbows pinned to ribs, full extension." },

  // ─── Pull ───
  "pull up": { videoId: "eGo4IYlbE5g", blurb: "Dead hang, chest to bar, control the negative." },
  "pullup": { videoId: "eGo4IYlbE5g", blurb: "Dead hang, chest to bar, control the negative." },
  "chin up": { videoId: "brhRXlOhsAM", blurb: "Underhand grip, full range, chin clears the bar." },
  "lat pulldown": { videoId: "CAwf7n6Luuc", blurb: "Pull to upper chest, squeeze the lats." },
  "barbell row": { videoId: "9efgcAjQe7E", blurb: "Hinge to 45°, pull to belly button, no jerking." },
  "bent over row": { videoId: "9efgcAjQe7E", blurb: "Hinge to 45°, pull to belly button." },
  "dumbbell row": { videoId: "pYcpY20QaE8", blurb: "Flat back, pull elbow past ribs, squeeze." },
  "seated cable row": { videoId: "GZbfZ033f74", blurb: "Sit tall, pull to ribs, full stretch on the return." },
  "face pull": { videoId: "rep-qVOkqgk", blurb: "Pull to the eyes, external rotation at the end." },
  "bicep curl": { videoId: "ykJmrZ5v0Oo", blurb: "Elbows pinned, full range, no swinging." },
  "hammer curl": { videoId: "zC3nLlEvin4", blurb: "Neutral grip, control the lower." },

  // ─── Core ───
  "plank": { videoId: "ASdvN_XEl_c", blurb: "Squeeze glutes & quads. Don't sag the hips." },
  "side plank": { videoId: "K2VljzCC16g", blurb: "Stack the hips, drive the bottom side up." },
  "hollow hold": { videoId: "LlDNef_Ztsc", blurb: "Lower back pressed flat, ribs down, arms by ears." },
  "dead bug": { videoId: "g_BYB0R-4Ws", blurb: "Lower back glued to the floor. Move slow." },
  "bird dog": { videoId: "wiFNA3sqjCA", blurb: "Reach long, square hips, brace the core." },
  "hanging leg raise": { videoId: "Pr1ieGZ5atk", blurb: "Posterior tilt, slow descent." },
  "russian twist": { videoId: "wkD8rjkodUI", blurb: "Tall chest, rotate from the ribs not the arms." },
  "ab wheel": { videoId: null, blurb: "Glutes tight, roll out only as far as you keep the back flat." },
  "mountain climber": { videoId: "kLh-uczlPLg", blurb: "Plank position, drive knees in, hips stay down." },

  // ─── Conditioning ───
  "burpee": { videoId: "qLBImHhCXSw", blurb: "Chest to floor, jump up, full extension." },
  "kettlebell snatch": { videoId: null, blurb: "One motion from the floor to overhead." },
  "kettlebell clean": { videoId: null, blurb: "Loop the bell into the rack — don't bang the wrist." },
  "turkish get up": { videoId: "0bWRPC49-KI", blurb: "Slow. Eyes on the bell. Earn the next position." },
  "jump rope": { videoId: "1BZM2Vre5oc", blurb: "Wrists turn the rope, light on the toes." },
  "rower": { videoId: "H0r_ZPXJLtg", blurb: "Legs → back → arms. Then arms → back → legs." },
  "rowing": { videoId: "H0r_ZPXJLtg", blurb: "Legs → back → arms. Then arms → back → legs." },
  "assault bike": { videoId: null, blurb: "Drive arms and legs together. Sit tall." },
  "box jump": { videoId: "52r_Ul5k03g", blurb: "Land soft, stand all the way up at the top." },
  "battle ropes": { videoId: null, blurb: "Stay low, alternate fast, keep the core tight." },
  "sled push": { videoId: null, blurb: "Low body angle, short fast steps." },
  "farmer carry": { videoId: null, blurb: "Tall posture, brace, walk smooth." },

  // ─── Mobility / recovery / yoga ───
  "sun salutation": { videoId: "73sjOu0g58M", blurb: "Move with the breath. No rush." },
  "yoga flow": { videoId: "v7AYKMP6rOE", blurb: "Breathe through every pose. 20 minutes." },
  "downward dog": { videoId: "j97SSGsnCAQ", blurb: "Hands shoulder-width, push the floor away, heels reach down." },
  "couch stretch": { videoId: null, blurb: "Squeeze the glute, tuck the pelvis. Two minutes per side." },
  "90 90 stretch": { videoId: null, blurb: "Both knees at 90°. Lean over the front leg." },
  "foam roll quads": { videoId: null, blurb: "Slow passes. Pause on the knots." },
  "foam roll back": { videoId: null, blurb: "Cross arms, lift hips slightly, roll mid-back." },
  "cat cow": { videoId: "kqnua4rHVVA", blurb: "Move with the breath: inhale arch, exhale round." },
  "hip flexor stretch": { videoId: null, blurb: "Tuck the pelvis, squeeze the back glute." },
  "thoracic mobility": { videoId: null, blurb: "Open the chest with each rotation." },

  // ─── Walking / cardio ───
  "walk": { videoId: "njeZ29umqVE", blurb: "Brisk pace. Nose breathing if you can hold it." },
  "walking": { videoId: "njeZ29umqVE", blurb: "Brisk pace. Nose breathing if you can hold it." },
  "incline walk": { videoId: "njeZ29umqVE", blurb: "Treadmill 10–12% incline, 3.0–3.5 mph." },
  "run": { videoId: null, blurb: "Land mid-foot under the hip. Tall posture." },
  "easy jog": { videoId: null, blurb: "Conversational pace. Nose breathing." },
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // strip trailing modifiers: "back squat 5x5" → "back squat"
    .replace(/\b(\d+x\d+|sets?|reps?|each|per side|left|right|heavy|light|slow|tempo)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function lookupExercise(name: string): ExerciseInfo {
  const n = normalize(name);
  const search = encodeURIComponent(`how to ${name} proper form`);
  const searchUrl = `https://www.youtube.com/results?search_query=${search}`;

  // Exact match
  if (LIBRARY[n]) return { videoId: LIBRARY[n].videoId, searchUrl, blurb: LIBRARY[n].blurb };

  // Substring match (longest key first)
  const keys = Object.keys(LIBRARY).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (n.includes(k) || k.includes(n)) {
      return { videoId: LIBRARY[k].videoId, searchUrl, blurb: LIBRARY[k].blurb };
    }
  }

  return { videoId: null, searchUrl, blurb: "" };
}

/**
 * Returns the single best YouTube URL for an exercise:
 *  - If we have a curated top-tier instructional video → deep link to that video.
 *  - Otherwise → YouTube search sorted by relevance (top result = most-viewed/best).
 * Always returns a working URL so the user is never stuck.
 */
export function getBestVideoUrl(name: string): string {
  const info = lookupExercise(name);
  return info.videoId
    ? `https://www.youtube.com/watch?v=${info.videoId}`
    : info.searchUrl;
}
