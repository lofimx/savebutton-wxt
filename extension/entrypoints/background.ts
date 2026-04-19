import { browser } from "wxt/browser";
import { generateTimestamp } from "@/utils/timestamp";
import { writeFile, readAllBookmarkUrls } from "@/utils/opfs";
import { isConfigured } from "@/utils/config";
import { syncWithServer, testConnection } from "@/utils/sync";
import {
  pushFileToDesktop,
  pushWordsFileToDesktop,
} from "@/utils/desktop";
import { loadAuthEmail, loadAuthServer } from "@/utils/auth";

let knownBookmarkedUrls = new Set<string>();

async function refreshBookmarkUrls() {
  try {
    knownBookmarkedUrls = await readAllBookmarkUrls();
  } catch (error) {
    console.error("Failed to refresh bookmark URLs:", error);
  }
}

async function updateIconForActiveTab() {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs.length === 0) return;

    const tab = tabs[0];
    const isBookmarked = tab.url ? knownBookmarkedUrls.has(tab.url) : false;

    const iconPath = isBookmarked
      ? {
          16: "/icon/icon-16.png",
          32: "/icon/icon-32.png",
          48: "/icon/icon-48.png",
          96: "/icon/icon-96.png",
        }
      : {
          16: "/icon/icon-grey-16.png",
          32: "/icon/icon-grey-32.png",
          48: "/icon/icon-grey-48.png",
          96: "/icon/icon-grey-96.png",
        };

    const action = browser.action ?? (browser as any).browserAction;
    if (action) {
      await action.setIcon({ path: iconPath, tabId: tab.id });
    }
  } catch (error) {
    console.error("Failed to update icon:", error);
  }
}

async function triggerSync() {
  try {
    if (!(await isConfigured())) return;

    const email = await loadAuthEmail();
    const server = await loadAuthServer();
    if (!email || !server) return;

    const config = { server, email };

    const result = await syncWithServer(config);
    // Push downloaded words files to desktop app
    for (const w of result.words.files) {
      pushWordsFileToDesktop(w.anga, w.filename, w.content);
    }

    const totalDown =
      result.anga.downloaded + result.meta.downloaded + result.words.downloaded;
    const totalUp = result.anga.uploaded + result.meta.uploaded;
    if (totalDown > 0 || totalUp > 0) {
      console.log(`Sync: ${totalDown} downloaded, ${totalUp} uploaded`);
      await refreshBookmarkUrls();
      await updateIconForActiveTab();
    }
  } catch (error) {
    console.error("Sync error:", error);
  }
}

async function saveAnga(
  filename: string,
  content: string | ArrayBuffer,
): Promise<void> {
  await writeFile("anga", filename, content);
  pushFileToDesktop("anga", filename, content);
  await refreshBookmarkUrls();
  await updateIconForActiveTab();
  triggerSync();
}

async function saveMeta(filename: string, content: string): Promise<void> {
  await writeFile("meta", filename, content);
  pushFileToDesktop("meta", filename, content);
  triggerSync();
}

function extFromContentType(contentType: string): string {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/x-icon": "ico",
    "image/avif": "avif",
  };
  return map[mime] || mime.split("/")[1] || "png";
}

async function saveImage(imageUrl: string, timestamp: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch image");
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/png";

  let filename: string;
  try {
    const urlObj = new URL(imageUrl);
    const originalFilename = urlObj.pathname.split("/").pop() || "image";
    // If the filename from the URL has no extension, derive one from Content-Type
    if (originalFilename.includes(".")) {
      filename = `${timestamp}-${originalFilename}`;
    } else {
      const ext = extFromContentType(contentType);
      filename = `${timestamp}-${originalFilename}.${ext}`;
    }
  } catch {
    const ext = extFromContentType(contentType);
    filename = `${timestamp}-image.${ext}`;
  }

  await saveAnga(filename, arrayBuffer);
  flashGreenIcon();
}

async function flashGreenIcon() {
  try {
    const action = browser.action ?? (browser as any).browserAction;
    if (!action) return;

    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tabId = tabs.length > 0 ? tabs[0].id : undefined;

    await action.setIcon({
      path: {
        16: "/icon/icon-green-16.png",
        32: "/icon/icon-green-32.png",
        48: "/icon/icon-green-48.png",
        96: "/icon/icon-green-96.png",
      },
      tabId,
    });

    const tabUrl = tabs.length > 0 ? tabs[0].url : undefined;
    setTimeout(async () => {
      try {
        const isBookmarked = tabUrl ? knownBookmarkedUrls.has(tabUrl) : false;
        const iconPath = isBookmarked
          ? {
              16: "/icon/icon-16.png",
              32: "/icon/icon-32.png",
              48: "/icon/icon-48.png",
              96: "/icon/icon-96.png",
            }
          : {
              16: "/icon/icon-grey-16.png",
              32: "/icon/icon-grey-32.png",
              48: "/icon/icon-grey-48.png",
              96: "/icon/icon-grey-96.png",
            };
        await action.setIcon({ path: iconPath, tabId });
      } catch (error) {
        console.error("Failed to reset icon after flash:", error);
      }
    }, 2000);
  } catch (error) {
    console.error("Failed to flash green icon:", error);
  }
}

export default defineBackground({ persistent: false, main() {
  refreshBookmarkUrls();

  browser.tabs.onActivated.addListener(() => {
    updateIconForActiveTab();
  });

  browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === "complete") {
      updateIconForActiveTab();
    }
  });

  // Set up periodic sync via alarms (MV3-safe, minimum 1 minute)
  browser.alarms.create("sync", { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "sync") {
      triggerSync();
    }
  });

  browser.contextMenus.create({
    id: "save-to-kaya-text",
    title: "Add Text to Save Button",
    contexts: ["selection"],
  });

  browser.contextMenus.create({
    id: "save-to-kaya-image",
    title: "Add Image to Save Button",
    contexts: ["image"],
  });

  browser.contextMenus.onClicked.addListener(async (info) => {
    const timestamp = generateTimestamp();

    try {
      let savedFilename: string | null = null;

      if (info.menuItemId === "save-to-kaya-text" && info.selectionText) {
        savedFilename = `${timestamp}-quote.md`;
        await saveAnga(savedFilename, info.selectionText);
        flashGreenIcon();
      } else if (info.menuItemId === "save-to-kaya-image" && info.srcUrl) {
        await saveImage(info.srcUrl, timestamp);
        // saveImage generates its own filename; we still want to open the popup
        savedFilename = "image";
      }

      if (savedFilename && !(await isConfigured())) {
        await browser.storage.local.set({
          pendingContextSave: { timestamp, filename: savedFilename },
        });
        const popupUrl = browser.runtime.getURL("/popup.html");
        try {
          await browser.windows.create({
            url: popupUrl,
            type: "popup",
            width: 320,
            height: 220,
          });
        } catch (error) {
          console.warn("Could not open popup after context menu save:", error);
        }
      }
    } catch (error: any) {
      console.error("Failed to save:", error);
    }
  });

  browser.runtime.onMessage.addListener(
    (request: any, _sender, sendResponse) => {
      if (request.action === "saveBookmark") {
        saveAnga(request.filename, request.content)
          .then(() => sendResponse({ success: true }))
          .catch((error: any) => sendResponse({ error: error.message }));
        return true;
      }

      if (request.action === "saveMeta") {
        saveMeta(request.filename, request.content)
          .then(() => sendResponse({ success: true }))
          .catch((error: any) => sendResponse({ error: error.message }));
        return true;
      }

      if (request.action === "testConnection") {
        const config = request.data;
        testConnection(config)
          .then(() => sendResponse({ success: true }))
          .catch((error: any) => sendResponse({ error: error.message }));
        return true;
      }

      if (request.action === "triggerSync") {
        triggerSync()
          .then(() => sendResponse({ success: true }))
          .catch((error: any) => sendResponse({ error: error.message }));
        return true;
      }
    },
  );
}});
