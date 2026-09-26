"use client";

import { Component, type ReactNode } from "react";

/**
 * Belt-and-suspenders around the AI assistant widget: if anything inside it
 * ever throws during render (a bad response shape, a future bug, etc.), this
 * boundary swallows it and just hides the widget — instead of the error
 * escaping uncaught and taking down the ENTIRE admin/student dashboard to
 * Next.js's blank "Application error" screen. The rest of the page (books,
 * fines, everything the librarian/student actually needs) keeps working
 * either way.
 */
export class AssistantErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("AssistantWidget crashed, hiding it for this session:", error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
