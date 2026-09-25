// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateStudentForm } from "@/components/forms/CreateStudentForm";

// The form calls a real Server Action on submit; replace it with a spy so this test
// exercises only the client-side RHF+Zod validation, not actual database code.
const createStudentAction = vi.fn();
vi.mock("@/lib/actions/students", () => ({
  createStudentAction: (...args: unknown[]) => createStudentAction(...args),
}));

describe("CreateStudentForm", () => {
  it("shows validation errors and does not submit when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<CreateStudentForm />);

    await user.click(screen.getByRole("button", { name: /create student/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/required|invalid/i).length).toBeGreaterThan(0);
    });
    expect(createStudentAction).not.toHaveBeenCalled();
  });

  it("submits once every field is validly filled in", async () => {
    const user = userEvent.setup();
    render(<CreateStudentForm />);

    await user.type(screen.getByPlaceholderText("Full name"), "Test Student");
    await user.type(screen.getByPlaceholderText("Student ID"), "STU-9999");
    await user.type(screen.getByPlaceholderText("Library ID"), "LIB-9999");
    await user.type(screen.getByPlaceholderText("Enrollment No."), "ENR9999");
    await user.type(screen.getByPlaceholderText("Email"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Phone"), "9876543210");
    await user.type(screen.getByPlaceholderText("Department"), "Computer Science");
    await user.type(screen.getByPlaceholderText("Course"), "B.Tech");
    await user.type(screen.getByPlaceholderText("Semester"), "3");
    await user.type(screen.getByPlaceholderText(/Academic Year/), "2026-27");

    await user.click(screen.getByRole("button", { name: /create student/i }));

    await waitFor(() => expect(createStudentAction).toHaveBeenCalledTimes(1));
  });
});
