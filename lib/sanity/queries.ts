import { groq } from "next-sanity";

export const bookByIdQuery = groq`
  *[_type == "book" && _id == $id][0]{
    _id, title, subtitle, isbn, edition, publicationYear, language, description,
    "coverUrl": coverImage.asset->url,
    "authors": authors[]->{ _id, name, slug },
    "publisher": publisher->{ _id, name },
    "category": category->{ _id, name },
    "subject": subject->{ _id, name }
  }
`;

export const bookSearchQuery = groq`
  *[_type == "book" && (
    title match $term + "*" ||
    isbn match $term + "*" ||
    $term in authors[]->name
  )] | order(title asc) [$start...$end]{
    _id, title, isbn, "coverUrl": coverImage.asset->url,
    "authors": authors[]->name, "category": category->name
  }
`;

export const bookCountQuery = groq`
  count(*[_type == "book" && (
    title match $term + "*" ||
    isbn match $term + "*" ||
    $term in authors[]->name
  )])
`;

/* ---------------------------------------------------------------------- */
/* Catalog reference lists — used by the admin "Add" forms (select boxes) */
/* and by the Authors/Publishers/Categories/Subjects admin list pages.    */
/* ---------------------------------------------------------------------- */

export const authorListQuery = groq`
  *[_type == "author"] | order(name asc) {
    _id, name, bio, "photoUrl": photo.asset->url, "bookCount": count(*[_type == "book" && references(^._id)])
  }
`;

export const publisherListQuery = groq`
  *[_type == "publisher"] | order(name asc) {
    _id, name, address, "logoUrl": logo.asset->url, "bookCount": count(*[_type == "book" && references(^._id)])
  }
`;

export const categoryListQuery = groq`
  *[_type == "category"] | order(name asc) {
    _id, name, description, "bookCount": count(*[_type == "book" && references(^._id)])
  }
`;

export const subjectListQuery = groq`
  *[_type == "subject"] | order(name asc) {
    _id, name, description, "bookCount": count(*[_type == "book" && references(^._id)])
  }
`;

/** Lightweight id+name lists for populating <select> options in the create-book form. */
export const authorOptionsQuery = groq`*[_type == "author"] | order(name asc) { _id, name }`;
export const publisherOptionsQuery = groq`*[_type == "publisher"] | order(name asc) { _id, name }`;
export const categoryOptionsQuery = groq`*[_type == "category"] | order(name asc) { _id, name }`;
export const subjectOptionsQuery = groq`*[_type == "subject"] | order(name asc) { _id, name }`;
