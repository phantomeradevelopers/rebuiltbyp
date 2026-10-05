// Deterministic motivational copy for gym entry, dwell, and exit moments.
// All messages are second-person, present-tense, no shame, max one symbol.

export type EntryContext = {
  isFirstEver: boolean;
  isFirstOfWeek: boolean;
  daysSinceLast: number | null; // null = no prior visit
  streakDays: number; // consecutive calendar days with a visit
  visitsThisWeek: number;
};

export type EntryCopy = {
  title: string;
  body: string;
  tag: string;
};

export function entryMessage(ctx: EntryContext): EntryCopy {
  if (ctx.isFirstEver) {
    return {
      title: "You walked in.",
      body: "That's the rep that counts. Today's session or freelance?",
      tag: "gym-first-ever",
    };
  }
  if (ctx.daysSinceLast !== null && ctx.daysSinceLast >= 7) {
    return {
      title: "Back in.",
      body: "Forget the gap — today's the new day one. Today's session or freelance?",
      tag: "gym-return",
    };
  }
  if (ctx.streakDays >= 3) {
    return {
      title: `Day ${ctx.streakDays} in a row.`,
      body: "You're stacking. Today's session or freelance?",
      tag: "gym-streak",
    };
  }
  if (ctx.isFirstOfWeek) {
    return {
      title: "Week in motion.",
      body: "Don't break the chain. Today's session or freelance?",
      tag: "gym-first-of-week",
    };
  }
  if (ctx.visitsThisWeek >= 3) {
    return {
      title: `${ctx.visitsThisWeek}× this week.`,
      body: "This is what consistent looks like. Today's session or freelance?",
      tag: "gym-week-count",
    };
  }
  return {
    title: "You're in.",
    body: "Let's cook. Today's session or freelance?",
    tag: "gym-entered",
  };
}

export function dwellMessage(minutesIn: number): { title: string; body: string; tag: string } | null {
  if (minutesIn >= 60) {
    return {
      title: "60 in.",
      body: "That's the kind of session that changes things.",
      tag: "gym-dwell-60",
    };
  }
  if (minutesIn >= 30) {
    return {
      title: "30 in.",
      body: "Past the part most quit at. Keep going.",
      tag: "gym-dwell-30",
    };
  }
  return null;
}

export function exitMessage(minutesIn: number): { title: string; body: string; tag: string } | null {
  if (minutesIn < 15) return null;
  return {
    title: `${Math.round(minutesIn)} min logged.`,
    body: "Showed up, did the work. Logged.",
    tag: "gym-exit",
  };
}
