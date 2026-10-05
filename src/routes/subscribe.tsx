import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const SubscribeSearch = z.object({
  code: z.string().max(40).optional(),
  cycle: z.enum(["monthly", "annual"]).optional(),
  plan: z.string().max(40).optional(),
  redirect: z.string().optional(),
});

/**
 * Legacy pricing URL. /pricing is the single pricing surface now, so this
 * route just forwards there (old emails and links keep working).
 */
export const Route = createFileRoute("/subscribe")({
  validateSearch: (s) => SubscribeSearch.parse(s),
  beforeLoad: () => {
    throw redirect({ to: "/pricing" as never });
  },
  component: () => null,
});
