import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Info, CheckCircle2, BookHeart, Pill, MessageCircle } from "lucide-react";

export function AboutAppSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" /> About this app
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto border-gold/30">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl leading-tight">
            What REBUILT actually does.
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5 text-sm text-foreground/85 leading-relaxed">
          <p>
            A daily accountability + protocol app for people rebuilding their body,
            mind, and habits. No fluff. Show up, get coached, keep moving.
          </p>

          <div className="space-y-3">
            <Row icon={<CheckCircle2 className="h-4 w-4 text-primary" />} title="Check-in" body="90-second honest read on where you're at. Builds your streak and tracks your daily numbers." />
            <Row icon={<Pill className="h-4 w-4 text-primary" />} title="Plan & Protocol" body="Your meds, supplements, training, and nutrition — laid out for today, not someday." />
            <Row icon={<BookHeart className="h-4 w-4 text-primary" />} title="Journal" body="Talk it out. P listens, writes back, and your entries stay archived for you to revisit." />
            <Row icon={<MessageCircle className="h-4 w-4 text-primary" />} title="Coach P" body="Answers your questions, course-corrects when you drift, and remembers your story." />
          </div>

          <div className="rounded-md border border-gold/30 bg-primary/5 p-4">
            <p className="font-display text-base">
              Show up daily. <span className="text-primary">P does the rest.</span>
            </p>
          </div>

          <div className="pt-5 border-t border-border space-y-2 text-center">
            <p className="font-display text-base text-foreground">
              REBUILT is a movement. The program is the door.
            </p>
            <div className="flex flex-col gap-1 text-xs">
              <a
                href="https://rebuilt-builder-suite.lovable.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
              >
                rebuilt-builder-suite.lovable.app
              </a>
              <a
                href="https://playboyp-rebuilt-system.lovable.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:underline"
              >
                playboyp-rebuilt-system.lovable.app
              </a>
            </div>
            <p className="text-[10px] text-muted-foreground pt-2">
              Faith-based content available for all traditions. Built by Evan Valdes · @playboyp858
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ icon, title, body }: { icon: import("react").ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-foreground/75">{body}</p>
      </div>
    </div>
  );
}
