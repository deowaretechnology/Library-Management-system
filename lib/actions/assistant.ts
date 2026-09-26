"use server";

import { getSession } from "@/lib/auth/session";
import { searchCatalog } from "@/lib/actions/catalog";
import { getDashboardStats, getOverdueTransactions } from "@/lib/actions/dashboard";
import { getStudentDetail } from "@/lib/actions/students";

export type AssistantChatMessage = { role: "user" | "assistant"; content: string };

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

/**
 * The library's AI assistant — answers questions using LIVE data (Sanity book
 * catalog + MongoDB availability/transactions/fines), never invented numbers.
 *
 * Scoping rule (see the widget's floating chat icon on every dashboard):
 *  - Book catalog & availability ("which books do you have", "is X available")
 *    is shown to EVERYONE — students included — same info the /books page
 *    already shows publicly, nothing private about it.
 *  - A STUDENT only ever gets THEIR OWN borrowing/fine data folded in — never
 *    another student's records. Enforced here, not left to the model's
 *    judgement: we simply never fetch or hand it any other student's row.
 *  - Staff (Librarian/Library Staff/Super Admin) get the same library-wide
 *    data their existing dashboard already shows them.
 */
export async function askLibraryAssistant(
  question: string,
  history: AssistantChatMessage[] = []
): Promise<{ answer: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Please sign in first." };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      error:
        "The AI assistant isn't set up yet — an admin needs to add a GEMINI_API_KEY environment variable.",
    };
  }

  const trimmed = question.trim();
  if (!trimmed) return { error: "Ask something first." };
  if (trimmed.length > 500) return { error: "That's a bit long — try a shorter question." };

  // ---- Always-available context: the book catalog + live availability ----
  const { books } = await searchCatalog("", 1, 150);
  const titleByBookId = new Map<string, string>();
  for (const b of books as any[]) titleByBookId.set(b._id, b.title);

  const catalogContext = (books as any[])
    .map(
      (b) =>
        `- "${b.title}" (ISBN ${b.isbn})${b.category ? `, category: ${b.category}` : ""}${
          b.authors?.length ? `, by ${b.authors.join(", ")}` : ""
        } — ${b.availability.available}/${b.availability.total} copies available`
    )
    .join("\n");

  // ---- Role-scoped context ----
  let personalContext = "";
  let scopeNote = "";

  if (session.role === "STUDENT") {
    const detail = session.studentId ? await getStudentDetail(session.studentId) : null;

    if (detail) {
      const { student, activeBorrows, fines } = detail as any;
      const pendingFineTotal = fines
        .filter((f: any) => f.status === "PENDING" || f.status === "PARTIALLY_PAID")
        .reduce((sum: number, f: any) => sum + f.amount, 0);

      personalContext = `Student: ${student.name} (${student.studentId}), department: ${student.department}
Currently borrowed (${activeBorrows.length}):
${
  activeBorrows.length
    ? activeBorrows
        .map((b: any) => {
          const title = titleByBookId.get(b.sanityBookId) ?? "Unknown title";
          const due = new Date(b.dueDate);
          const overdue = due < new Date() ? " — OVERDUE" : "";
          return `- "${title}", due ${due.toLocaleDateString("en-IN")}${overdue}`;
        })
        .join("\n")
    : "None"
}
Pending fines: ₹${pendingFineTotal}`;
    } else {
      personalContext = "No student record found for this account.";
    }

    scopeNote =
      "You are answering a STUDENT. Only THEIR OWN data is included below — you have no access to any other student's records, fines, or borrowing history, and must never guess or make up such data. If asked about another student, say you can only help with their own account.";
  } else {
    const [stats, overdue] = await Promise.all([getDashboardStats(), getOverdueTransactions()]);

    personalContext = `Library-wide stats:
- Total students: ${stats.totalStudents}
- Total book copies: ${stats.totalCopies} (available: ${stats.availableCopies}, issued: ${stats.issuedCopies})
- Overdue right now: ${stats.overdueCount}
- Lost/damaged copies: ${stats.lostDamagedCount}
- Pending fines (total): ₹${stats.pendingFineTotal}
- Currently inside the library: ${stats.currentlyInside}

Overdue students (${overdue.length}, most overdue first):
${
  overdue.length
    ? (overdue as any[])
        .slice(0, 25)
        .map((o) => {
          const title = titleByBookId.get(o.sanityBookId) ?? "Unknown title";
          return `- ${o.studentId?.name ?? "Unknown"} (${o.studentId?.studentId ?? "?"}) — "${title}", due ${new Date(
            o.dueDate
          ).toLocaleDateString("en-IN")}`;
        })
        .join("\n")
    : "None"
}`;

    scopeNote = `You are answering ${session.role} staff — they have full library-wide access in the real dashboard, so the data below reflects that.`;
  }

  const systemPrompt = `You are the College Library's AI assistant, embedded in the library management system's dashboard. Answer ONLY using the data given below — never invent book titles, numbers, names, or availability counts. If the data below doesn't cover the question, say so plainly instead of guessing. Keep answers short and conversational. Match the language/style of the question (Hindi, Hinglish, or English).

${scopeNote}

BOOK CATALOG (visible to everyone):
${catalogContext || "No books in the catalog yet."}

${session.role === "STUDENT" ? "THIS STUDENT'S OWN DATA:" : "LIBRARY DATA:"}
${personalContext}`;

  try {
    const contents = [
      ...history.slice(-6).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: trimmed }] },
    ];

    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
    });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    // Gemini occasionally returns 503 ("model overloaded") / 429 (rate limited)
    // for a moment under load — these are transient, so retry a couple of times
    // with a short backoff before giving up, instead of failing the user's
    // question on the first blip.
    let res: Response | null = null;
    let lastBody = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      if (res.ok) break;
      if (res.status !== 503 && res.status !== 429) break;
      lastBody = await res.text().catch(() => "");
      if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }

    if (!res!.ok) {
      const body = lastBody || (await res!.text().catch(() => ""));
      console.error("Gemini API error:", res!.status, body);
      if (res!.status === 503 || res!.status === 429) {
        return {
          error: "The AI service is busy right now — please try that question again in a few seconds.",
        };
      }
      return { error: "The assistant couldn't reach the AI service right now — try again in a moment." };
    }

    const data = await res!.json();
    const answer: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answer) {
      return { error: "The assistant didn't return an answer — try rephrasing your question." };
    }

    return { answer: answer.trim() };
  } catch (err) {
    console.error("Assistant error:", err);
    return { error: "Something went wrong reaching the AI assistant." };
  }
}
