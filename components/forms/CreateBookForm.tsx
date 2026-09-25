"use client";

import { useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBookSchema, CreateBookInput } from "@/validators/catalog";
import { createBookAction } from "@/lib/actions/catalog";

type Option = { _id: string; name: string };

const CLIENT_FIELDS = createBookSchema.pick({
  title: true,
  subtitle: true,
  isbn: true,
  authorIds: true,
  publisherId: true,
  categoryId: true,
  subjectId: true,
  edition: true,
  publicationYear: true,
  language: true,
  description: true,
});

type ClientInput = Pick<
  CreateBookInput,
  | "title"
  | "subtitle"
  | "isbn"
  | "authorIds"
  | "publisherId"
  | "categoryId"
  | "subjectId"
  | "edition"
  | "publicationYear"
  | "language"
  | "description"
>;

export function CreateBookForm({
  authors,
  publishers,
  categories,
  subjects,
}: {
  authors: Option[];
  publishers: Option[];
  categories: Option[];
  subjects: Option[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientInput>({ resolver: zodResolver(CLIENT_FIELDS) });

  const onSubmit = () => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(() => {
      createBookAction(formData);
    });
  };

  if (authors.length === 0) {
    return (
      <p className="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
        Add at least one author first — every book needs one.
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <input
          {...register("title")}
          placeholder="Title"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
      </div>
      <div className="col-span-2">
        <input
          {...register("subtitle")}
          placeholder="Subtitle (optional)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <input
          {...register("isbn")}
          placeholder="ISBN"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.isbn && <p className="mt-1 text-xs text-red-600">{errors.isbn.message}</p>}
      </div>
      <div>
        <input
          type="number"
          {...register("publicationYear")}
          placeholder="Publication year"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="col-span-2">
        <label className="mb-1 block text-xs text-slate-500">
          Authors (ctrl/cmd-click to choose more than one)
        </label>
        <select
          multiple
          {...register("authorIds")}
          className="h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {authors.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name}
            </option>
          ))}
        </select>
        {errors.authorIds && <p className="mt-1 text-xs text-red-600">{errors.authorIds.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Publisher</label>
        <select {...register("publisherId")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">— None —</option>
          {publishers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Category</label>
        <select {...register("categoryId")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Subject</label>
        <select {...register("subjectId")} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">— None —</option>
          {subjects.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <input
          {...register("edition")}
          placeholder="Edition (optional)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <input
          {...register("language")}
          placeholder="Language (optional)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="col-span-2">
        <textarea
          {...register("description")}
          placeholder="Description (optional)"
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Cover image (optional)</label>
        <input type="file" name="coverImage" accept="image/*" className="w-full text-sm" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Add & publish to catalog"}
      </button>
    </form>
  );
}
