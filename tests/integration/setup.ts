import { vi, beforeEach } from "vitest";

export const cookieStore = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => {
      cookieStore.set(name, { value });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
  headers: async () => new Headers(),
}));

// Server actions call revalidatePath/revalidateTag, which need Next's request store —
// irrelevant to what these tests check (database state), so they're no-ops here.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

beforeEach(() => {
  cookieStore.clear();
});
