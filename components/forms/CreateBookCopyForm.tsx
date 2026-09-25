"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { createBookCopySchema, CreateBookCopyInput } from "@/validators/transactions";
import { createBookCopyAction } from "@/lib/actions/bookCopies";

type BookOption = { _id: string; title: string; isbn: string };

export function CreateBookCopyForm({ books }: { books: BookOption[] }) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBookCopyInput>({ resolver: zodResolver(createBookCopySchema) });

  const onSubmit = (values: CreateBookCopyInput) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => value && formData.set(key, String(value)));
    startTransition(() => {
      createBookCopyAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
      <div>
        <label className="text-xs text-slate-500">Which book is this a copy of?</label>
        <select
          {...register("sanityBookId")}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Select a book from the catalog…
          </option>
          {books.map((b) => (
            <option key={b._id} value={b._id}>
              {b.title} ({b.isbn})
            </option>
          ))}
        </select>
        {errors.sanityBookId && <p className="mt-1 text-xs text-red-600">{errors.sanityBookId.message}</p>}
        {books.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            No books in the catalog yet — add one on the Books page first.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-slate-500">Barcode / QR Number</label>
          <input
            {...register("barcode")}
            placeholder="Type the number printed on your QR sticker"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Your QR stickers are printed outside the system — whatever number is on the sticker you're going to
            stick on this book, type that exact number here. That's the number the counter will scan/match later.
          </p>
          {errors.barcode && <p className="mt-1 text-xs text-red-600">{errors.barcode.message}</p>}
        </div>
        <div>
          <input
            {...register("copyId")}
            placeholder="Copy ID (e.g. DBMS-4521)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {errors.copyId && <p className="mt-1 text-xs text-red-600">{errors.copyId.message}</p>}
        </div>
        <div>
          <input
            {...register("accessionNumber")}
            placeholder="Accession Number"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {errors.accessionNumber && <p className="mt-1 text-xs text-red-600">{errors.accessionNumber.message}</p>}
        </div>
        <input {...register("condition")} placeholder="Condition (e.g. New, Good)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <div className="flex gap-3">
          <input {...register("rackId")} placeholder="Rack" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input {...register("shelfId")} placeholder="Shelf" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add copy"}
      </button>
    </form>
  );
}
