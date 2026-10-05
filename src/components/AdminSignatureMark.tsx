import { Link } from "@tanstack/react-router";
import signature from "@/assets/e2v-signature.png.asset.json";

/**
 * Discreet artist's-inscription mark at the very bottom of every page.
 * Explicit width + height (intrinsic 1584x672) so it has real layout size
 * before decode; eager-loaded so it always paints.
 */
export function AdminSignatureMark() {
  return (
    <div data-web-only className="w-full flex justify-center py-10">
      <Link
        to={"/admin" as never}
        aria-label="Admin"
        className="inline-flex opacity-[0.28] transition-opacity duration-300 hover:opacity-60 focus-visible:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        <img
          src={signature.url}
          alt=""
          aria-hidden="true"
          width={61}
          height={26}
          decoding="async"
          className="h-5 w-[47px] sm:h-[26px] sm:w-[61px] dark:invert"
          style={{ aspectRatio: "1584 / 672" }}
        />
      </Link>
    </div>
  );
}
