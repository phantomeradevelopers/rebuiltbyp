// Plain-English, education-only catalog of peptide categories.
// This file intentionally contains ZERO dosing, frequency, route,
// stacking, or protocol guidance. It exists to help users
// recognize what they're reading about and route them to the
// right resource (licensed clinician via CandyRx, or wellness
// supplier YouthfulLab USA).

export type PeptideAccess = "prescription_only" | "research_or_wellness";

// Optional pointer to a doctor-prescribed CandyRx alternative when a
// category overlaps. The peptide hub renders this as a second CTA pill
// alongside the YouthfulLab (research) path so users see both options.
export type CandyRxOverlap = {
  examples: string[]; // product names as they appear on shopcandyrx.com
};

export type PeptideCategory = {
  id: string;
  title: string;
  blurb: string;          // 1-2 sentences, neutral, what it is / what it's studied for
  examples: string[];     // names only, no doses
  access: PeptideAccess;  // routes the CTA on the card
  note?: string;          // optional extra caution line
  candyrx?: CandyRxOverlap; // doctor-prescribed overlap when CandyRx carries it
};

export const PEPTIDE_CATEGORIES: PeptideCategory[] = [
  {
    id: "healing",
    title: "Healing & recovery",
    blurb:
      "Peptides studied in animal and early human research for their role in tissue repair, gut lining, and soft-tissue recovery.",
    examples: ["BPC-157", "TB-500 (TB4)", "KPV"],
    access: "research_or_wellness",
    note: "Sold by suppliers as research material. Not FDA-approved for human use.",
  },
  {
    id: "gh_secretagogues",
    title: "Growth hormone secretagogues",
    blurb:
      "Compounds that signal the pituitary to release the body's own growth hormone in pulses, instead of injecting GH directly.",
    examples: ["Ipamorelin", "CJC-1295", "Sermorelin", "Tesamorelin"],
    access: "research_or_wellness",
  },
  {
    id: "metabolic",
    title: "Metabolic / weight (GLP-1)",
    blurb:
      "GLP-1 receptor agonists are FDA-approved prescription medications used for type 2 diabetes and chronic weight management. They require labs, a prescriber, and monitoring.",
    examples: ["Semaglutide", "Tirzepatide", "Liraglutide"],
    access: "prescription_only",
  },
  {
    id: "sexual_health",
    title: "Sexual health",
    blurb:
      "Peptides studied for libido and sexual response, plus the prescription ED meds men ask about most. Anything you inject or swallow goes through a clinician.",
    examples: ["PT-141 (Bremelanotide)", "Kisspeptin-10"],
    access: "prescription_only",
    candyrx: {
      examples: [
        "Sildenafil tablets",
        "Tadalafil tablets",
        "Vardenafil troche",
        "Trimix T105 injection",
      ],
    },
  },
  {
    id: "cognitive",
    title: "Cognitive & longevity",
    blurb:
      "Neuropeptides and longevity-class compounds studied for mood, focus, and cellular aging markers.",
    examples: ["Selank", "Semax", "Epitalon", "Cerebrolysin"],
    access: "research_or_wellness",
    candyrx: {
      examples: ["NAD+ injection", "NAD+ troche"],
    },
  },
  {
    id: "skin_hair",
    title: "Skin, hair & pigment",
    blurb:
      "Copper peptides and signaling peptides studied for skin repair, collagen, and hair follicle health. CandyRx carries doctor-prescribed creams and oral hair Rx that contain several of these.",
    examples: ["GHK-Cu", "Argireline", "PTD-DBM"],
    access: "research_or_wellness",
    note: "Topical formulas are widely available; injectable variants are research material.",
    candyrx: {
      examples: [
        "Caffeine + GHK-Cu + Niacinamide + Tretinoin cream",
        "Minoxidil / GHK-Cu / Apigenin / Fisetin tablets",
        "Tretinoin / Niacinamide / Sodium Hyaluronate cream",
        "Finasteride / Minoxidil / Biotin capsules",
      ],
    },
  },
];

export const YOUTHFULLAB_URL =
  "https://www.youthfullabusa.com/?utm_source=rebuilt&utm_medium=app&utm_campaign=peptide_education";

// CandyRx links are built via `candyRxUrl()` from `@/lib/candyrx` (single
// source of truth). Do not re-export a hardcoded URL from this file —
// `candyrx.ts` is the only place that knows the base URL + UTM shape.


