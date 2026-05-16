import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRepoAsZip, parseRepoUrl, buildVerificationUrls, RepoFetchError } from "../RepoFetcher";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(responses: Record<string, { ok: boolean; bytes?: Uint8Array }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      for (const [pattern, resp] of Object.entries(responses)) {
        if (url.includes(pattern)) {
          if (!resp.ok) return Promise.resolve({ ok: false, status: 404 });
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: {
              get: (h: string) =>
                h === "content-length" ? String(resp.bytes?.byteLength ?? 10) : null,
            },
            arrayBuffer: () =>
              Promise.resolve((resp.bytes ?? new Uint8Array(10)).buffer),
          });
        }
      }
      return Promise.resolve({ ok: false, status: 404 });
    })
  );
}

// ─── parseRepoUrl ─────────────────────────────────────────────────────────────

describe("parseRepoUrl — GitHub", () => {
  it("parses a valid github.com URL", () => {
    const r = parseRepoUrl("https://github.com/owner/my-repo");
    expect(r).toEqual({ provider: "github", namespace: "owner", repo: "my-repo" });
  });

  it("strips .git suffix", () => {
    const r = parseRepoUrl("https://github.com/owner/my-repo.git");
    expect(r.repo).toBe("my-repo");
  });

  it("accepts trailing slash", () => {
    const r = parseRepoUrl("https://github.com/owner/repo/");
    expect(r).toEqual({ provider: "github", namespace: "owner", repo: "repo" });
  });
});

describe("parseRepoUrl — GitLab", () => {
  it("parses a simple gitlab.com URL", () => {
    const r = parseRepoUrl("https://gitlab.com/owner/my-repo");
    expect(r).toEqual({ provider: "gitlab", namespace: "owner", repo: "my-repo" });
  });

  it("parses a nested namespace", () => {
    const r = parseRepoUrl("https://gitlab.com/group/subgroup/my-repo");
    expect(r).toEqual({ provider: "gitlab", namespace: "group/subgroup", repo: "my-repo" });
  });

  it("strips .git suffix", () => {
    expect(parseRepoUrl("https://gitlab.com/owner/repo.git").repo).toBe("repo");
  });
});

describe("parseRepoUrl — Bitbucket", () => {
  it("parses a valid bitbucket.org URL", () => {
    const r = parseRepoUrl("https://bitbucket.org/owner/my-repo");
    expect(r).toEqual({ provider: "bitbucket", namespace: "owner", repo: "my-repo" });
  });

  it("strips .git suffix", () => {
    expect(parseRepoUrl("https://bitbucket.org/owner/repo.git").repo).toBe("repo");
  });
});

describe("parseRepoUrl — errors", () => {
  it("throws for unsupported host", () => {
    expect(() => parseRepoUrl("https://codeberg.org/owner/repo")).toThrow(RepoFetchError);
  });

  it("throws for plain string", () => {
    expect(() => parseRepoUrl("not-a-url")).toThrow(RepoFetchError);
  });

  it("throws for missing repo segment", () => {
    expect(() => parseRepoUrl("https://github.com/owner")).toThrow(RepoFetchError);
  });
});

// ─── buildVerificationUrls ────────────────────────────────────────────────────

describe("buildVerificationUrls", () => {
  it("builds correct raw URLs for GitHub", () => {
    const urls = buildVerificationUrls("https://github.com/owner/repo");
    expect(urls[0].url).toBe("https://raw.githubusercontent.com/owner/repo/main/.owaspchecker");
    expect(urls[1].url).toBe("https://raw.githubusercontent.com/owner/repo/master/.owaspchecker");
  });

  it("builds correct raw URLs for GitLab", () => {
    const urls = buildVerificationUrls("https://gitlab.com/owner/repo");
    expect(urls[0].url).toBe("https://gitlab.com/owner/repo/-/raw/main/.owaspchecker");
  });

  it("builds correct raw URLs for Bitbucket", () => {
    const urls = buildVerificationUrls("https://bitbucket.org/owner/repo");
    expect(urls[0].url).toBe("https://bitbucket.org/owner/repo/raw/main/.owaspchecker");
  });
});

// ─── fetchRepoAsZip ───────────────────────────────────────────────────────────

describe("fetchRepoAsZip — GitHub", () => {
  it("returns Uint8Array for main branch", async () => {
    const fakeZip = new Uint8Array([80, 75, 3, 4]);
    mockFetch({ "/main.zip": { ok: true, bytes: fakeZip } });
    const result = await fetchRepoAsZip("https://github.com/owner/repo");
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("falls back to master branch when main 404s", async () => {
    const fakeZip = new Uint8Array([80, 75, 3, 4]);
    mockFetch({ "/main.zip": { ok: false }, "/master.zip": { ok: true, bytes: fakeZip } });
    const result = await fetchRepoAsZip("https://github.com/owner/repo");
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("throws RepoFetchError when both branches 404", async () => {
    mockFetch({ "/main.zip": { ok: false }, "/master.zip": { ok: false } });
    await expect(fetchRepoAsZip("https://github.com/owner/repo")).rejects.toThrow(RepoFetchError);
  });
});

describe("fetchRepoAsZip — GitLab", () => {
  it("downloads the main branch ZIP", async () => {
    const fakeZip = new Uint8Array([80, 75, 3, 4]);
    mockFetch({ "repo-main.zip": { ok: true, bytes: fakeZip } });
    const result = await fetchRepoAsZip("https://gitlab.com/owner/repo");
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("falls back to master branch ZIP", async () => {
    const fakeZip = new Uint8Array([80, 75, 3, 4]);
    mockFetch({ "repo-main.zip": { ok: false }, "repo-master.zip": { ok: true, bytes: fakeZip } });
    const result = await fetchRepoAsZip("https://gitlab.com/owner/repo");
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

describe("fetchRepoAsZip — Bitbucket", () => {
  it("downloads the main branch ZIP", async () => {
    const fakeZip = new Uint8Array([80, 75, 3, 4]);
    mockFetch({ "/main.zip": { ok: true, bytes: fakeZip } });
    const result = await fetchRepoAsZip("https://bitbucket.org/owner/repo");
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

describe("fetchRepoAsZip — size limit", () => {
  it("throws RepoFetchError when repo exceeds 50 MB (content-length header)", async () => {
    const BIG = 50 * 1024 * 1024 + 1;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => String(BIG) },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      })
    );
    await expect(fetchRepoAsZip("https://github.com/owner/repo")).rejects.toThrow(RepoFetchError);
  });
});
