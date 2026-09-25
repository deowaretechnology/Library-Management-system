import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./cms/schemaTypes";
import { structure } from "./cms/structure";
import { projectId, dataset, apiVersion } from "./cms/env";

export default defineConfig({
  name: "college-library",
  title: "College Library — Catalog",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [
    structureTool({ structure }),
    // Vision lets a librarian/admin run raw GROQ queries against the catalog for debugging.
    visionTool({ defaultApiVersion: apiVersion }),
  ],
  schema: { types: schemaTypes },
});
