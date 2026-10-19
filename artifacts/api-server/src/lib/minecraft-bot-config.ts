import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const minecraftData = require("minecraft-data") as (
  version: string,
) => unknown | null;

export interface MinecraftBotServerSettings {
  serverHost: string;
  serverPort: number;
  minecraftVersion: string;
}

export function isSupportedMinecraftVersion(version: string): boolean {
  return version === "auto" || Boolean(minecraftData(version));
}

function readPortFromEnvironment(): number {
  const rawValue = process.env.MINECRAFT_PORT;
  if (!rawValue?.trim()) return 46830;

  const port = Number(rawValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("MINECRAFT_PORT must be an integer between 1 and 65535.");
  }
  return port;
}

export const defaultMinecraftBotServerSettings: MinecraftBotServerSettings = {
  serverHost:
    process.env.MINECRAFT_HOST?.trim() || "THUNDERBALLYT.aternos.me",
  serverPort: readPortFromEnvironment(),
  minecraftVersion: process.env.MINECRAFT_VERSION?.trim() || "auto",
};
