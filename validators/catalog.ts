import { z } from "zod";

/** Accepts a browser File (from a file input) but never requires one — every image is optional. */
const optionalImage = z
  .instanceof(File)
  .optional()
  .refine((f) => !f || f.size === 0 || f.type.startsWith("image/"), "File must be an image")
  .refine((f) => !f || f.size <= 5 * 1024 * 1024, "Image must be smaller than 5MB");

export const createAuthorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  bio: z.string().optional(),
  photo: optionalImage,
});
export type CreateAuthorInput = z.infer<typeof createAuthorSchema>;

export const createPublisherSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  logo: optionalImage,
});
export type CreatePublisherInput = z.infer<typeof createPublisherSchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const createSubjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const createBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional(),
  isbn: z.string().min(1, "ISBN is required"),
  authorIds: z.array(z.string().min(1)).min(1, "Choose at least one author"),
  publisherId: z.string().optional(),
  categoryId: z.string().optional(),
  subjectId: z.string().optional(),
  edition: z.string().optional(),
  publicationYear: z.coerce.number().int().min(1000).max(3000).optional(),
  language: z.string().optional(),
  description: z.string().optional(),
  coverImage: optionalImage,
});
export type CreateBookInput = z.infer<typeof createBookSchema>;
