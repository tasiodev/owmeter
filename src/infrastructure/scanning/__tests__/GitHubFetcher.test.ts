import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchGitHubRepoAsZip, parseGitHubUrl, GitHubFetchError } from "../GitHubFetcher";

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

describe("parseGitHubUrl", () => {
  it("parses a valid github.com URL", () => {
    const { owner, repo } = parseGitHubUrl("https://github.com/owner/my-repo");
    expect(owner).toBe("owner");
    expect(repo).toBe("my-repo");
  });

  it("strips .git suffix from repo name", () => {
    const { repo } = parseGitHubUrl("https://github.com/owner/my-repo.git");
    expect(repo).toBe("my-repo");
  });

  it("accepts URLs with trailing slash", () => {
    const { owner, repo } = parseGitHubUrl("https://github.com/owner/repo/");
    expect(owner).toBe("owner");
    expect(repo).toBe("repo");
  });

  it("throws GitHubFetchError for non-github.com URLs", () => {
    expect(() => parseGitHubUrl("https://gitlab.com/owner/repo")).toThrow(GitHubFetchError);
  });

  it("throws GitHubFetchError for plain strings", () => {
    expect(() => parseGitHubUrl("not-a-url")).toThrow(GitHubFetchError);
  });
});

describe("fetchGitHubRepoAsZip", () => {
  it("returns Uint8Array for a repo with main branch", async () => {
    const fakeZip = new Uint8Array([80, 75, 3, 4]); // PK zip magic bytes
    mockFetch({ "/main.zip": { ok: true, bytes: fakeZip } });

    const result = await fetchGitHubRepoAsZip("https://github.com/owner/repo");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(fakeZip.length);
  });

  it("falls back to master branch when main returns 404", async () => {
    const fakeZip = new Uint8Array([80, 75, 3, 4]);
    mockFetch({
      "/main.zip": { ok: false },
      "/master.zip": { ok: true, bytes: fakeZip },
    });

    const result = await fetchGitHubRepoAsZip("https://github.com/owner/repo");
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("throws GitHubFetchError when both main and master 404", async () => {
    mockFetch({
      "/main.zip": { ok: false },
      "/master.zip": { ok: false },
    });

    await expect(fetchGitHubRepoAsZip("https://github.com/owner/repo")).rejects.toThrow(
      GitHubFetchError
    );
  });

  it("throws GitHubFetchError when repo exceeds 50 MB", async () => {
    const BIG = 50 * 1024 * 1024 + 1;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => String(BIG) },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(BIG)),
      })
    );

    await expect(fetchGitHubRepoAsZip("https://github.com/owner/repo")).rejects.toThrow(
      GitHubFetchError
    );
  });

  it("throws GitHubFetchError for invalid URL", async () => {
    await expect(fetchGitHubRepoAsZip("https://notgithub.com/owner/repo")).rejects.toThrow(
      GitHubFetchError
    );
  });
});
