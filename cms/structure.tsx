import type { StructureResolver } from "sanity/structure";
import { Icon } from "@sanity/icons";

function iconFor(symbol: string) {
  return () => <Icon symbol={symbol as any} />;
}

/**
 * Overrides the default "one flat list per type" Studio layout with a single
 * "Catalog" list grouped the way a librarian actually thinks about the collection.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("College Library")
    .items([
      S.listItem()
        .title("Books")
        .icon(iconFor("book"))
        .child(S.documentTypeList("book").title("Books")),
      S.divider(),
      S.listItem()
        .title("Authors")
        .icon(iconFor("user"))
        .child(S.documentTypeList("author").title("Authors")),
      S.listItem()
        .title("Publishers")
        .icon(iconFor("home"))
        .child(S.documentTypeList("publisher").title("Publishers")),
      S.listItem()
        .title("Categories")
        .icon(iconFor("tag"))
        .child(S.documentTypeList("category").title("Categories")),
      S.listItem()
        .title("Subjects")
        .icon(iconFor("document-text"))
        .child(S.documentTypeList("subject").title("Subjects")),
    ]);
