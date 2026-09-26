"use server";

import { requireSession } from "@/lib/auth/requireRole";
import { rateLimit } from "@/lib/rate-limit";
import { unstable_rethrow } from "next/navigation";
import { searchCatalog } from "@/lib/actions/catalog";
import { getDashboardStats, getOverdueTransactions, getActiveTransactions } from "@/lib/actions/dashboard";
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
  let session;
  try {
    session = await requireSession(); // also rejects deactivated accounts / revoked sessions
  } catch (err) {
    unstable_rethrow(err);
    return { error: "Please sign in first." };
  }

  // Every question costs a Gemini call plus catalog/stat queries — cap it per user so one
  // account (or a script) can't burn the whole AI quota.
  const limited = rateLimit(`ai:${session.userId}`, 15, 60 * 1000);
  if (!limited.allowed) {
    return { error: `You're asking very fast — try again in ${Math.ceil(limited.retryAfterMs / 1000)} seconds.` };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      error:
        "The AI assistant isn't set up yet — an admin needs to add a GEMINI_API_KEY environment variable.",
    };
  }

  const trimmed = String(question ?? "").trim();
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
    const [stats, overdue, active] = await Promise.all([
      getDashboardStats(),
      getOverdueTransactions(200),
      getActiveTransactions(),
    ]);

    const overdueIds = new Set((overdue as any[]).map((o) => String(o._id)));

    personalContext = `Library-wide stats:
- Total students: ${stats.totalStudents}
- Total book copies: ${stats.totalCopies} (available: ${stats.availableCopies}, issued: ${stats.issuedCopies})
- Overdue right now: ${stats.overdueCount}
- Lost/damaged copies: ${stats.lostDamagedCount}
- Pending fines (total): ₹${stats.pendingFineTotal}
- Currently inside the library: ${stats.currentlyInside}

Currently issued books — who has what (${active.length}${active.length >= 60 ? "+, showing most urgent" : ""}):
${
  active.length
    ? (active as any[])
        .map((t) => {
          const title = titleByBookId.get(t.sanityBookId) ?? "Unknown title";
          const overdueTag = overdueIds.has(String(t._id)) ? " — OVERDUE" : "";
          return `- ${t.studentId?.name ?? "Unknown"} (${t.studentId?.studentId ?? "?"}) — "${title}", due ${new Date(
            t.dueDate
          ).toLocaleDateString("en-IN")}${overdueTag}`;
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
    // History comes from the client, so it's untrusted: cap turns and length, and only keep
    // well-formed entries (arbitrary-size fake turns were accepted before).
    const safeHistory = (Array.isArray(history) ? history : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));

    const contents = [
      ...safeHistory.map((m) => ({
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
        // Never let a hung upstream call hold the serverless function open until it's killed.
        signal: AbortSignal.timeout(15000),
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
