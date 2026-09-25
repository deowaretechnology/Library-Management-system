"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSubjectSchema, CreateSubjectInput } from "@/validators/catalog";
import { createSubjectAction } from "@/lib/actions/catalog";

export function CreateSubjectForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSubjectInput>({ resolver: zodResolver(createSubjectSchema) });

  const onSubmit = (values: CreateSubjectInput) => {
    const formData = new FormData();
    formData.set("name", values.name);
    if (values.description) formData.set("description", values.description);
    startTransition(() => {
      createSubjectAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <input
          {...register("name")}
          placeholder="Subject name (e.g. Data Structures)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div className="col-span-2">
        <textarea
          {...register("description")}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Add & publish"}
      </button>
    </form>
  );
}
