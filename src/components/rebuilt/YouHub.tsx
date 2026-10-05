import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookHeart,
  LineChart,
  Trophy,
  Pill,
  FlaskConical,
  Activity,
  Sparkles,
  Mountain,
  MessageCircle,
  CalendarPlus,
  Gift,
  User,
  Shield,
  Settings as SettingsIcon,
  ChevronRight,
  Beaker,
} from "lucide-react";
import { SectionLabel } from "@/components/ui/gold-divider";
import { isAdmin } from "@/lib/admin.functions";

type Item = {
  to: string;
  label: string;
  sub: string;
  Icon: typeof BookHeart;
  badge?: string;
};


type Group = {
  title: string;
  items: Item[];
};

// Everything the collapsed tabs used to reach, grouped for scannability.
// 8th-grade labels; short subtitles say what each screen is for.
const GROUPS: Group[] = [
  {
    title: "Daily",
    items: [
      { to: "/app/journal", label: "Journal", sub: "Write it down", Icon: BookHeart },
      { to: "/app/progress", label: "Progress", sub: "Weight · photos · trends", Icon: LineChart },
      { to: "/app/achievements", label: "Trophies", sub: "Wins you've earned", Icon: Trophy },
      { to: "/app/coach", label: "Coach P", sub: "Ask anything, anytime", Icon: MessageCircle },
    ],
  },
  {
    title: "Health data",
    items: [
      { to: "/app/protocol", label: "Protocol", sub: "Meds and supplements", Icon: Pill },
      { to: "/app/peptides", label: "Peptides", sub: "Your peptide plan", Icon: Beaker },
      { to: "/app/labs", label: "Labs", sub: "Blood work and results", Icon: FlaskConical, badge: "Coming soon" },
      { to: "/app/readiness", label: "Readiness", sub: "How your body is today", Icon: Activity },
    ],
  },
  {
    title: "Extras",
    items: [
      { to: "/app/spirit", label: "Spirit", sub: "Faith and reflection", Icon: Sparkles },
      { to: "/app/outdoor", label: "Outdoor", sub: "Get outside daily", Icon: Mountain },
      { to: "/app/consult", label: "Consult", sub: "1-on-1 with the team", Icon: CalendarPlus },
      { to: "/app/redeem", label: "Redeem", sub: "Perks and rewards", Icon: Gift },
    ],
  },
  {
    title: "Perks & referrals",
    items: [
      { to: "/app/redeem", label: "Perks", sub: "Partner discount codes", Icon: Gift },
      { to: "/app/redeem", label: "Bring a friend", sub: "Share your referral code", Icon: MessageCircle },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/app/account", label: "Account", sub: "Email, plan, sign out", Icon: User },
    ],
  },
];

export function YouHub() {
  const admin = useQuery({
    queryKey: ["you-hub-is-admin"],
    queryFn: () => isAdmin(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const groups: Group[] = admin.data?.isAdmin
    ? [
        ...GROUPS,
        {
          title: "Admin",
          items: [{ to: "/admin", label: "Admin", sub: "Coach dashboard", Icon: Shield }],
        },
      ]
    : GROUPS;

  return (
    <section className="space-y-5">
      {groups.map((group) => (
        <div key={group.title} className="space-y-2">
          <SectionLabel>{group.title}</SectionLabel>
          <ul className="grid grid-cols-2 gap-2">
            {group.items.map(({ to, label, sub, Icon, badge }) => (
              <li key={to}>
                <Link
                  to={to as never}
                  preload="intent"
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-3 py-3 min-h-[64px] active:scale-[0.98] transition-transform"
                >
                  <span
                    className="grid place-items-center h-10 w-10 rounded-xl shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--rebuilt-gold, hsl(45 85% 62%))",
                    }}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm leading-tight truncate">
                        {label}
                      </span>
                      {badge && (
                        <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-1.5 py-[1px] text-[9px] uppercase tracking-wider text-gold">
                          {badge}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {sub}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground uppercase tracking-widest">
          Settings below
        </span>
      </div>
    </section>
  );
}
