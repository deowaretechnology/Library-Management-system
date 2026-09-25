"use client";

import { useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAuthorSchema, CreateAuthorInput } from "@/validators/catalog";
import { createAuthorAction } from "@/lib/actions/catalog";

export function CreateAuthorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Pick<CreateAuthorInput, "name" | "bio">>({
    resolver: zodResolver(createAuthorSchema.pick({ name: true, bio: true })),
  });

  const onSubmit = () => {
    if (!formRef.current) return;
    // Built from the live DOM (not from RHF's values) so the file input's File object survives.
    const formData = new FormData(formRef.current);
    startTransition(() => {
      createAuthorAction(formData);
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <input
          {...register("name")}
          placeholder="Author name"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div className="col-span-2">
        <textarea
          {...register("bio")}
          placeholder="Short bio (optional)"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Photo (optional)</label>
        <input type="file" name="photo" accept="image/*" className="w-full text-sm" />
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
