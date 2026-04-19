import { browser } from "wxt/browser";
import { loadConfig, saveConfig } from "@/utils/config";
import {
  hasTokenAuth,
  loadAuthEmail,
  loadAuthServer,
  loadIdentityProvider,
  loadIdentityEmail,
  exchangePasswordForTokens,
  storeTokens,
  launchBrowserLogin,
  launchBrowserRegistration,
  signOut,
  isLocalhostUrl,
  isPrivateIpUrl,
} from "@/utils/auth";

// Login view elements
const loginView = document.getElementById("login-view")!;
const serverInput = document.getElementById("server") as HTMLInputElement;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const signInBtn = document.getElementById("sign-in-btn") as HTMLButtonElement;
const googleSignInBtn = document.getElementById("google-sign-in-btn") as HTMLButtonElement;
const microsoftSignInBtn = document.getElementById("microsoft-sign-in-btn") as HTMLButtonElement;
const signUpLink = document.getElementById("sign-up-link") as HTMLAnchorElement;
const ngrokWarning = document.getElementById("ngrok-warning")!;

// Connected view elements
const connectedView = document.getElementById("connected-view")!;
const connectedIcon = document.getElementById("connected-icon")!;
const connectedEmail = document.getElementById("connected-email")!;
const testConnectedBtn = document.getElementById("test-connected-btn") as HTMLButtonElement;
const signOutBtn = document.getElementById("sign-out-btn") as HTMLButtonElement;

const serverHint = document.getElementById("server-hint")!;

const statusDiv = document.getElementById("status")!;

const STATUS_BASE_CLASSES = "mt-4 px-3 py-2.5 rounded-lg text-[13px]";

function showStatus(message: string, type: string) {
  statusDiv.textContent = message;
  statusDiv.className = `${STATUS_BASE_CLASSES} ${type}`;
}

function clearStatus() {
  statusDiv.textContent = "";
  statusDiv.className = "hidden";
}

// ---------------------------------------------------------------------------
// View switching
// ---------------------------------------------------------------------------

const PROVIDER_ICONS: Record<string, string> = {
  google_oauth2: "/icon/icon-google.svg",
  microsoft_graph: "/icon/icon-microsoft.svg",
  apple: "/icon/icon-apple.svg",
};

const GREEN_CHECK_SVG = '<svg class="w-5 h-5 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" /></svg>';

function showConnectedView(email: string, server: string, provider?: string | null) {
  connectedEmail.textContent = email;
  connectedView.classList.remove("hidden");
  loginView.classList.add("hidden");

  if (provider && PROVIDER_ICONS[provider]) {
    connectedIcon.innerHTML = `<img src="${PROVIDER_ICONS[provider]}" alt="" class="w-5 h-5" />`;
  } else {
    connectedIcon.innerHTML = GREEN_CHECK_SVG;
  }

  serverInput.value = server;
  serverInput.disabled = true;
  serverInput.title = "Sign out to change which server you are connected to";
  serverHint.textContent = "Sign out to change server";
}

function showLoginView() {
  connectedView.classList.add("hidden");
  loginView.classList.remove("hidden");

  serverInput.disabled = false;
  serverInput.title = "The URL of your Save Button server";
  serverHint.textContent = "The URL of your Save Button server";
}

// ---------------------------------------------------------------------------
// Ngrok / private IP warning
// ---------------------------------------------------------------------------

function updateNgrokWarning() {
  const url = serverInput.value.trim();
  const showWarning =
    url.length > 0 &&
    url !== "https://savebutton.com" &&
    (isLocalhostUrl(url) || isPrivateIpUrl(url));

  if (showWarning) {
    ngrokWarning.classList.remove("hidden");
  } else {
    ngrokWarning.classList.add("hidden");
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function init() {
  try {
    if (await hasTokenAuth()) {
      const email = await loadAuthEmail();
      const server = await loadAuthServer();
      if (email && server) {
        const identityEmail = await loadIdentityEmail();
        const identityProvider = await loadIdentityProvider();
        console.info("Options: init — email=%s, identityEmail=%s, identityProvider=%s", email, identityEmail, identityProvider);
        showConnectedView(identityEmail || email, server, identityProvider);
        return;
      }
    }

    // Show login view
    const config = await loadConfig();
    serverInput.value = config.server;
    if (config.email) emailInput.value = config.email;
    showLoginView();
    updateNgrokWarning();
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

// ---------------------------------------------------------------------------
// Post-sign-in helper
// ---------------------------------------------------------------------------

async function completeSignIn(
  email: string,
  server: string,
  identityProvider?: string | null,
  identityEmail?: string | null,
) {
  await saveConfig({ server, email });

  clearStatus();
  const displayEmail = identityEmail || email;
  showConnectedView(displayEmail, server, identityProvider);
  showStatus("Signed in successfully", "success");
}

// ---------------------------------------------------------------------------
// Email/password sign-in (exchanges for tokens, does not store password)
// ---------------------------------------------------------------------------

async function doSignIn() {
  const server = serverInput.value.trim() || "https://savebutton.com";
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) {
    showStatus("Email is required", "error");
    return;
  }
  if (!password) {
    showStatus("Password is required", "error");
    return;
  }

  showStatus("Signing in...", "info");

  try {
    const result = await exchangePasswordForTokens(server, email, password);
    await storeTokens(result.tokens, result.email, server);
    await completeSignIn(result.email, server, result.tokens.identity_provider, result.tokens.identity_email);
  } catch (error: any) {
    showStatus("Sign in failed: " + error.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Provider sign-in (OAuth2 / PKCE via browser.identity)
// ---------------------------------------------------------------------------

async function doProviderSignIn(provider: string) {
  const server = serverInput.value.trim() || "https://savebutton.com";
  showStatus("Opening sign-in page...", "info");

  try {
    const { tokens, email } = await launchBrowserLogin(server, provider);
    await storeTokens(tokens, email, server);
    await completeSignIn(email, server, tokens.identity_provider, tokens.identity_email);
  } catch (error: any) {
    if (error.message?.includes("canceled") || error.message?.includes("cancelled")) {
      showStatus("Sign in cancelled", "info");
    } else {
      showStatus("Sign in failed: " + error.message, "error");
    }
  }
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

async function doSignUp(e: Event) {
  e.preventDefault();
  const server = serverInput.value.trim() || "https://savebutton.com";
  showStatus("Opening sign-up page...", "info");

  try {
    const { tokens, email } = await launchBrowserRegistration(server);
    await storeTokens(tokens, email, server);
    await completeSignIn(email, server, tokens.identity_provider, tokens.identity_email);
  } catch (error: any) {
    if (error.message?.includes("canceled") || error.message?.includes("cancelled")) {
      showStatus("Sign up cancelled", "info");
    } else {
      showStatus("Sign up failed: " + error.message, "error");
    }
  }
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

async function doSignOut() {
  showStatus("Signing out...", "info");

  try {
    await signOut();

    clearStatus();
    showLoginView();
    serverInput.value = "https://savebutton.com";
    emailInput.value = "";
    passwordInput.value = "";
    updateNgrokWarning();
    showStatus("Signed out", "info");
  } catch (error: any) {
    showStatus("Sign out failed: " + error.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------

async function doTestConnection() {
  showStatus("Testing connection...", "info");

  try {
    const email = (await loadAuthEmail()) || "";
    const server = (await loadAuthServer()) || "";
    if (!email || !server) {
      showStatus("Not signed in", "error");
      return;
    }

    const response: any = await browser.runtime.sendMessage({
      action: "testConnection",
      data: { server, email },
    });

    if (response && response.error) {
      showStatus("Connection failed: " + response.error, "error");
    } else if (response && response.success) {
      showStatus("Connection successful!", "success");
    } else {
      showStatus("Connection failed: no response", "error");
    }
  } catch (error: any) {
    showStatus("Connection failed: " + error.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

signInBtn.addEventListener("click", doSignIn);
googleSignInBtn.addEventListener("click", () => doProviderSignIn("google_oauth2"));
microsoftSignInBtn.addEventListener("click", () => doProviderSignIn("microsoft_graph"));
signUpLink.addEventListener("click", doSignUp);
testConnectedBtn.addEventListener("click", doTestConnection);
signOutBtn.addEventListener("click", doSignOut);
serverInput.addEventListener("input", updateNgrokWarning);

init();
