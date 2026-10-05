import { useMemo, useState } from "react";
import { Search, ChevronRight, ExternalLink } from "lucide-react";
import type { CatalogItem } from "@/lib/medications.functions";
import { candyRxUrl, CANDYRX_CODE } from "@/lib/candyrx";

export function MedicationPicker({
  catalog,
  onPick,
}: {
  catalog: CatalogItem[];
  onPick: (item: CatalogItem) => void;
}) {
  const [q, setQ] = useState("");
  const candyrxOnly = useMemo(() => catalog.filter((c) => c.source === "candyrx"), [catalog]);

  const grouped = useMemo(() => {
    const filtered = candyrxOnly.filter((c) => {
      if (!q) return true;
      const hay = `${c.brand_name} ${c.generic_name ?? ""} ${c.category}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
    const map = new Map<string, CatalogItem[]>();
    for (const c of filtered) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return Array.from(map.entries());
  }, [candyrxOnly, q]);

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        CandyRx products only. P is not your doctor. CandyRx clinicians prescribe, monitor, and ship. REBUILT earns a referral fee.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full h-11 pl-9 pr-3 rounded-md border border-border bg-background text-sm"
          placeholder="Search CandyRx catalog…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {grouped.map(([cat, items]) => (
        <div key={cat} className="space-y-1.5">
          <p className="label-mono text-xs text-muted-foreground">{cat}</p>
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className="w-full flex items-start justify-between gap-3 min-h-14 p-3.5 rounded-md border border-border bg-background/40 hover:bg-background text-left"
            >
              <div className="min-w-0">
                <p className="text-sm">{c.brand_name}</p>
                {c.generic_name && (
                  <p className="text-[11px] text-muted-foreground truncate">{c.generic_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="label-mono text-[11px] px-1.5 py-0.5 rounded border border-gold/40 text-gold bg-gold/5">CandyRx</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      ))}

      {grouped.length === 0 && (
        <div className="rounded-md border border-border bg-[color:var(--bg-sunken)] p-4 space-y-2 text-center">
          <p className="text-sm">Not on CandyRx? It can't be tracked here.</p>
          <a
            href={candyRxUrl("/products")}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
          >
            Browse CandyRx · code {CANDYRX_CODE} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
