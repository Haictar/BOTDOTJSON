import { eq } from "drizzle-orm";
import { db, minecraftBotSettingsTable } from "@workspace/db";
import {
  defaultMinecraftBotServerSettings,
  type MinecraftBotServerSettings,
} from "./minecraft-bot-config";

const singletonId = 1;
let settingsPromise: Promise<MinecraftBotServerSettings> | undefined;

async function loadOrCreateSettings(): Promise<MinecraftBotServerSettings> {
  await db
    .insert(minecraftBotSettingsTable)
    .values({ id: singletonId, ...defaultMinecraftBotServerSettings })
    .onConflictDoNothing();

  const [settings] = await db
    .select({
      serverHost: minecraftBotSettingsTable.serverHost,
      serverPort: minecraftBotSettingsTable.serverPort,
    })
    .from(minecraftBotSettingsTable)
    .where(eq(minecraftBotSettingsTable.id, singletonId))
    .limit(1);

  if (!settings) throw new Error("Could not load the saved Minecraft server settings.");
  return settings;
}

export function getOrCreateMinecraftBotServerSettings(): Promise<MinecraftBotServerSettings> {
  settingsPromise ??= loadOrCreateSettings();
  return settingsPromise;
}

export async function saveMinecraftBotServerSettings(
  settings: MinecraftBotServerSettings,
): Promise<MinecraftBotServerSettings> {
  await getOrCreateMinecraftBotServerSettings();
  const [savedSettings] = await db
    .insert(minecraftBotSettingsTable)
    .values({
      id: singletonId,
      ...settings,
    })
    .onConflictDoUpdate({
      target: minecraftBotSettingsTable.id,
      set: {
        serverHost: settings.serverHost,
        serverPort: settings.serverPort,
        updatedAt: new Date(),
      },
    })
    .returning({
      serverHost: minecraftBotSettingsTable.serverHost,
      serverPort: minecraftBotSettingsTable.serverPort,
    });

  if (!savedSettings) {
    throw new Error("Could not save the Minecraft server settings.");
  }

  settingsPromise = Promise.resolve(savedSettings);
  return savedSettings;
}
