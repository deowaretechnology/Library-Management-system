"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { Wand2 } from "lucide-react";
import { createStaffSchema, CreateStaffInput } from "@/validators/staff";
import { createStaffAction } from "@/lib/actions/staff";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

function generatePassword() {
  let out = "";
  for (let i = 0; i < 12; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)];
  return out;
}

export function CreateStaffForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateStaffInput>({ resolver: zodResolver(createStaffSchema) });

  const password = watch("password");
  const name = watch("name");

  const onSubmit = (values: CreateStaffInput) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => value && formData.set(key, String(value)));
    startTransition(() => {
      createStaffAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input
            {...register("name")}
            placeholder="Full name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <input
            {...register("email")}
            placeholder="Email — used to log in"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <select {...register("role")} defaultValue="" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="" disabled>
              Select a role…
            </option>
            <option value="LIBRARIAN">Librarian — full staff access</option>
            <option value="LIBRARY_STAFF">Library Staff — day-to-day desk work</option>
          </select>
          {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
        </div>
        <div>
          <div className="flex gap-2">
            <input
              {...register("password")}
              type="text"
              placeholder="Starting password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setValue("password", generatePassword(), { shouldValidate: true })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              title="Generate a strong password"
            >
              <Wand2 className="h-3.5 w-3.5" /> Generate
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
      </div>

      {password && (
        <p className="text-[11px] text-amber-700">
          Share this password with {name || "them"} directly (call, message, in person) — it won't be shown again
          after you submit. They can change it anytime from "Change your password" on the login page.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add staff account"}
      </button>
    </form>
  );
}
