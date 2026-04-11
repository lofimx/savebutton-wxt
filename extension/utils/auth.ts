import { browser } from "wxt/browser";

// ---------------------------------------------------------------------------
// PKCE (Proof Key for Code Exchange)
// ---------------------------------------------------------------------------

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64urlEncode(bytes.buffer);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64urlEncode(digest);
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

const REFRESH_TOKEN_KEY = "refreshToken";
const AUTH_EMAIL_KEY = "authEmail";
const AUTH_SERVER_KEY = "authServer";
const IDENTITY_PROVIDER_KEY = "identityProvider";
const IDENTITY_EMAIL_KEY = "identityEmail";

let accessToken: string | null = null;

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user_email?: string;
  identity_provider?: string;
  identity_email?: string;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function storeTokens(
  tokens: TokenResponse,
  email: string,
  server: string,
): Promise<void> {
  console.info("Auth: storeTokens — email=%s, identity_provider=%s, identity_email=%s", email, tokens.identity_provider, tokens.identity_email);
  accessToken = tokens.access_token;
  const data: Record<string, string> = {
    [REFRESH_TOKEN_KEY]: tokens.refresh_token,
    [AUTH_EMAIL_KEY]: email,
    [AUTH_SERVER_KEY]: server,
  };
  if (tokens.identity_provider) {
    data[IDENTITY_PROVIDER_KEY] = tokens.identity_provider;
  }
  if (tokens.identity_email) {
    data[IDENTITY_EMAIL_KEY] = tokens.identity_email;
  }
  await browser.storage.local.set(data);
}

export async function loadRefreshToken(): Promise<string | null> {
  const result = await browser.storage.local.get(REFRESH_TOKEN_KEY);
  return (result[REFRESH_TOKEN_KEY] as string) || null;
}

export async function loadAuthEmail(): Promise<string | null> {
  const result = await browser.storage.local.get(AUTH_EMAIL_KEY);
  return (result[AUTH_EMAIL_KEY] as string) || null;
}

export async function loadAuthServer(): Promise<string | null> {
  const result = await browser.storage.local.get(AUTH_SERVER_KEY);
  return (result[AUTH_SERVER_KEY] as string) || null;
}

export async function loadIdentityProvider(): Promise<string | null> {
  const result = await browser.storage.local.get(IDENTITY_PROVIDER_KEY);
  return (result[IDENTITY_PROVIDER_KEY] as string) || null;
}

export async function loadIdentityEmail(): Promise<string | null> {
  const result = await browser.storage.local.get(IDENTITY_EMAIL_KEY);
  return (result[IDENTITY_EMAIL_KEY] as string) || null;
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await browser.storage.local.remove([
    REFRESH_TOKEN_KEY,
    AUTH_EMAIL_KEY,
    AUTH_SERVER_KEY,
    IDENTITY_PROVIDER_KEY,
    IDENTITY_EMAIL_KEY,
  ]);
}

export async function hasTokenAuth(): Promise<boolean> {
  const refreshToken = await loadRefreshToken();
  return refreshToken !== null;
}

// ---------------------------------------------------------------------------
// Device metadata
// ---------------------------------------------------------------------------

function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browserName = "Browser";
  if (ua.includes("Firefox")) browserName = "Firefox";
  else if (ua.includes("Edg/")) browserName = "Edge";
  else if (ua.includes("Chrome")) browserName = "Chrome";
  else if (ua.includes("Safari")) browserName = "Safari";

  let os = "Unknown";
  if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browserName} on ${os}`;
}

function getAppVersion(): string {
  return browser.runtime.getManifest().version;
}

// ---------------------------------------------------------------------------
// Private IP / localhost detection
// ---------------------------------------------------------------------------

export function isLocalhostUrl(url: string): boolean {
  const lower = url.toLowerCase().trim();
  return lower.includes("localhost") || lower.includes("127.0.0.1");
}

export function isPrivateIpUrl(url: string): boolean {
  const match = url.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!match) return false;
  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Token exchange endpoints
// ---------------------------------------------------------------------------

function normalizeServerUrl(url: string): string {
  let normalized = url.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function authTokenUrl(server: string): string {
  return `${normalizeServerUrl(server)}/api/v1/auth/token`;
}

function extractEmailFromResponse(responseBody: TokenResponse): string {
  // Prefer user_email from response body (server includes it)
  if (responseBody.user_email) {
    return responseBody.user_email;
  }
  // Fallback: extract from JWT payload
  const payload = JSON.parse(atob(responseBody.access_token.split(".")[1]));
  return payload.email as string;
}

export async function exchangePasswordForTokens(
  server: string,
  email: string,
  password: string,
): Promise<{ tokens: TokenResponse; email: string }> {
  const response = await fetch(authTokenUrl(server), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      email,
      password,
      device_name: getDeviceName(),
      device_type: "browser_extension",
      app_version: getAppVersion(),
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Authentication failed - check your email and password");
    }
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const tokens: TokenResponse = await response.json();
  const userEmail = extractEmailFromResponse(tokens);
  return { tokens, email: userEmail };
}

export async function exchangeCodeForTokens(
  server: string,
  code: string,
  codeVerifier: string,
): Promise<{ tokens: TokenResponse; email: string }> {
  const response = await fetch(authTokenUrl(server), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      device_name: getDeviceName(),
      device_type: "browser_extension",
      app_version: getAppVersion(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Code exchange failed: ${response.status}`);
  }

  const tokens: TokenResponse = await response.json();
  console.info("Auth: exchangeCodeForTokens response — user_email=%s, identity_provider=%s, identity_email=%s", tokens.user_email, tokens.identity_provider, tokens.identity_email);
  const email = extractEmailFromResponse(tokens);
  return { tokens, email };
}

export async function refreshAccessToken(
  server: string,
  refreshToken: string,
): Promise<TokenResponse> {
  const response = await fetch(authTokenUrl(server), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return response.json();
}

export async function revokeRefreshToken(
  server: string,
  refreshToken: string,
): Promise<void> {
  const revokeUrl = `${normalizeServerUrl(server)}/api/v1/auth/revoke`;
  await fetch(revokeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

// ---------------------------------------------------------------------------
// Auth header (Bearer only)
// ---------------------------------------------------------------------------

export function getAuthHeader(): string | null {
  if (accessToken) {
    return `Bearer ${accessToken}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Token refresh on 401
// ---------------------------------------------------------------------------

export async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = await loadRefreshToken();
  const server = await loadAuthServer();
  if (!refreshToken || !server) return false;

  try {
    const tokens = await refreshAccessToken(server, refreshToken);
    accessToken = tokens.access_token;
    // Update refresh token if server returns a new one
    if (tokens.refresh_token) {
      await browser.storage.local.set({
        [REFRESH_TOKEN_KEY]: tokens.refresh_token,
      });
    }
    return true;
  } catch (error) {
    console.warn("Token refresh failed, clearing tokens:", error);
    await clearTokens();
    return false;
  }
}

// ---------------------------------------------------------------------------
// Browser login flow (PKCE via browser.identity)
// ---------------------------------------------------------------------------

async function launchWebAuthFlow(
  server: string,
  authorizePath: string,
): Promise<{ tokens: TokenResponse; email: string }> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const redirectUri = browser.identity.getRedirectURL();

  const authorizeUrl = new URL(
    `${normalizeServerUrl(server)}${authorizePath}`,
  );
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("device_name", getDeviceName());
  authorizeUrl.searchParams.set("device_type", "browser_extension");

  const responseUrl = await browser.identity.launchWebAuthFlow({
    url: authorizeUrl.toString(),
    interactive: true,
  });

  const url = new URL(responseUrl);
  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error("No authorization code received");
  }

  return exchangeCodeForTokens(server, code, codeVerifier);
}

export async function launchBrowserLogin(
  server: string,
  provider?: string,
): Promise<{ tokens: TokenResponse; email: string }> {
  let path = "/api/v1/auth/authorize";
  if (provider) {
    path = `${path}/${provider}`;
  }
  return launchWebAuthFlow(server, path);
}

export async function launchBrowserRegistration(
  server: string,
): Promise<{ tokens: TokenResponse; email: string }> {
  return launchWebAuthFlow(server, "/api/v1/auth/authorize/register");
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export async function signOut(): Promise<void> {
  const refreshToken = await loadRefreshToken();
  const server = await loadAuthServer();

  if (refreshToken && server) {
    try {
      await revokeRefreshToken(server, refreshToken);
    } catch (error) {
      console.warn("Failed to revoke token on server:", error);
    }
  }

  await clearTokens();
}
