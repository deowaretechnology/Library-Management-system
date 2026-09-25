import { defineField, defineType } from "sanity";

export default defineType({
  name: "book",
  title: "Book",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "subtitle", title: "Subtitle", type: "string" }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "isbn", title: "ISBN", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "authors",
      title: "Authors",
      type: "array",
      of: [{ type: "reference", to: [{ type: "author" }] }],
      validation: (r) => r.min(1),
    }),
    defineField({ name: "publisher", title: "Publisher", type: "reference", to: [{ type: "publisher" }] }),
    defineField({ name: "category", title: "Category", type: "reference", to: [{ type: "category" }] }),
    defineField({ name: "subject", title: "Subject", type: "reference", to: [{ type: "subject" }] }),
    defineField({ name: "edition", title: "Edition", type: "string" }),
    defineField({ name: "publicationYear", title: "Publication Year", type: "number" }),
    defineField({ name: "language", title: "Language", type: "string" }),
    defineField({ name: "description", title: "Description", type: "text" }),
    defineField({ name: "coverImage", title: "Cover Image", type: "image", options: { hotspot: true } }),
  ],
  preview: {
    select: { title: "title", subtitle: "isbn", media: "coverImage" },
  },
});
