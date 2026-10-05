import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { candyRxUrl, CANDYRX_CODE as CODE } from "@/lib/candyrx";
import { trackAffiliateClick } from "@/lib/affiliate-tracking";

function url(path: "/" | "/products" = "/products") {
  return candyRxUrl(path);
}

type Product = { name: string; tag?: string };
type Group = { id: string; title: string; blurb: string; products: Product[] };

// Mirrors the live catalog at shopcandyrx.com/products (6 categories).
const GROUPS: Group[] = [
  {
    id: "weight",
    title: "Weight loss (GLP-1)",
    blurb: "Compounded GLP-1s + brand Mounjaro®, prescribed and shipped.",
    products: [
      { name: "Compounded Semaglutide" },
      { name: "Compounded Tirzepatide — injection" },
      { name: "Compounded Tirzepatide — oral dissolving tablet" },
      { name: "GLP Squared injection" },
      { name: "MICC injection", tag: "Lipotropic" },
      { name: "Mounjaro®", tag: "Brand" },
    ],
  },
  {
    id: "hormones",
    title: "Hormonal therapy (TRT)",
    blurb: "Testosterone in three delivery formats — labs + clinician required.",
    products: [
      { name: "Testosterone Cream" },
      { name: "Testosterone Cypionate injection" },
      { name: "Testosterone Troche" },
    ],
  },
  {
    id: "sexual",
    title: "Sexual health",
    blurb: "ED meds and Trimix — prescribed, no awkward pharmacy line.",
    products: [
      { name: "Sildenafil tablets" },
      { name: "Tadalafil tablets" },
      { name: "Vardenafil troche" },
      { name: "Trimix T105 (alprostadil/papaverine/phentolamine)" },
    ],
  },
  {
    id: "hair",
    title: "Hair growth",
    blurb: "Topical + oral hair Rx, including a GHK-Cu copper-peptide tablet.",
    products: [
      { name: "Finasteride / Minoxidil / Biotin capsules" },
      { name: "Minoxidil tablets" },
      { name: "Latanoprost / Minoxidil" },
      { name: "Ketoconazole / Latanoprost / Minoxidil" },
      { name: "Minoxidil / GHK-Cu / Apigenin / Fisetin tablets", tag: "Copper peptide" },
    ],
  },
  {
    id: "skin",
    title: "Skincare",
    blurb: "Compounded creams — tretinoin, GHK-Cu copper peptide, estriol, azelaic.",
    products: [
      { name: "Caffeine + GHK-Cu + Niacinamide + Tretinoin cream", tag: "Copper peptide" },
      { name: "Tretinoin / Niacinamide / Sodium Hyaluronate cream" },
      { name: "Estriol / Niacinamide / Tretinoin cream" },
      { name: "Azelaic Acid + Niacinamide + Tranexamic Acid cream" },
    ],
  },
  {
    id: "wellness",
    title: "Wellness / anti-aging",
    blurb: "NAD+ for cellular energy — prescribed forms only.",
    products: [
      { name: "NAD+ injection" },
      { name: "NAD+ troche" },
    ],
  },
];

export function CandyRxCard({
  variant = "full",
  hint,
}: {
  variant?: "full" | "compact";
  hint?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (variant === "compact") {
    return (
      <div className="space-y-1">
        <a
          href={url("/")}
          target="_blank"
          rel="sponsored noopener noreferrer"
          onClick={() => trackAffiliateClick("candyrx", "compact_card", url("/"))}
          className="flex items-center justify-between gap-3 rounded-md border border-gold/40 bg-gold/5 p-3 hover:bg-gold/10 transition"
        >
          <div className="min-w-0">
            <p className="label-mono text-gold text-xs">P's pharmacy · CandyRx</p>
            <p className="text-sm mt-0.5 truncate">
              {hint ?? "TRT · GLP-1 · GHK-Cu · hair Rx — code PLAYBOYP15"}
            </p>
          </div>
          <ExternalLink className="h-4 w-4 text-gold shrink-0" />
        </a>
        <p className="text-[10px] text-muted-foreground leading-tight px-1">
          P is not your doctor. CandyRx clinicians prescribe, monitor, and ship.
        </p>
      </div>
    );
  }

  return (
    <section className="card-elevated p-5 space-y-4 border border-gold/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-mono text-gold">P's pharmacy · CandyRx</p>
          <p className="mt-2 font-display text-2xl leading-tight">
            When the body asks for more, this is where I send you.
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Labs, licensed doctors, real protocols — across weight loss, hormones,
            sexual health, hair, skin, and longevity. Code{" "}
            <span className="text-gold font-mono">{CODE}</span> at checkout.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {GROUPS.map((g) => {
          const open = openId === g.id;
          return (
            <div
              key={g.id}
              className="rounded-md border border-border bg-background/40 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : g.id)}
                className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-background/60 transition"
                aria-expanded={open}
              >
                <div className="min-w-0">
                  <p className="text-sm">{g.title}</p>
                  <p className="label-mono text-xs text-muted-foreground mt-0.5 truncate">
                    {g.blurb}
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div className="border-t border-border px-3 py-2 space-y-1.5">
                  {g.products.map((p) => (
                    <a
                      key={p.name}
                      href={url("/products")}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      onClick={() => trackAffiliateClick("candyrx", `product:${p.name}`, url("/products"))}
                      className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-xs hover:bg-gold/5 hover:text-gold transition"
                    >
                      <span className="min-w-0 truncate">{p.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {p.tag && (
                          <span className="label-mono text-[11px] text-muted-foreground">
                            {p.tag}
                          </span>
                        )}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <a
        href={url("/products")}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => trackAffiliateClick("candyrx", "full_card_browse_all", url("/products"))}
        className="block text-center h-11 leading-[44px] rounded-md bg-gold text-gold-foreground text-sm font-medium hover:opacity-90"
      >
        Browse all products →
      </a>
      <p className="text-xs text-muted-foreground text-center">
        P is not your doctor. CandyRx clinicians prescribe, monitor, and ship.
      </p>
    </section>
  );
}
