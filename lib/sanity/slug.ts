/** Small local slugify — avoids pulling in a dependency for one function. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Appends a short random suffix so two documents with the same name never collide. */
export function uniqueSlug(input: string): string {
  const base = slugify(input) || "item";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
