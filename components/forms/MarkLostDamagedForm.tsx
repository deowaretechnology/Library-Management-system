"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { markLostDamagedSchema, MarkLostDamagedInput } from "@/validators/transactions";
import { markLostOrDamagedAction } from "@/lib/actions/bookCopies";

export function MarkLostDamagedForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MarkLostDamagedInput>({ resolver: zodResolver(markLostDamagedSchema) });

  const onSubmit = (values: MarkLostDamagedInput) => {
    const formData = new FormData();
    formData.set("barcode", values.barcode);
    formData.set("status", values.status);
    if (values.notes) formData.set("notes", values.notes);
    startTransition(() => {
      markLostOrDamagedAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="col-span-2">
        <input {...register("barcode")} placeholder="Copy barcode" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        {errors.barcode && <p className="mt-1 text-xs text-red-600">{errors.barcode.message}</p>}
      </div>
      <div>
        <select {...register("status")} defaultValue="" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="" disabled>Status…</option>
          <option value="LOST">Lost</option>
          <option value="DAMAGED">Damaged</option>
          <option value="REPAIR">Needs repair</option>
        </select>
        {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status.message}</p>}
      </div>
      <input {...register("notes")} placeholder="Notes" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark copy"}
      </button>
    </form>
  );
}
