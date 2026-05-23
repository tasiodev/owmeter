"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import type { AdminUserWithProjects } from "@/domain/repositories/IUserRepository";

type Props = {
  users: AdminUserWithProjects[];
  initialSearch: string;
};

export function AdminUsersList({ users, initialSearch }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [pending, startTransition] = useTransition();
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSearch(value: string) {
    setSearch(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("search", value.trim());
      router.replace(`/dashboard/admin/users${params.size ? `?${params}` : ""}`);
    });
  }

  async function callAction(key: string, url: string, method: string) {
    setActionPending(key);
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      const res = await fetch(url, { method });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrors((e) => ({ ...e, [key]: body.error ?? "Error" }));
      } else {
        router.refresh();
      }
    } catch {
      setErrors((e) => ({ ...e, [key]: "Network error" }));
    } finally {
      setActionPending(null);
    }
  }

  function banUser(userId: string) {
    callAction(`ban-${userId}`, `/api/admin/users/${userId}/ban`, "POST");
  }

  function unbanUser(userId: string) {
    callAction(`unban-${userId}`, `/api/admin/users/${userId}/unban`, "POST");
  }

  function deleteProject(projectId: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    callAction(`del-${projectId}`, `/api/admin/projects/${projectId}`, "DELETE");
  }

  function triggerScan(projectId: string) {
    callAction(`scan-${projectId}`, `/api/admin/projects/${projectId}/scan`, "POST");
  }

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.name ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600"
        />
        {pending && <span className="text-xs text-gray-500">Loading…</span>}
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-500">No users found.</p>
      )}

      <div className="space-y-4">
        {filtered.map((user) => (
          <div
            key={user.id}
            className={`rounded-xl border p-4 space-y-3 ${
              user.bannedAt ? "border-red-900 bg-red-950/20" : "border-gray-800 bg-gray-900/40"
            }`}
          >
            {/* User header */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {user.name ?? "(no name)"}
                  </span>
                  {user.bannedAt && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-900 text-red-300 shrink-0">
                      BANNED
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{user.email}</span>
                <span className="block text-xs text-gray-600 mt-0.5">
                  Joined {new Date(user.createdAt).toLocaleDateString()}
                  {user.bannedAt && (
                    <> · Banned {new Date(user.bannedAt).toLocaleDateString()}</>
                  )}
                </span>
              </div>

              <div className="flex gap-2 shrink-0">
                {user.bannedAt ? (
                  <ActionButton
                    label="Unban"
                    actionKey={`unban-${user.id}`}
                    pendingKey={actionPending}
                    error={errors[`unban-${user.id}`]}
                    variant="green"
                    onClick={() => unbanUser(user.id)}
                  />
                ) : (
                  <ActionButton
                    label="Ban"
                    actionKey={`ban-${user.id}`}
                    pendingKey={actionPending}
                    error={errors[`ban-${user.id}`]}
                    variant="red"
                    onClick={() => banUser(user.id)}
                  />
                )}
              </div>
            </div>

            {/* Projects */}
            {user.projects.length === 0 ? (
              <p className="text-xs text-gray-600">No projects.</p>
            ) : (
              <div className="space-y-2">
                {user.projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-800/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-gray-200 truncate block">{project.name}</span>
                      <span className="text-xs text-gray-500">
                        {project.domain ?? project.type}
                        {project.lastScanScore != null && project.lastScanMaxScore != null ? (
                          <> · Score: <span className="text-amber-400">{project.lastScanScore}/{project.lastScanMaxScore}</span></>
                        ) : (
                          <> · No completed scan</>
                        )}
                      </span>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <ActionButton
                        label="Scan"
                        actionKey={`scan-${project.id}`}
                        pendingKey={actionPending}
                        error={errors[`scan-${project.id}`]}
                        variant="blue"
                        onClick={() => triggerScan(project.id)}
                      />
                      <ActionButton
                        label="Delete"
                        actionKey={`del-${project.id}`}
                        pendingKey={actionPending}
                        error={errors[`del-${project.id}`]}
                        variant="red"
                        onClick={() => deleteProject(project.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type ActionButtonProps = {
  label: string;
  actionKey: string;
  pendingKey: string | null;
  error?: string;
  variant: "red" | "green" | "blue";
  onClick: () => void;
};

const variantClasses: Record<ActionButtonProps["variant"], string> = {
  red: "border-red-900 text-red-400 hover:border-red-600 hover:text-red-300",
  green: "border-green-900 text-green-400 hover:border-green-600 hover:text-green-300",
  blue: "border-blue-900 text-blue-400 hover:border-blue-600 hover:text-blue-300",
};

function ActionButton({ label, actionKey, pendingKey, error, variant, onClick }: ActionButtonProps) {
  const isLoading = pendingKey === actionKey;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={onClick}
        disabled={pendingKey !== null}
        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 ${variantClasses[variant]}`}
      >
        {isLoading ? "…" : label}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
