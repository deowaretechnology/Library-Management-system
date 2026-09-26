"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sanityReadClient, sanityWriteClient } from "@/lib/sanity/client";
import {
  bookSearchQuery,
  bookCountQuery,
  bookByIdQuery,
  authorListQuery,
  publisherListQuery,
  categoryListQuery,
  subjectListQuery,
  authorOptionsQuery,
  publisherOptionsQuery,
  categoryOptionsQuery,
  subjectOptionsQuery,
} from "@/lib/sanity/queries";
import { uniqueSlug } from "@/lib/sanity/slug";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth/requireRole";
import AuditLog from "@/models/AuditLog";
import BookCopy from "@/models/BookCopy";
import {
  createAuthorSchema,
  createPublisherSchema,
  createCategorySchema,
  createSubjectSchema,
  createBookSchema,
} from "@/validators/catalog";

const CATALOG_STAFF_ROLES = ["SUPER_ADMIN", "LIBRARIAN"] as const;

export type CatalogBook = {
  _id: string;
  title: string;
  isbn: string;
  coverUrl?: string;
  authors?: string[];
  category?: string;
};

export async function searchCatalog(term: string, page = 1, pageSize = 20) {
  // Signed-in users only, and bounded — an unbounded pageSize let anyone make the server
  // pull the whole catalog from Sanity + aggregate every copy in Mongo per request.
  await requireRole(["STUDENT", "SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  term = String(term ?? "").slice(0, 100);
  page = Math.max(1, Math.floor(Number(page) || 1));
  pageSize = Math.min(200, Math.max(1, Math.floor(Number(pageSize) || 20)));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const [books, total] = await Promise.all([
    sanityReadClient.fetch<CatalogBook[]>(bookSearchQuery, { term: term || "*", start, end }),
    sanityReadClient.fetch<number>(bookCountQuery, { term: term || "*" }),
  ]);

  // Availability is always computed from MongoDB — never trust a Sanity field for this.
  await connectToDatabase();
  const ids = books.map((b) => b._id);
  const counts = await BookCopy.aggregate([
    { $match: { sanityBookId: { $in: ids } } },
    { $group: { _id: { sanityBookId: "$sanityBookId", status: "$status" }, count: { $sum: 1 } } },
  ]);

  const availabilityByBook: Record<string, { total: number; available: number }> = {};
  for (const id of ids) availabilityByBook[id] = { total: 0, available: 0 };
  for (const row of counts) {
    const id = row._id.sanityBookId;
    availabilityByBook[id].total += row.count;
    if (row._id.status === "AVAILABLE") availabilityByBook[id].available += row.count;
  }

  return {
    books: books.map((b) => ({ ...b, availability: availabilityByBook[b._id] ?? { total: 0, available: 0 } })),
    total,
  };
}

/* ------------------------------------------------------------------------ */
/* Reference-data lists (Authors / Publishers / Categories / Subjects)      */
/* — for the admin list pages and for populating the "Add Book" selects.    */
/* ------------------------------------------------------------------------ */

export async function listAuthors() {
  return sanityReadClient.fetch(authorListQuery);
}
export async function listPublishers() {
  return sanityReadClient.fetch(publisherListQuery);
}
export async function listCategories() {
  return sanityReadClient.fetch(categoryListQuery);
}
export async function listSubjects() {
  return sanityReadClient.fetch(subjectListQuery);
}

/**
 * Id+title+isbn only — fills the "which book is this a physical copy of" <select> on the
 * Add-a-physical-copy form, so staff pick a title instead of having to know/type the raw
 * Sanity document _id by hand.
 */
export async function listBookOptions() {
  return sanityReadClient
    .fetch<{ _id: string; title: string; isbn: string }[]>(`*[_type == "book"] | order(title asc){ _id, title, isbn }`)
    .catch(() => []);
}

/** Id+name pairs only — cheap, used to fill <select> options in the create-book form. */
export async function getCatalogOptions() {
  const [authors, publishers, categories, subjects] = await Promise.all([
    sanityReadClient.fetch<{ _id: string; name: string }[]>(authorOptionsQuery),
    sanityReadClient.fetch<{ _id: string; name: string }[]>(publisherOptionsQuery),
    sanityReadClient.fetch<{ _id: string; name: string }[]>(categoryOptionsQuery),
    sanityReadClient.fetch<{ _id: string; name: string }[]>(subjectOptionsQuery),
  ]);
  return { authors, publishers, categories, subjects };
}

/** Uploads a chosen file to Sanity's asset store; returns an image field value, or undefined if no file was chosen. */
async function uploadImageIfPresent(file: File | null | undefined) {
  if (!file || file.size === 0) return undefined;
  const asset = await sanityWriteClient.assets.upload("image", Buffer.from(await file.arrayBuffer()), {
    filename: file.name,
  });
  return { _type: "image" as const, asset: { _type: "reference" as const, _ref: asset._id } };
}

/* ------------------------------------------------------------------------ */
/* Create + publish actions — this is what lets the admin panel manage the  */
/* catalog without ever opening Sanity Studio. Every write here goes        */
/* straight through `create()` (no draft), so it is published immediately. */
/* ------------------------------------------------------------------------ */

export async function createAuthorAction(formData: FormData) {
  const session = await requireRole([...CATALOG_STAFF_ROLES]);

  const parsed = createAuthorSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio") || undefined,
    photo: formData.get("photo") instanceof File ? (formData.get("photo") as File) : undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/authors?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const existing = await sanityReadClient.fetch<number>(`count(*[_type == "author" && name == $name])`, {
    name: parsed.data.name,
  });
  if (existing > 0) {
    redirect(`/admin/authors?error=${encodeURIComponent("An author with this name already exists.")}`);
  }

  const photo = await uploadImageIfPresent(parsed.data.photo);
  const doc = await sanityWriteClient.create({
    _type: "author",
    name: parsed.data.name,
    slug: { _type: "slug", current: uniqueSlug(parsed.data.name) },
    ...(parsed.data.bio ? { bio: parsed.data.bio } : {}),
    ...(photo ? { photo } : {}),
  });

  await connectToDatabase();
  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "CATALOG_AUTHOR_CREATED",
    entityType: "SanityAuthor",
    entityId: doc._id,
    newValue: { name: parsed.data.name },
  });

  revalidatePath("/admin/authors");
  revalidatePath("/admin/books");
  redirect("/admin/authors?created=1");
}

export async function createPublisherAction(formData: FormData) {
  const session = await requireRole([...CATALOG_STAFF_ROLES]);

  const parsed = createPublisherSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    logo: formData.get("logo") instanceof File ? (formData.get("logo") as File) : undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/publishers?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const existing = await sanityReadClient.fetch<number>(`count(*[_type == "publisher" && name == $name])`, {
    name: parsed.data.name,
  });
  if (existing > 0) {
    redirect(`/admin/publishers?error=${encodeURIComponent("A publisher with this name already exists.")}`);
  }

  const logo = await uploadImageIfPresent(parsed.data.logo);
  const doc = await sanityWriteClient.create({
    _type: "publisher",
    name: parsed.data.name,
    slug: { _type: "slug", current: uniqueSlug(parsed.data.name) },
    ...(parsed.data.address ? { address: parsed.data.address } : {}),
    ...(logo ? { logo } : {}),
  });

  await connectToDatabase();
  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "CATALOG_PUBLISHER_CREATED",
    entityType: "SanityPublisher",
    entityId: doc._id,
    newValue: { name: parsed.data.name },
  });

  revalidatePath("/admin/publishers");
  revalidatePath("/admin/books");
  redirect("/admin/publishers?created=1");
}

export async function createCategoryAction(formData: FormData) {
  const session = await requireRole([...CATALOG_STAFF_ROLES]);

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/categories?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const existing = await sanityReadClient.fetch<number>(`count(*[_type == "category" && name == $name])`, {
    name: parsed.data.name,
  });
  if (existing > 0) {
    redirect(`/admin/categories?error=${encodeURIComponent("A category with this name already exists.")}`);
  }

  const doc = await sanityWriteClient.create({
    _type: "category",
    name: parsed.data.name,
    slug: { _type: "slug", current: uniqueSlug(parsed.data.name) },
    ...(parsed.data.description ? { description: parsed.data.description } : {}),
  });

  await connectToDatabase();
  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "CATALOG_CATEGORY_CREATED",
    entityType: "SanityCategory",
    entityId: doc._id,
    newValue: { name: parsed.data.name },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/books");
  redirect("/admin/categories?created=1");
}

export async function createSubjectAction(formData: FormData) {
  const session = await requireRole([...CATALOG_STAFF_ROLES]);

  const parsed = createSubjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/subjects?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const existing = await sanityReadClient.fetch<number>(`count(*[_type == "subject" && name == $name])`, {
    name: parsed.data.name,
  });
  if (existing > 0) {
    redirect(`/admin/subjects?error=${encodeURIComponent("A subject with this name already exists.")}`);
  }

  const doc = await sanityWriteClient.create({
    _type: "subject",
    name: parsed.data.name,
    slug: { _type: "slug", current: uniqueSlug(parsed.data.name) },
    ...(parsed.data.description ? { description: parsed.data.description } : {}),
  });

  await connectToDatabase();
  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "CATALOG_SUBJECT_CREATED",
    entityType: "SanitySubject",
    entityId: doc._id,
    newValue: { name: parsed.data.name },
  });

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/books");
  redirect("/admin/subjects?created=1");
}

export async function createBookAction(formData: FormData) {
  const session = await requireRole([...CATALOG_STAFF_ROLES]);

  const parsed = createBookSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") || undefined,
    isbn: formData.get("isbn"),
    authorIds: formData.getAll("authorIds").filter(Boolean),
    publisherId: formData.get("publisherId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    subjectId: formData.get("subjectId") || undefined,
    edition: formData.get("edition") || undefined,
    publicationYear: formData.get("publicationYear") || undefined,
    language: formData.get("language") || undefined,
    description: formData.get("description") || undefined,
    coverImage: formData.get("coverImage") instanceof File ? (formData.get("coverImage") as File) : undefined,
  });
  if (!parsed.success) {
    redirect(`/admin/books?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const existing = await sanityReadClient.fetch<number>(`count(*[_type == "book" && isbn == $isbn])`, {
    isbn: parsed.data.isbn,
  });
  if (existing > 0) {
    redirect(`/admin/books?error=${encodeURIComponent("A book with this ISBN already exists.")}`);
  }

  const coverImage = await uploadImageIfPresent(parsed.data.coverImage);
  const doc = await sanityWriteClient.create({
    _type: "book",
    title: parsed.data.title,
    slug: { _type: "slug", current: uniqueSlug(parsed.data.title) },
    isbn: parsed.data.isbn,
    authors: parsed.data.authorIds.map((id) => ({
      _type: "reference" as const,
      _ref: id,
      _key: id,
    })),
    ...(parsed.data.subtitle ? { subtitle: parsed.data.subtitle } : {}),
    ...(parsed.data.publisherId ? { publisher: { _type: "reference", _ref: parsed.data.publisherId } } : {}),
    ...(parsed.data.categoryId ? { category: { _type: "reference", _ref: parsed.data.categoryId } } : {}),
    ...(parsed.data.subjectId ? { subject: { _type: "reference", _ref: parsed.data.subjectId } } : {}),
    ...(parsed.data.edition ? { edition: parsed.data.edition } : {}),
    ...(parsed.data.publicationYear ? { publicationYear: parsed.data.publicationYear } : {}),
    ...(parsed.data.language ? { language: parsed.data.language } : {}),
    ...(parsed.data.description ? { description: parsed.data.description } : {}),
    ...(coverImage ? { coverImage } : {}),
  });

  await connectToDatabase();
  await AuditLog.create({
    userId: session.userId,
    role: session.role,
    action: "CATALOG_BOOK_CREATED",
    entityType: "SanityBook",
    entityId: doc._id,
    newValue: { title: parsed.data.title, isbn: parsed.data.isbn },
  });

  revalidatePath("/admin/books");
  redirect("/admin/books?created=1");
}

export async function getBookDetail(sanityBookId: string) {
  // Staff-only: returns every copy's barcode, location and notes.
  await requireRole(["SUPER_ADMIN", "LIBRARIAN", "LIBRARY_STAFF"]);
  sanityBookId = String(sanityBookId);
  const [book, copies] = await Promise.all([
    sanityReadClient.fetch(bookByIdQuery, { id: sanityBookId }),
    (async () => {
      await connectToDatabase();
      return BookCopy.find({ sanityBookId }).sort({ copyId: 1 }).lean();
    })(),
  ]);

  if (!book) return null;
  return { book, copies };
}
