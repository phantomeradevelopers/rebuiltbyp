import { supabase } from "@/integrations/supabase/client";
import { addProgressPhoto } from "@/lib/progress.functions";

export async function uploadBaselinePhoto(file: File): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("progress-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  await addProgressPhoto({ data: { path, view_type: "front" } });
}
