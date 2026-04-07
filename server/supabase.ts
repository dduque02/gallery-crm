import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Image upload will be disabled.");
}

export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function ensureBucket() {
  if (!supabase) return;
  const { data } = await supabase.storage.getBucket("artwork-images");
  if (!data) {
    await supabase.storage.createBucket("artwork-images", {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      fileSizeLimit: 20 * 1024 * 1024,
    });
    console.log("Created Supabase Storage bucket: artwork-images");
  }
}
