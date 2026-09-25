"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { librarySettingsSchema, LibrarySettingsInput } from "@/validators/transactions";
import { updateSettingsAction } from "@/lib/actions/settings";

const NUMBER_FIELDS: { name: keyof LibrarySettingsInput; label: string }[] = [
  { name: "borrowingDurationDays", label: "Borrowing duration (days)" },
  { name: "maxBooksPerStudent", label: "Max books per student" },
  { name: "finePerDay", label: "Fine per day (₹)" },
  { name: "gracePeriodDays", label: "Grace period (days)" },
  { name: "maxRenewals", label: "Max renewals" },
  { name: "maxFineAmount", label: "Max fine amount (₹)" },
];

export function SettingsForm({ defaults }: { defaults: LibrarySettingsInput }) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LibrarySettingsInput>({
    resolver: zodResolver(librarySettingsSchema),
    defaultValues: defaults,
  });

  const onSubmit = (values: LibrarySettingsInput) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (key === "allowRenewal") return; // handled below as a checkbox
      formData.set(key, String(value ?? ""));
    });
    if (values.allowRenewal) formData.set("allowRenewal", "on");
    startTransition(() => {
      updateSettingsAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="col-span-2 text-sm font-medium text-slate-700">
        Library name
        <input {...register("libraryName")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        {errors.libraryName && <p className="mt-1 text-xs text-red-600">{errors.libraryName.message}</p>}
      </label>
      <label className="text-sm font-medium text-slate-700">
        Email
        <input {...register("libraryEmail")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        {errors.libraryEmail && <p className="mt-1 text-xs text-red-600">{errors.libraryEmail.message}</p>}
      </label>
      <label className="text-sm font-medium text-slate-700">
        Phone
        <input {...register("libraryPhone")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="col-span-2 text-sm font-medium text-slate-700">
        Address
        <input {...register("libraryAddress")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>

      {NUMBER_FIELDS.map((field) => (
        <label key={field.name} className="text-sm font-medium text-slate-700">
          {field.label}
          <input
            type="number"
            step="any"
            {...register(field.name, { valueAsNumber: true })}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {errors[field.name] && <p className="mt-1 text-xs text-red-600">{errors[field.name]?.message}</p>}
        </label>
      ))}

      <label className="col-span-2 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" {...register("allowRenewal")} />
        Allow renewals
      </label>

      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
