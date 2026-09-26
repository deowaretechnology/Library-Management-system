import { Schema, model, models } from "mongoose";

export interface ILibrarySettings {
  libraryName: string;
  libraryEmail?: string;
  libraryPhone?: string;
  libraryAddress?: string;
  borrowingDurationDays: number;
  maxBooksPerStudent: number;
  finePerDay: number;
  gracePeriodDays: number;
  allowRenewal: boolean;
  maxRenewals: number;
  maxFineAmount: number;
  /** How long a READY reservation holds a copy before it expires and moves to the next student. */
  reservationHoldDays: number;
  updatedAt: Date;
}

const LibrarySettingsSchema = new Schema<ILibrarySettings>(
  {
    libraryName: { type: String, required: true, default: "College Library" },
    libraryEmail: { type: String },
    libraryPhone: { type: String },
    libraryAddress: { type: String },
    borrowingDurationDays: { type: Number, default: 7 },
    maxBooksPerStudent: { type: Number, default: 3 },
    finePerDay: { type: Number, default: 5 },
    gracePeriodDays: { type: Number, default: 0 },
    allowRenewal: { type: Boolean, default: true },
    maxRenewals: { type: Number, default: 2 },
    maxFineAmount: { type: Number, default: 500 },
    reservationHoldDays: { type: Number, default: 3 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

// Intended to hold exactly one document — fetch with findOne(), never a list.
export default models.LibrarySettings ||
  model<ILibrarySettings>("LibrarySettings", LibrarySettingsSchema);
