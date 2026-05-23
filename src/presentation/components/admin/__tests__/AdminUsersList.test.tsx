import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminUsersList } from "../AdminUsersList";
import type { AdminUserWithProjects } from "@/domain/repositories/IUserRepository";

const now = new Date("2025-01-15T10:00:00Z");

function makeUser(overrides: Partial<AdminUserWithProjects> = {}): AdminUserWithProjects {
  return {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    image: null,
    bannedAt: null,
    createdAt: now,
    projects: [],
    ...overrides,
  };
}

function makeProject(overrides = {}) {
  return {
    id: "proj-1",
    name: "My Website",
    domain: "example.com",
    type: "WEBSITE",
    createdAt: now,
    lastScanScore: 78,
    lastScanMaxScore: 100,
    lastScanAt: now,
    ...overrides,
  };
}

describe("AdminUsersList", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("renders user name and email", () => {
    render(<AdminUsersList users={[makeUser()]} initialSearch="" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows 'No users found' when list is empty", () => {
    render(<AdminUsersList users={[]} initialSearch="" />);
    expect(screen.getByText(/No users found/i)).toBeInTheDocument();
  });

  it("renders BANNED badge for banned users", () => {
    render(<AdminUsersList users={[makeUser({ bannedAt: now })]} initialSearch="" />);
    expect(screen.getByText("BANNED")).toBeInTheDocument();
  });

  it("shows Unban button for banned user, Ban button for active user", () => {
    render(
      <AdminUsersList
        users={[makeUser({ bannedAt: now }), makeUser({ id: "user-2", email: "bob@example.com", name: "Bob" })]}
        initialSearch=""
      />
    );
    expect(screen.getByRole("button", { name: "Unban" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ban" })).toBeInTheDocument();
  });

  it("renders project name and score", () => {
    render(
      <AdminUsersList
        users={[makeUser({ projects: [makeProject()] })]}
        initialSearch=""
      />
    );
    expect(screen.getByText("My Website")).toBeInTheDocument();
    expect(screen.getByText("78/100")).toBeInTheDocument();
  });

  it("shows 'No completed scan' when project has no scan", () => {
    render(
      <AdminUsersList
        users={[makeUser({ projects: [makeProject({ lastScanScore: null, lastScanMaxScore: null, lastScanAt: null })] })]}
        initialSearch=""
      />
    );
    expect(screen.getByText(/No completed scan/i)).toBeInTheDocument();
  });

  it("renders Scan and Delete buttons for each project", () => {
    render(
      <AdminUsersList
        users={[makeUser({ projects: [makeProject()] })]}
        initialSearch=""
      />
    );
    expect(screen.getByRole("button", { name: "Scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls ban API and refreshes on Ban click", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));

    render(<AdminUsersList users={[makeUser()]} initialSearch="" />);
    await user.click(screen.getByRole("button", { name: "Ban" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/users/user-1/ban", { method: "POST" })
    );
  });

  it("calls unban API on Unban click", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));

    render(<AdminUsersList users={[makeUser({ bannedAt: now })]} initialSearch="" />);
    await user.click(screen.getByRole("button", { name: "Unban" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/users/user-1/unban", { method: "POST" })
    );
  });

  it("shows error message when ban API fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Cannot ban an admin" }),
      })
    );

    render(<AdminUsersList users={[makeUser()]} initialSearch="" />);
    await user.click(screen.getByRole("button", { name: "Ban" }));

    await waitFor(() =>
      expect(screen.getByText("Cannot ban an admin")).toBeInTheDocument()
    );
  });

  it("calls delete API with DELETE method after confirmation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));

    render(
      <AdminUsersList
        users={[makeUser({ projects: [makeProject()] })]}
        initialSearch=""
      />
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/projects/proj-1", { method: "DELETE" })
    );
  });

  it("does not call delete API when user cancels confirmation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    vi.stubGlobal("fetch", vi.fn());

    render(
      <AdminUsersList
        users={[makeUser({ projects: [makeProject()] })]}
        initialSearch=""
      />
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls scan API on Scan click", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ scanId: "s-1", status: "queued" }) })
    );

    render(
      <AdminUsersList
        users={[makeUser({ projects: [makeProject()] })]}
        initialSearch=""
      />
    );
    await user.click(screen.getByRole("button", { name: "Scan" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/projects/proj-1/scan", { method: "POST" })
    );
  });

  it("filters users client-side by initialSearch value", () => {
    render(
      <AdminUsersList
        users={[makeUser(), makeUser({ id: "user-2", name: "Bob", email: "bob@example.com" })]}
        initialSearch="bob"
      />
    );
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows user count", () => {
    render(
      <AdminUsersList
        users={[makeUser(), makeUser({ id: "user-2", name: "Bob", email: "bob@example.com" })]}
        initialSearch=""
      />
    );
    expect(screen.getByText("2 users")).toBeInTheDocument();
  });
});
