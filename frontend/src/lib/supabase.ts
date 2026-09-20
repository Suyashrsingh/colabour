import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "sahaay-auth-session",
        storage: window.localStorage,
      },
    })
  : null;

export const supabaseConfigError =
  "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file in the project root, then restart the dev server.";

export type UploadedDocumentMeta = {
  uploaded: boolean;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  fileUrl: string;
  ref: string;
};

export async function uploadSocietyDocument(
  societyId: string,
  docKey: string,
  file: File
): Promise<UploadedDocumentMeta> {
  const fileExt = file.name.split(".").pop() || "pdf";
  const cleanDocKey = docKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${societyId}/${cleanDocKey}_${Date.now()}.${fileExt}`;
  const nowFormatted = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const sizeFormatted =
    file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

  let fileUrl = "";

  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from("society-documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (!error && data?.path) {
        const { data: publicUrlData } = supabase.storage
          .from("society-documents")
          .getPublicUrl(data.path);
        if (publicUrlData?.publicUrl) {
          fileUrl = publicUrlData.publicUrl;
        }
      } else if (error) {
        console.warn("Supabase storage upload error:", error);
      }
    } catch (err) {
      console.warn("Storage upload exception:", err);
    }
  }

  // Fallback: If not uploaded to storage bucket, read as base64 data URL for small files (< 1.5MB)
  if (!fileUrl && file.size < 1.5 * 1024 * 1024) {
    try {
      fileUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });
    } catch {
      fileUrl = "";
    }
  }

  return {
    uploaded: true,
    fileName: file.name,
    fileSize: sizeFormatted,
    uploadedAt: nowFormatted,
    fileUrl,
    ref: `DOC-${Date.now().toString().slice(-6)}`,
  };
}
