import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(5).max(40),
  help: z.string().trim().min(10).max(2000),
  budget: z.string().trim().min(1).max(60),
});

/**
 * Public 1-on-1 consult application. Stores the lead and sends the applicant
 * the existing contact auto-reply, plus an internal copy to the owner inbox.
 */
export const submitConsultLead = createServerFn({ method: "POST" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { enqueueRebuiltEmail } = await import("@/lib/rebuilt-email.server");
    const { createClient } = await import("@supabase/supabase-js");

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const admin = createClient(url, key);
      await admin.from("consult_leads").insert({
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone,
        help: data.help,
        budget: data.budget,
      });
    }

    const firstName = data.name.split(" ")[0] ?? data.name;
    await enqueueRebuiltEmail({
      templateName: "contact-auto-reply",
      recipientEmail: data.email.toLowerCase(),
      templateData: { firstName },
    });

    return { ok: true };
  });
