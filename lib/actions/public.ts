"use server";

import { connectToDatabase } from "@/lib/db/mongodb";
import { sanityReadClient } from "@/lib/sanity/client";
import Student from "@/models/Student";
import BookCopy from "@/models/BookCopy";
import LibraryVisit from "@/models/LibraryVisit";

export async function getLibraryStats() {
  await connectToDatabase();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [titleCount, categoryCount, studentCount, copyCount, visitsToday] = await Promise.all([
    sanityReadClient.fetch<number>(`count(*[_type == "book"])`).catch(() => 0),
    sanityReadClient.fetch<number>(`count(*[_type == "category"])`).catch(() => 0),
    Student.countDocuments({}),
    BookCopy.countDocuments({}),
    LibraryVisit.countDocuments({ entryDate: { $gte: startOfToday } }),
  ]);

  return { titleCount, categoryCount, studentCount, copyCount, visitsToday };
}

export type FeaturedBook = {
  _id: string;
  title: string;
  authors?: string[];
  category?: string;
  coverUrl?: string;
};

export async function getFeaturedBooks(limit = 6): Promise<FeaturedBook[]> {
  const books = await sanityReadClient.fetch<FeaturedBook[]>(
    `*[_type == "book"] | order(title asc) [0...$limit]{
      _id, title, "authors": authors[]->name, "category": category->name,
      "coverUrl": coverImage.asset->url
    }`,
    { limit }
  ).catch(() => []);
  return books;
}
