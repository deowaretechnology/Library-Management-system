/**
 * Seeds the Sanity catalog: authors, a publisher, a category, a subject, and the 4 demo
 * books — using fixed _id values that match the `sanityBookId`s scripts/seed.ts already
 * writes into MongoDB BookCopy documents (seed-book-dbms, seed-book-dsa, seed-book-os,
 * seed-book-networks). Run this BEFORE `npm run seed` so /admin/books and /student/books
 * show real titles instead of an empty catalog. `npm run seed:all` runs both in order.
 *
 * Requires SANITY_API_WRITE_TOKEN (a write-capable token from sanity.io/manage) in your
 * environment, in addition to the NEXT_PUBLIC_SANITY_* vars.
 *
 * Run via `npm run seed:sanity` — that script passes --env-file=.env.local so these vars
 * are actually loaded. (Plain `tsx scripts/seedSanity.ts` will NOT see .env.local — tsx
 * transpiles `import` to hoisted `require()`s, so an in-file `dotenv.config()` call always
 * runs too late, after modules that read env vars at their own top level have already
 * evaluated. Node's own --env-file flag loads vars before any JS runs at all, sidestepping
 * that problem entirely.)
 */
import { sanityWriteClient } from "../lib/sanity/client";

async function upsert(doc: { _id: string; _type: string; [key: string]: unknown }) {
  await sanityWriteClient.createOrReplace(doc);
  console.log(`  ✓ ${doc._type}: ${doc._id}`);
}

/**
 * Downloads a real cover from the Open Library Covers API (https://openlibrary.org/dev/docs/api/covers)
 * by ISBN and uploads it as a Sanity image asset. `?default=false` makes Open Library return a real
 * 404 for an ISBN it has no cover for, instead of its 1x1 grey placeholder — so a miss here is a clean
 * `undefined` rather than a blank image silently stored in Sanity. Returns the new asset's _id, or
 * undefined if no cover was found (the book is still seeded either way, just without an image).
 */
async function fetchCoverAssetId(isbn: string): Promise<string | undefined> {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const buffer = Buffer.from(await res.arrayBuffer());
    const asset = await sanityWriteClient.assets.upload("image", buffer, { filename: `${isbn}.jpg` });
    return asset._id;
  } catch (err) {
    console.warn(`  ! Could not fetch/upload cover for ISBN ${isbn}:`, err);
    return undefined;
  }
}

function coverImageField(assetId: string | undefined) {
  return assetId ? { coverImage: { _type: "image", asset: { _type: "reference", _ref: assetId } } } : {};
}

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not set — get a write token from sanity.io/manage");
  }

  console.log("Seeding authors, publisher, category, subject…");
  await upsert({ _id: "author-korth", _type: "author", name: "Henry F. Korth" });
  await upsert({ _id: "author-cormen", _type: "author", name: "Thomas H. Cormen" });
  await upsert({ _id: "author-silberschatz", _type: "author", name: "Abraham Silberschatz" });
  await upsert({ _id: "author-tanenbaum", _type: "author", name: "Andrew S. Tanenbaum" });
  await upsert({ _id: "author-aho", _type: "author", name: "Alfred V. Aho" });

  await upsert({ _id: "publisher-mcgrawhill", _type: "publisher", name: "McGraw-Hill Education" });
  await upsert({ _id: "publisher-mit", _type: "publisher", name: "MIT Press" });
  await upsert({ _id: "publisher-pearson", _type: "publisher", name: "Pearson" });

  await upsert({ _id: "category-cs", _type: "category", name: "Computer Science" });
  await upsert({ _id: "subject-core-cs", _type: "subject", name: "Core CS" });

  console.log("Seeding books (fixed _ids matching the MongoDB seed's sanityBookId values)…");
  console.log("Fetching real covers from the Open Library Covers API by ISBN…");

  const dbmsIsbn = "9780078022159";
  const dsaIsbn = "9780262046305";
  const osIsbn = "9781119800361";
  const networksIsbn = "9780132126953";
  const compilersIsbn = "9780321486813";

  const [dbmsCover, dsaCover, osCover, networksCover, compilersCover] = await Promise.all([
    fetchCoverAssetId(dbmsIsbn),
    fetchCoverAssetId(dsaIsbn),
    fetchCoverAssetId(osIsbn),
    fetchCoverAssetId(networksIsbn),
    fetchCoverAssetId(compilersIsbn),
  ]);

  await upsert({
    _id: "seed-book-dbms",
    _type: "book",
    title: "Database Management Systems",
    slug: { _type: "slug", current: "database-management-systems" },
    isbn: dbmsIsbn,
    authors: [{ _type: "reference", _ref: "author-korth", _key: "a1" }],
    publisher: { _type: "reference", _ref: "publisher-mcgrawhill" },
    category: { _type: "reference", _ref: "category-cs" },
    subject: { _type: "reference", _ref: "subject-core-cs" },
    edition: "7th",
    publicationYear: 2019,
    language: "English",
    description: "Core textbook on relational database design, SQL, and transaction management.",
    ...coverImageField(dbmsCover),
  });

  await upsert({
    _id: "seed-book-dsa",
    _type: "book",
    title: "Introduction to Algorithms",
    slug: { _type: "slug", current: "introduction-to-algorithms" },
    isbn: dsaIsbn,
    authors: [{ _type: "reference", _ref: "author-cormen", _key: "a1" }],
    publisher: { _type: "reference", _ref: "publisher-mit" },
    category: { _type: "reference", _ref: "category-cs" },
    subject: { _type: "reference", _ref: "subject-core-cs" },
    edition: "4th",
    publicationYear: 2022,
    language: "English",
    description: "The standard reference on data structures and algorithm design (CLRS).",
    ...coverImageField(dsaCover),
  });

  await upsert({
    _id: "seed-book-os",
    _type: "book",
    title: "Operating System Concepts",
    slug: { _type: "slug", current: "operating-system-concepts" },
    isbn: osIsbn,
    authors: [{ _type: "reference", _ref: "author-silberschatz", _key: "a1" }],
    publisher: { _type: "reference", _ref: "publisher-pearson" },
    category: { _type: "reference", _ref: "category-cs" },
    subject: { _type: "reference", _ref: "subject-core-cs" },
    edition: "10th",
    publicationYear: 2021,
    language: "English",
    description: "Foundational textbook covering processes, memory management, and file systems.",
    ...coverImageField(osCover),
  });

  await upsert({
    _id: "seed-book-networks",
    _type: "book",
    title: "Computer Networks",
    slug: { _type: "slug", current: "computer-networks" },
    isbn: networksIsbn,
    authors: [{ _type: "reference", _ref: "author-tanenbaum", _key: "a1" }],
    publisher: { _type: "reference", _ref: "publisher-pearson" },
    category: { _type: "reference", _ref: "category-cs" },
    subject: { _type: "reference", _ref: "subject-core-cs" },
    edition: "5th",
    publicationYear: 2013,
    language: "English",
    description: "Comprehensive coverage of network architecture from the physical layer up.",
    ...coverImageField(networksCover),
  });

  await upsert({
    _id: "seed-book-compilers",
    _type: "book",
    title: "Compilers: Principles, Techniques, and Tools",
    slug: { _type: "slug", current: "compilers-principles-techniques-and-tools" },
    isbn: compilersIsbn,
    authors: [{ _type: "reference", _ref: "author-aho", _key: "a1" }],
    publisher: { _type: "reference", _ref: "publisher-pearson" },
    category: { _type: "reference", _ref: "category-cs" },
    subject: { _type: "reference", _ref: "subject-core-cs" },
    edition: "2nd",
    publicationYear: 2006,
    language: "English",
    description: "The classic \"Dragon Book\" on lexical analysis, parsing, and code generation.",
    ...coverImageField(compilersCover),
  });

  console.log("Sanity catalog seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
