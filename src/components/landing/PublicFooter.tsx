import { Link } from "@tanstack/react-router";
import { FounderSignature } from "@/components/landing/FounderSignature";

export function PublicFooter({ showSignature = false }: { showSignature?: boolean }) {
  return (
    <footer className="border-t border-foreground/10 pt-10 pb-28 sm:pb-10 text-xs text-foreground/55">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon-512.png" alt="" width={512} height={512} decoding="async" loading="lazy" className="h-10 w-10 rounded-md" />
            <span className="font-wordmark text-xl tracking-[0.32em] leading-none">REBUILT</span>
            <span className="text-foreground/35 ml-1">© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to={"/pricing" as never} className="hover:text-foreground">Pricing</Link>
            <Link to={"/login" as never} className="hover:text-foreground">Sign in</Link>
            <Link to={"/legal" as never} className="hover:text-foreground">Legal</Link>
            <Link to={"/privacy" as never} className="hover:text-foreground">Privacy</Link>
            <Link to={"/terms" as never} className="hover:text-foreground">Terms</Link>
            <Link to={"/refunds" as never} className="hover:text-foreground">Refunds</Link>
            <a href="mailto:support@e2v.ai" className="hover:text-foreground">support@e2v.ai</a>
          </nav>
        </div>
        {showSignature && (
          <div className="mt-8 pt-6 border-t border-foreground/10">
            <FounderSignature />
          </div>
        )}
      </div>
    </footer>
  );
}
