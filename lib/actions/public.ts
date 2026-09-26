"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { sanityReadClient } from "@/lib/sanity/client";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";
import LibraryVisit from "@/models/LibraryVisit";
import { startOfIstDay } from "@/lib/domain/dates";

/** Public landing-page numbers. Never throws — a DB hiccup shows zeros, not a crashed homepage. */
export async function getLibraryStats() {
  const [titleCount, categoryCount] = await Promise.all([
    sanityReadClient.fetch<number>(`count(*[_type == "book"])`).catch(() => 0),
    sanityReadClient.fetch<number>(`count(*[_type == "category"])`).catch(() => 0),
  ]);

  try {
    await connectToDatabase();
    const [studentCount, copyCount, visitsToday] = await Promise.all([
      // O(1) metadata counts — this runs for anonymous visitors.
      Student.estimatedDocumentCount(),
      BookCopy.estimatedDocumentCount(),
      LibraryVisit.countDocuments({ entryDate: { $gte: startOfIstDay() } }),
    ]);
    return { titleCount, categoryCount, studentCount, copyCount, visitsToday };
  } catch (err) {
    console.error("[public] library stats unavailable:", err);
    return { titleCount, categoryCount, studentCount: 0, copyCount: 0, visitsToday: 0 };
  }
}

export type FeaturedBook = {
  _id: string;
  title: string;
  authors?: string[];
  category?: string;
  coverUrl?: string;
};

export async function getFeaturedBooks(limit = 6): Promise<FeaturedBook[]> {
  limit = Math.min(24, Math.max(1, Math.floor(Number(limit) || 6)));
  const books = await sanityReadClient.fetch<FeaturedBook[]>(
    `*[_type == "book"] | order(title asc) [0...$limit]{
      _id, title, "authors": authors[]->name, "category": category->name,
      "coverUrl": coverImage.asset->url
    }`,
    { limit }
  ).catch(() => []);
  return books;
}
