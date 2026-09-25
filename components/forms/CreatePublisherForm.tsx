"use client";

import { useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPublisherSchema, CreatePublisherInput } from "@/validators/catalog";
import { createPublisherAction } from "@/lib/actions/catalog";

export function CreatePublisherForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Pick<CreatePublisherInput, "name" | "address">>({
    resolver: zodResolver(createPublisherSchema.pick({ name: true, address: true })),
  });

  const onSubmit = () => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(() => {
      createPublisherAction(formData);
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <input
          {...register("name")}
          placeholder="Publisher name"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div className="col-span-2">
        <textarea
          {...register("address")}
          placeholder="Address (optional)"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Logo (optional)</label>
        <input type="file" name="logo" accept="image/*" className="w-full text-sm" />
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
