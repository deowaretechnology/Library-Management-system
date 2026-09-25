"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { createStudentSchema, CreateStudentInput } from "@/validators/transactions";
import { createStudentAction } from "@/lib/actions/students";

const FIELDS: { name: keyof CreateStudentInput; label: string; type?: string }[] = [
  { name: "name", label: "Full name" },
  { name: "studentId", label: "Student ID" },
  { name: "libraryId", label: "Library ID" },
  { name: "enrollmentNo", label: "Enrollment No." },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "department", label: "Department" },
  { name: "course", label: "Course" },
  { name: "semester", label: "Semester", type: "number" },
  { name: "academicYear", label: "Academic Year (e.g. 2026-27)" },
];

export function CreateStudentForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateStudentInput>({
    resolver: zodResolver(createStudentSchema),
  });

  const onSubmit = (values: CreateStudentInput) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => formData.set(key, String(value)));
    startTransition(() => {
      createStudentAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-2 gap-3">
      {FIELDS.map((field) => (
        <div key={field.name}>
          <input
            {...register(field.name, field.type === "number" ? { valueAsNumber: true } : undefined)}
            type={field.type ?? "text"}
            placeholder={field.label}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {errors[field.name] && (
            <p className="mt-1 text-xs text-red-600">{errors[field.name]?.message as string}</p>
          )}
        </div>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create student (default password = Library ID)"}
      </button>
    </form>
  );
}
