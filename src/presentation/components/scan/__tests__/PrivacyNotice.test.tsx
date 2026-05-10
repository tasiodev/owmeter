import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrivacyNotice } from "../PrivacyNotice";

describe("PrivacyNotice", () => {
  it("renders the privacy title", () => {
    render(<PrivacyNotice title="Your code is never stored" desc="It is processed in memory only." />);
    expect(screen.getByText("Your code is never stored")).toBeInTheDocument();
  });

  it("renders the privacy description", () => {
    render(<PrivacyNotice title="Title" desc="Source code is processed in memory." />);
    expect(screen.getByText("Source code is processed in memory.")).toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    render(<PrivacyNotice title="Title" desc="Desc" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
