import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("wxt/browser", () => ({
  browser: {} as Record<string, unknown>,
}));

import { browser } from "wxt/browser";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  hasNativeWebAuthFlow,
} from "../auth";

describe("generateCodeVerifier", () => {
  it("returns a base64url-encoded string", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("has sufficient length for PKCE (at least 43 chars)", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it("generates unique verifiers", () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });
});

describe("generateCodeChallenge", () => {
  it("returns a base64url-encoded string", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces a different value from the verifier", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).not.toBe(verifier);
  });

  it("produces consistent challenge for the same verifier", async () => {
    const verifier = generateCodeVerifier();
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it("produces known SHA-256 output for a fixed input", async () => {
    // RFC 7636 Appendix B test vector
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("hasNativeWebAuthFlow", () => {
  const anyBrowser = browser as any;

  afterEach(() => {
    delete anyBrowser.identity;
  });

  it("returns false when browser.identity is missing", () => {
    delete anyBrowser.identity;
    expect(hasNativeWebAuthFlow()).toBe(false);
  });

  it("returns false when launchWebAuthFlow is missing", () => {
    anyBrowser.identity = {
      getRedirectURL: () => "https://example.chromiumapp.org/",
    };
    expect(hasNativeWebAuthFlow()).toBe(false);
  });

  it("returns false when getRedirectURL is missing", () => {
    anyBrowser.identity = {
      launchWebAuthFlow: vi.fn(),
    };
    expect(hasNativeWebAuthFlow()).toBe(false);
  });

  it("returns true when both functions are present", () => {
    anyBrowser.identity = {
      getRedirectURL: () => "https://example.chromiumapp.org/",
      launchWebAuthFlow: vi.fn(),
    };
    expect(hasNativeWebAuthFlow()).toBe(true);
  });
});
