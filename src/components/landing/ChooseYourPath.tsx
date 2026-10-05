import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Heart } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";

const STORAGE_KEY = "rebuilt:track";

function pickTrack(track: "men" | "angels") {
  try {
    window.localStorage.setItem(STORAGE_KEY, track);
    document.documentElement.setAttribute("data-track", track);
  } catch {
    /* noop */
  }
}

/**
 * Landing "Choose your path" section. Sets the track in localStorage
 * BEFORE navigating so onboarding lands on the right coach/voices/copy.
 */
export function ChooseYourPath() {
  return (
    <section id="paths" className="py-14 sm:py-20">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="label-mono text-gold">Choose your path</p>
          <h2 className="mt-3 font-display text-3xl sm:text-5xl leading-[1.05]">
            Two coaches. One mission.
          </h2>
          <p className="mt-3 text-foreground/70">
            Pick the coach who walks with you. You can switch anytime.
          </p>
        </Reveal>

        <Reveal
          delay={0.1}
          className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6"
        >
          {/* Card A — Men's / Coach P */}
          <article
            className="group relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/[0.08] via-background to-background p-6 sm:p-7 flex flex-col shadow-xl"
          >
            <div
              aria-hidden
              className="absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl opacity-60"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--rebuilt-gold) 40%, transparent), transparent 70%)",
              }}
            />
            <div className="relative">
              <span className="label-mono text-gold inline-flex items-center gap-2 text-xs">
                <Sparkles className="h-3 w-3" /> For Him
              </span>
              <h3 className="mt-3 font-display text-3xl sm:text-4xl leading-tight">
                REBUILT
              </h3>
              <p className="mt-1 text-sm text-gold/90 label-mono tracking-[0.14em]">
                Train with Coach P.
              </p>
              <p className="mt-4 text-foreground/80 text-[15px] leading-relaxed">
                Discipline, strength, and a mogul mindset. Your masculine role
                model in your pocket.
              </p>
            </div>
            <div className="relative mt-6 sm:mt-8">
              <Link
                to={"/login" as never}
                onClick={() => pickTrack("men")}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 h-12 px-6 rounded-full bg-gradient-to-r from-gold/90 to-gold text-gold-foreground text-sm font-medium hover:from-gold hover:to-gold/90 transition shadow-[0_8px_30px_-6px_oklch(0.73_0.11_80/0.5)] active:scale-[0.98]"
              >
                Start as a man <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* Card B — Angels / Coach Grace */}
          <article
            className="group relative overflow-hidden rounded-3xl border border-rose-400/30 bg-gradient-to-br from-rose-400/[0.08] via-background to-background p-6 sm:p-7 flex flex-col shadow-xl"
          >
            <div
              aria-hidden
              className="absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl opacity-60"
              style={{
                background:
                  "radial-gradient(circle, rgba(244,114,182,0.45), transparent 70%)",
              }}
            />
            <div className="relative">
              <span className="label-mono inline-flex items-center gap-2 text-xs text-rose-400">
                <Heart className="h-3 w-3" /> For Her
              </span>
              <h3 className="mt-3 font-display text-3xl sm:text-4xl leading-tight">
                REBUILT <span className="text-rose-400">ANGELS</span>
              </h3>
              <p className="mt-1 text-sm label-mono tracking-[0.14em] text-rose-400/90">
                Train with Coach Grace.
              </p>
              <p className="mt-4 text-foreground/80 text-[15px] leading-relaxed">
                Strength, faith, and feminine power. Your coach for becoming
                the best version of you.
              </p>
            </div>
            <div className="relative mt-6 sm:mt-8">
              <Link
                to={"/login" as never}
                onClick={() => pickTrack("angels")}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 h-12 px-6 rounded-full bg-gradient-to-r from-rose-400 to-fuchsia-500 text-white text-sm font-medium hover:from-rose-400 hover:to-fuchsia-400 transition shadow-[0_8px_30px_-6px_rgba(244,114,182,0.5)] active:scale-[0.98]"
              >
                Start as a woman <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
