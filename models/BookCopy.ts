import { Schema, model, models } from "mongoose";

export type CopyStatus =
  | "AVAILABLE"
  | "ISSUED"
  | "RESERVED"
  | "LOST"
  | "DAMAGED"
  | "REPAIR"
  | "ARCHIVED";

export interface IBookCopy {
  copyId: string;
  sanityBookId: string; // bridges to the Sanity `book` document — see architecture doc §5
  barcode: string;
  accessionNumber: string;
  status: CopyStatus;
  location: {
    blockId?: string;
    floorId?: string;
    sectionId?: string;
    rackId?: string;
    shelfId?: string;
  };
  condition?: string;
  acquisitionDate: Date;
  purchasePrice?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookCopySchema = new Schema<IBookCopy>(
  {
    copyId: { type: String, required: true, unique: true, trim: true },
    sanityBookId: { type: String, required: true, index: true },
    barcode: { type: String, required: true, unique: true, trim: true },
    accessionNumber: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ["AVAILABLE", "ISSUED", "RESERVED", "LOST", "DAMAGED", "REPAIR", "ARCHIVED"],
      default: "AVAILABLE",
      index: true,
    },
    location: {
      blockId: String,
      floorId: String,
      sectionId: String,
      rackId: String,
      shelfId: String,
    },
    condition: { type: String },
    acquisitionDate: { type: Date, required: true },
    purchasePrice: { type: Number },
    notes: { type: String },
  },
  { timestamps: true }
);

BookCopySchema.index({ sanityBookId: 1, status: 1 });

export default models.BookCopy || model<IBookCopy>("BookCopy", BookCopySchema);
