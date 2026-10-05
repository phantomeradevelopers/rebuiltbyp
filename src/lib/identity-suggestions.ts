import { getIdentityNoun, type Gender } from "./identity-copy";

const TEMPLATES = [
  "I am the {noun} who shows up before motivation does.",
  "I am the {noun} my kids can count on.",
  "I am the {noun} who doesn't negotiate with 6am.",
  "I am the {noun} who chose the hard road on purpose.",
  "I am the {noun} who out-trains yesterday.",
  "I am the {noun} who eats like it matters — because it does.",
  "I am the {noun} who keeps promises to themselves.",
  "I am the {noun} rebuilding, not restarting.",
  "I am the {noun} who answers when life calls.",
  "I am the {noun} who trains in silence and lets results talk.",
  "I am the {noun} who refuses to flinch.",
  "I am the {noun} my younger self prayed I'd become.",
];

export function getIdentitySuggestions(gender: Gender): string[] {
  const noun = getIdentityNoun(gender);
  return TEMPLATES.map((t) => t.replace("{noun}", noun));
}

export function getIdentityStarter(gender: Gender): string {
  return `I am the ${getIdentityNoun(gender)} who `;
}
