export type Gender = "male" | "female" | null | undefined;

export function getIdentityNoun(gender: Gender): "man" | "woman" | "person" {
  if (gender === "male") return "man";
  if (gender === "female") return "woman";
  return "person";
}

export function getPronoun(gender: Gender): { subj: string; obj: string; poss: string } {
  if (gender === "female") return { subj: "she", obj: "her", poss: "her" };
  return { subj: "he", obj: "him", poss: "his" };
}

export function getBecomingTitle(gender: Gender): string {
  const n = getIdentityNoun(gender);
  return `The ${n} you're becoming.`;
}
