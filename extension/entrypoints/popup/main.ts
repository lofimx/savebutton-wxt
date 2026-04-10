import { browser } from "wxt/browser";
import { generateTimestamp, urlToDomainSlug } from "@/utils/timestamp";
import { isConfigured } from "@/utils/config";

// Bookmark view elements
const statusIcon = document.getElementById("status-icon")!;
const statusText = document.getElementById("status-text")!;
const noteInput = document.getElementById("note-input") as HTMLInputElement;
const loginContainer = document.getElementById("login-container")!;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const errorContainer = document.getElementById("error-container")!;
const errorText = document.getElementById("error-text")!;

let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;
let noteFocused = false;
let bookmarkSaved = false;
let currentTimestamp: string | null = null;
let currentFilename: string | null = null;

function showSuccess(message: string) {
  statusIcon.className = "success";
  statusText.textContent = message;
}

function showError(message: string) {
  statusIcon.className = "error";
  statusText.textContent = "Error";
  errorContainer.classList.remove("hidden");
  errorText.textContent = message;
}

function showSaving() {
  statusIcon.className = "saving";
  statusText.textContent = "Saving bookmark...";
}

function startAutoCloseTimer() {
  if (autoCloseTimeout) {
    clearTimeout(autoCloseTimeout);
  }
  autoCloseTimeout = setTimeout(() => {
    if (!noteFocused) {
      window.close();
    }
  }, 4000);
}

async function saveBookmark() {
  showSaving();

  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tab = tabs[0];

    if (!tab || !tab.url) {
      showError("No active tab found");
      return;
    }

    currentTimestamp = generateTimestamp();
    const domainSlug = urlToDomainSlug(tab.url);
    currentFilename = `${currentTimestamp}-${domainSlug}.url`;

    const urlFileContent = `[InternetShortcut]\nURL=${tab.url}\n`;

    const response: any = await browser.runtime.sendMessage({
      action: "saveBookmark",
      filename: currentFilename,
      content: urlFileContent,
    });

    if (response && response.error) {
      showError(response.error);
    } else {
      bookmarkSaved = true;
      showSuccess("Bookmark saved!");
      startAutoCloseTimer();
    }
  } catch (error: any) {
    showError(error.message || "Failed to save bookmark");
  }
}

async function saveNote(noteText: string) {
  if (!currentTimestamp || !currentFilename) {
    showError("No bookmark to attach note to");
    return;
  }

  const metaFilename = `${currentTimestamp}-note.toml`;
  const metaContent = `[anga]\nfilename = "${currentFilename}"\n\n[meta]\nnote = '''${noteText}'''`;

  try {
    const response: any = await browser.runtime.sendMessage({
      action: "saveMeta",
      filename: metaFilename,
      content: metaContent,
    });

    if (response && response.error) {
      showError(response.error);
    } else {
      showSuccess("Bookmark and note saved!");
      setTimeout(() => window.close(), 1000);
    }
  } catch (error: any) {
    showError(error.message || "Failed to save note");
  }
}

async function openLogin() {
  const noteText = noteInput.value.trim().replace(/[\n\r]/g, " ");
  if (noteText && bookmarkSaved) {
    await saveNote(noteText);
  }
  browser.runtime.openOptionsPage();
}

// Bookmark view event listeners
noteInput.addEventListener("focus", () => {
  noteFocused = true;
  if (autoCloseTimeout) {
    clearTimeout(autoCloseTimeout);
    autoCloseTimeout = null;
  }
});

noteInput.addEventListener("blur", () => {
  noteFocused = false;
  if (bookmarkSaved && !noteInput.value.trim()) {
    startAutoCloseTimer();
  }
});

noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const noteText = noteInput.value.trim().replace(/[\n\r]/g, " ");
    if (noteText && bookmarkSaved) {
      saveNote(noteText);
    } else if (bookmarkSaved) {
      window.close();
    }
  }
});

loginBtn.addEventListener("click", openLogin);

// Initialize
async function init() {
  const configured = await isConfigured().catch(() => false);

  if (!configured) {
    loginContainer.classList.remove("hidden");
  }

  // Check for a pending context menu save
  const stored = await browser.storage.local.get("pendingContextSave");
  if (stored.pendingContextSave) {
    const pending = stored.pendingContextSave as {
      timestamp: string;
      filename: string;
    };
    currentTimestamp = pending.timestamp;
    currentFilename = pending.filename;
    bookmarkSaved = true;
    showSuccess("Saved!");
    startAutoCloseTimer();
    await browser.storage.local.remove("pendingContextSave");
  } else {
    saveBookmark();
  }
}

init();
