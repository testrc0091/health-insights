import { z } from "zod";

/** Local-only photo storage for SkinEntry/BodyMeasurement — never uploaded anywhere
 * (ARCHITECTURE.md §7). Kept as its own table so photo blobs can be excluded or
 * base64-inlined independently when building a JSON export. */
export const photoBlobSchema = z.object({
  id: z.string().uuid(),
  blob: z.instanceof(Blob),
  createdAt: z.string(),
});

export type PhotoBlob = z.infer<typeof photoBlobSchema>;
