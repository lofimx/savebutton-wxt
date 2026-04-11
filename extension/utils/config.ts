import { browser } from "wxt/browser";
import { hasTokenAuth } from "./auth";

export interface Config {
  server: string;
  email: string;
}

const DEFAULT_SERVER = "https://savebutton.com";

export async function loadConfig(): Promise<Config> {
  const result = await browser.storage.local.get(["server", "email"]);

  return {
    server: (result.server as string) || DEFAULT_SERVER,
    email: (result.email as string) || "",
  };
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  const toStore: Record<string, string> = {};

  if (config.server !== undefined) toStore.server = config.server;
  if (config.email !== undefined) toStore.email = config.email;

  if (Object.keys(toStore).length > 0) {
    await browser.storage.local.set(toStore);
  }
}

export async function isConfigured(): Promise<boolean> {
  return hasTokenAuth();
}
