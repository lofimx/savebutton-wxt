import { type Config } from "./config";

const DESKTOP_BASE = "http://localhost:21420";
const TIMEOUT_MS = 2000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function isDesktopRunning(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${DESKTOP_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function pushFileToDesktop(
  collection: "anga" | "meta",
  filename: string,
  content: string | ArrayBuffer,
): Promise<void> {
  try {
    const body =
      typeof content === "string" ? new TextEncoder().encode(content) : content;
    await fetchWithTimeout(
      `${DESKTOP_BASE}/${collection}/${encodeURIComponent(filename)}`,
      {
        method: "POST",
        body,
      },
    );
  } catch {
    // Desktop app is optional -- silently ignore failures
  }
}

export async function pushWordsFileToDesktop(
  anga: string,
  filename: string,
  content: string,
): Promise<void> {
  try {
    await fetchWithTimeout(
      `${DESKTOP_BASE}/words/${encodeURIComponent(anga)}/${encodeURIComponent(filename)}`,
      {
        method: "POST",
        body: new TextEncoder().encode(content),
      },
    );
  } catch {
    // Desktop app is optional -- silently ignore failures
  }
}

export async function pushConfigToDesktop(config: Config): Promise<void> {
  try {
    await fetchWithTimeout(`${DESKTOP_BASE}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        server: config.server,
        email: config.email,
      }),
    });
  } catch {
    // Desktop app is optional -- silently ignore failures
  }
}
