import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["LIBRARIAN", "LIBRARY_STAFF"], { message: "Choose a role" }),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
