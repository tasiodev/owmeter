import { unzipSync } from "fflate";

export interface VerificationResult {
  verified: boolean;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

const ASSET_PATHS = ["/favicon.ico", "/robots.txt", "/manifest.json", "/manifest.webmanifest"];

const CONFIG_FILES = [
  "package.json",
  "next.config.js", "next.config.ts", "next.config.mjs", "next.config.cjs",
  "nuxt.config.js", "nuxt.config.ts",
  "vite.config.js", "vite.config.ts",
  "vercel.json",
  "netlify.toml",
  ".env.example",
  "README.md", "readme.md",
];

function stripRootPrefix(files: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const keys = Object.keys(files);
  if (keys.length === 0) return files;
  const firstSlash = keys[0].indexOf("/");
  if (firstSlash === -1) return files;
  const prefix = keys[0].slice(0, firstSlash + 1);
  if (!keys.every((k) => k.startsWith(prefix))) return files;
  const stripped: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) {
    stripped[k.slice(prefix.length)] = v;
  }
  return stripped;
}

function findInZip(
  files: Record<string, Uint8Array>,
  candidates: string[]
): string | undefined {
  for (const candidate of candidates) {
    const key = Object.keys(files).find(
      (k) => k === candidate || k.endsWith(`/${candidate}`)
    );
    if (key) return key;
  }
  return undefined;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function detectFrameworkFromHeaders(detectedFramework?: string | null): string | null {
  if (!detectedFramework) return null;
  return detectedFramework.toLowerCase();
}

export async function verifyCodeMatchesSite(
  zipBuffer: Uint8Array,
  targetUrl: string,
  detectedFramework?: string | null
): Promise<VerificationResult> {
  const rawFiles = unzipSync(zipBuffer);
  const files = stripRootPrefix(rawFiles);
  const domain = new URL(targetUrl).hostname;
  const reasons: string[] = [];
  let strongMatch = false;
  let mediumMatchCount = 0;

  // STRONG Strategy 1: byte-compare static assets
  for (const assetPath of ASSET_PATHS) {
    const zipCandidates = [
      `public${assetPath}`,
      `static${assetPath}`,
      assetPath.slice(1),
    ];
    const zipKey = findInZip(files, zipCandidates);
    if (!zipKey) continue;

    const liveBytes = await fetchBytes(`${targetUrl.replace(/\/$/, "")}${assetPath}`);
    if (!liveBytes) continue;

    const zipBytes = files[zipKey];
    if (arraysEqual(liveBytes, zipBytes)) {
      strongMatch = true;
      reasons.push(`STRONG: ${assetPath} bytes match between ZIP and live site`);
      break;
    }
  }

  // STRONG Strategy 2: domain string in config files
  if (!strongMatch) {
    for (const configFile of CONFIG_FILES) {
      const zipKey = findInZip(files, [configFile]);
      if (!zipKey) continue;
      const content = new TextDecoder().decode(files[zipKey]);
      if (content.includes(domain)) {
        strongMatch = true;
        reasons.push(`STRONG: Domain "${domain}" found in ${configFile}`);
        break;
      }
    }
  }

  // MEDIUM Strategy: framework fingerprint
  const framework = detectFrameworkFromHeaders(detectedFramework);
  if (framework) {
    if (framework.includes("next")) {
      const hasNextConfig = Object.keys(files).some((p) =>
        /next\.config\.(js|ts|mjs|cjs)$/.test(p)
      );
      const pkgKey = findInZip(files, ["package.json"]);
      const pkgContent = pkgKey ? new TextDecoder().decode(files[pkgKey]) : "";
      if (hasNextConfig && pkgContent.includes('"next"')) {
        mediumMatchCount++;
        reasons.push("MEDIUM: Next.js detected in headers matches next.config and package.json");
      }
    } else if (framework.includes("nuxt")) {
      const hasNuxtConfig = Object.keys(files).some((p) =>
        /nuxt\.config\.(js|ts)$/.test(p)
      );
      if (hasNuxtConfig) {
        mediumMatchCount++;
        reasons.push("MEDIUM: Nuxt.js detected in headers matches nuxt.config");
      }
    } else if (framework.includes("express")) {
      const pkgKey = findInZip(files, ["package.json"]);
      const pkgContent = pkgKey ? new TextDecoder().decode(files[pkgKey]) : "";
      if (pkgContent.includes('"express"')) {
        mediumMatchCount++;
        reasons.push("MEDIUM: Express.js detected in headers matches package.json");
      }
    }
  }

  if (strongMatch) {
    return { verified: true, confidence: "high", reasons };
  }
  if (mediumMatchCount >= 2) {
    return { verified: true, confidence: "medium", reasons };
  }
  return { verified: false, confidence: "low", reasons };
}
