/**
 * Seeds demo data into MongoDB: a Super Admin + Librarian account, sample students across
 * a few departments, sample book copies (against placeholder Sanity book IDs — create real
 * books in Sanity Studio separately and swap the IDs in), and library settings.
 *
 * Run with: npm run seed — that script passes --env-file=.env.local so MONGODB_URI etc.
 * are actually loaded (plain `tsx scripts/seed.ts` will NOT see .env.local on its own).
 */
import dns from "node:dns";
// Node's own DNS resolver (used internally for mongodb+srv:// SRV lookups) has a known
// bug on Windows where it ignores the OS network adapter's configured DNS servers and
// fails with `querySrv ECONNREFUSED`, even when the OS-level DNS is set correctly. This
// forces Node itself to use Google DNS for this process, sidestepping that entirely.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import User from "../models/User";
import Student from "../models/Student";
import BookCopy from "../models/BookCopy";
import LibrarySettings from "../models/LibrarySettings";
import { hashPassword } from "../lib/auth/password";

const DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electrical Engineering",
  "Electronics & Communication",
  "Management",
];

// Placeholder Sanity book IDs — replace with real _id values once books exist in Sanity Studio.
const SAMPLE_BOOKS = [
  { sanityBookId: "seed-book-dbms", title: "Database Management Systems", copies: 3 },
  { sanityBookId: "seed-book-dsa", title: "Data Structures & Algorithms", copies: 4 },
  { sanityBookId: "seed-book-os", title: "Operating System Concepts", copies: 2 },
  { sanityBookId: "seed-book-networks", title: "Computer Networks", copies: 2 },
  { sanityBookId: "seed-book-compilers", title: "Compilers: Principles, Techniques, and Tools", copies: 2 },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log("Connected. Seeding…");

  await LibrarySettings.findOneAndUpdate(
    {},
    { $setOnInsert: { libraryName: "College Central Library" } },
    { upsert: true }
  );

  const adminPassword = await hashPassword("Admin@123");
  const admin = await User.findOneAndUpdate(
    { email: "admin@library.local" },
    { role: "SUPER_ADMIN", email: "admin@library.local", passwordHash: adminPassword, name: "Super Admin", status: "ACTIVE" },
    { upsert: true, new: true }
  );

  const librarianPassword = await hashPassword("Librarian@123");
  await User.findOneAndUpdate(
    { email: "librarian@library.local" },
    { role: "LIBRARIAN", email: "librarian@library.local", passwordHash: librarianPassword, name: "Head Librarian", status: "ACTIVE" },
    { upsert: true, new: true }
  );

  console.log("Admin login: admin@library.local / Admin@123");
  console.log("Librarian login: librarian@library.local / Librarian@123");

  for (let i = 1; i <= 10; i++) {
    const studentId = `STU-2026-${1000 + i}`;
    const libraryId = `LIB-${1000 + i}`;
    const existing = await Student.findOne({ studentId });
    if (existing) continue;

    const password = await hashPassword(libraryId); // matches createStudentAction's default
    const user = await User.create({
      role: "STUDENT",
      email: `student${i}@college.local`,
      passwordHash: password,
      name: `Demo Student ${i}`,
      status: "ACTIVE",
    });

    const student = await Student.create({
      userId: user._id,
      studentId,
      libraryId,
      enrollmentNo: `ENR${2026000 + i}`,
      name: `Demo Student ${i}`,
      email: `student${i}@college.local`,
      phone: `98765${String(10000 + i).slice(1)}`,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      course: "B.Tech",
      semester: (i % 8) + 1,
      academicYear: "2026-27",
      status: "ACTIVE",
    });

    user.studentProfile = student._id;
    await user.save();
  }
  console.log("10 demo students created (Library ID doubles as their password).");

  let copyCounter = 1;
  for (const book of SAMPLE_BOOKS) {
    for (let c = 0; c < book.copies; c++) {
      const copyId = `${book.sanityBookId.toUpperCase()}-${String(copyCounter).padStart(4, "0")}`;
      const exists = await BookCopy.findOne({ copyId });
      if (!exists) {
        await BookCopy.create({
          copyId,
          sanityBookId: book.sanityBookId,
          barcode: `BC${100000 + copyCounter}`,
          accessionNumber: `ACC${100000 + copyCounter}`,
          status: "AVAILABLE",
          location: { rackId: "A-12", shelfId: "04" },
          condition: "Good",
          acquisitionDate: new Date(),
        });
      }
      copyCounter++;
    }
  }
  console.log(`${copyCounter - 1} demo book copies created across ${SAMPLE_BOOKS.length} titles.`);

  console.log("Seed complete.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
