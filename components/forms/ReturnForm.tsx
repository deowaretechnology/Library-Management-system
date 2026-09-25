"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { returnBookSchema, ReturnBookInput } from "@/validators/transactions";
import { returnBookFormAction } from "@/lib/actions/transactions";
import { QRScanner } from "@/components/QRScanner";

export function ReturnForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ReturnBookInput>({ resolver: zodResolver(returnBookSchema) });

  const submitBarcode = (barcode: string) => {
    const formData = new FormData();
    formData.set("barcode", barcode.trim());
    startTransition(() => {
      returnBookFormAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit((values) => submitBarcode(values.barcode))} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Copy Barcode</label>
          <QRScanner
            label="Scan Book QR"
            onScan={(text) => {
              setValue("barcode", text, { shouldValidate: true });
              submitBarcode(text);
            }}
          />
        </div>
        <input autoFocus {...register("barcode")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        {errors.barcode && <p className="mt-1 text-xs text-red-600">{errors.barcode.message}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Returning…" : "Return book"}
      </button>
    </form>
  );
}
