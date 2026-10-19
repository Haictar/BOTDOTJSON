import { createRequire } from "node:module";
import type { Bot, BotOptions } from "mineflayer";
import { logger } from "./logger";
import {
  defaultMinecraftBotServerSettings,
  type MinecraftBotServerSettings,
} from "./minecraft-bot-config";

const require = createRequire(import.meta.url);
const mineflayer = require("mineflayer") as typeof import("mineflayer");

type DesiredState = "running" | "stopped";

const isPublishedDeployment = process.env.REPLIT_DEPLOYMENT === "1";
let serverHost = defaultMinecraftBotServerSettings.serverHost;
let serverPort = defaultMinecraftBotServerSettings.serverPort;
const username = process.env.MINECRAFT_USERNAME?.trim() || "TRIO";
const startX = readNumberEnv("BOT_START_X", 49);
const startY = readNumberEnv("BOT_START_Y", 64);
const startZ = readNumberEnv("BOT_START_Z", 49);
const shortIntervalMs = 8 * 1_000;
const longIntervalMs = 60 * 60 * 1_000;
const initialReconnectDelayMs = 10 * 1_000;
const maxReconnectDelayMs = 5 * 60 * 1_000;
const connectionTimeoutMs = 150 * 1_000;
const restartCooldownMs = 30 * 1_000;

let bot: Bot | undefined;
let botStatus = isPublishedDeployment
  ? "Starting the Minecraft bot…"
  : "Development monitoring only";
let botPosition = "N/A";
let desiredState: DesiredState = isPublishedDeployment ? "running" : "stopped";
let reconnectTimeout: NodeJS.Timeout | undefined;
let connectionTimeout: NodeJS.Timeout | undefined;
let connectionEndFallbackTimeout: NodeJS.Timeout | undefined;
let shortTeleportInterval: NodeJS.Timeout | undefined;
let longTeleportTimeout: NodeJS.Timeout | undefined;
let restartFallbackTimeout: NodeJS.Timeout | undefined;
let restartInProgress = false;
let restartAfterStop = false;
let lastManualRestartAt = 0;
let nextReconnectDelayMs = initialReconnectDelayMs;
let serverSettingsReady = !isPublishedDeployment;

export interface BotStatusSnapshot {
  status: string;
  position: string;
  connected: boolean;
  desiredState: DesiredState;
  controlAvailable: boolean;
  serverHost: string;
  serverPort: number;
  username: string;
}

export class BotControlUnavailableError extends Error {
  constructor() {
    super(
      !isPublishedDeployment
        ? "Bot controls are available only in the published deployment."
        : "Bot controls are unavailable until saved server settings load.",
    );
    this.name = "BotControlUnavailableError";
  }
}

export class RestartCooldownError extends Error {
  constructor(secondsRemaining: number) {
    super(`Please wait ${secondsRemaining} seconds before restarting again.`);
    this.name = "RestartCooldownError";
  }
}

function readNumberEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === "") return fallback;

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return parsedValue;
}

function clearBotTimers(): void {
  clearInterval(shortTeleportInterval);
  clearTimeout(longTeleportTimeout);
  shortTeleportInterval = undefined;
  longTeleportTimeout = undefined;
}

function scheduleReconnect(delay?: number): void {
  if (!isPublishedDeployment || desiredState !== "running") return;

  clearTimeout(reconnectTimeout);
  const retryDelay = delay ?? nextReconnectDelayMs;
  botStatus = `Reconnecting in ${Math.ceil(retryDelay / 1_000)} seconds…`;
  if (delay === undefined) {
    nextReconnectDelayMs = Math.min(
      nextReconnectDelayMs * 2,
      maxReconnectDelayMs,
    );
  }
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = undefined;
    createBot();
  }, retryDelay);
}

function handleConnectionEnd(target: Bot, reason: string | undefined): void {
  if (bot !== target) return;

  const wasRestartRequested = restartInProgress;
  const shouldReconnect = desiredState === "running";
  bot = undefined;
  restartInProgress = false;
  clearTimeout(connectionTimeout);
  connectionTimeout = undefined;
  clearTimeout(connectionEndFallbackTimeout);
  connectionEndFallbackTimeout = undefined;
  clearTimeout(restartFallbackTimeout);
  restartFallbackTimeout = undefined;
  clearBotTimers();
  botPosition = "N/A";

  if (!shouldReconnect) {
    botStatus = "Stopped";
    restartAfterStop = false;
    logger.info({ reason }, "Minecraft bot stopped.");
    return;
  }

  logger.warn({ reason, wasRestartRequested }, "Minecraft bot disconnected.");
  const immediateReconnect = restartAfterStop;
  restartAfterStop = false;
  scheduleReconnect(immediateReconnect ? 0 : undefined);
}

function forceCloseFailedConnection(target: Bot, reason: string): void {
  clearTimeout(connectionTimeout);
  connectionTimeout = undefined;
  clearTimeout(connectionEndFallbackTimeout);
  connectionEndFallbackTimeout = setTimeout(() => {
    connectionEndFallbackTimeout = undefined;
    if (bot !== target) return;

    logger.warn({ reason }, "Minecraft client did not emit end after failure; clearing it.");
    handleConnectionEnd(target, reason);
  }, 5_000);

  try {
    const socket = target._client.socket;
    if (socket && !socket.destroyed) {
      socket.destroy();
    } else {
      target.end(reason);
    }
  } catch (error) {
    logger.error({ err: error, reason }, "Could not close the failed Minecraft connection.");
    try {
      target.end(reason);
    } catch (endError) {
      logger.error({ err: endError, reason }, "Could not end the failed Minecraft client.");
    }
  }
}

function currentPosition(target: Bot): string {
  const position = target.entity?.position;
  if (!position) return "N/A";

  return `X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}`;
}

function updateBotPosition(target: Bot): void {
  if (bot === target && target.entity?.position) {
    botPosition = currentPosition(target);
  }
}

async function teleportToStart(target: Bot): Promise<void> {
  const position = target.entity?.position;
  if (!position) return;

  if (position.x === startX && position.y === startY && position.z === startZ) {
    logger.info("Bot is already at its configured start position.");
    return;
  }

  try {
    target.chat(`/tp ${startX} ${startY} ${startZ}`);
    logger.info(
      { x: startX, y: startY, z: startZ },
      "Sent teleport command to the configured start position.",
    );
  } catch (error) {
    logger.error({ err: error }, "Could not send the start-position command.");
  }
}

async function teleportByX(target: Bot, amount: number): Promise<void> {
  const position = target.entity?.position;
  if (!position) return;

  const newX = position.x + amount;
  try {
    target.chat(`/tp ${newX} ${position.y} ${position.z}`);
    logger.info(
      { x: newX, y: position.y, z: position.z },
      "Sent periodic X-axis teleport command.",
    );
  } catch (error) {
    logger.error({ err: error }, "Could not send periodic teleport command.");
  }
}

function createBot(): void {
  if (!isPublishedDeployment || desiredState !== "running" || bot) return;

  clearTimeout(reconnectTimeout);
  reconnectTimeout = undefined;
  botStatus = `Connecting to ${serverHost}:${serverPort}…`;

  const botOptions: BotOptions = {
    host: serverHost,
    port: serverPort,
    username,
    checkTimeoutInterval: 60 * 1_000,
  };

  logger.info(
    { host: serverHost, port: serverPort, username },
    "Attempting Minecraft connection.",
  );

  let currentBot: Bot;
  try {
    currentBot = mineflayer.createBot(botOptions);
  } catch (error) {
    botStatus = `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`;
    logger.error({ err: error }, "Could not create the Mineflayer client.");
    scheduleReconnect();
    return;
  }

  bot = currentBot;

  currentBot.on("spawn", () => {
    if (bot !== currentBot || desiredState !== "running") return;

    botStatus = "Connected and spawned";
    updateBotPosition(currentBot);
    logger.info({ username }, "Minecraft bot spawned.");
    void teleportToStart(currentBot);

    clearBotTimers();
    shortTeleportInterval = setInterval(() => {
      if (bot !== currentBot || desiredState !== "running") return;
      void teleportByX(currentBot, 5);
      updateBotPosition(currentBot);
    }, shortIntervalMs);

    longTeleportTimeout = setTimeout(() => {
      if (bot !== currentBot || desiredState !== "running") return;

      botStatus = "Scheduled refresh in progress";
      void teleportToStart(currentBot).finally(() => {
        if (bot === currentBot && desiredState === "running") {
          currentBot.quit("Time for a refresh!");
        }
      });
    }, longIntervalMs);
  });

  currentBot.on("chat", (chatUsername, message) => {
    if (chatUsername === currentBot.username) return;
    logger.info({ chatUsername, message }, "Minecraft chat message.");
  });

  currentBot.on("kicked", (reason, loggedIn) => {
    logger.warn({ reason, loggedIn }, "Minecraft bot was kicked.");
  });

  currentBot.on("end", (reason) => {
    if (bot !== currentBot) return;

    const wasRestartRequested = restartInProgress;
    const shouldReconnect = desiredState === "running";
    bot = undefined;
    restartInProgress = false;
    clearTimeout(restartFallbackTimeout);
    restartFallbackTimeout = undefined;
    clearBotTimers();
    botPosition = "N/A";

    if (!shouldReconnect) {
      botStatus = "Stopped";
      restartAfterStop = false;
      logger.info({ reason }, "Minecraft bot stopped.");
      return;
    }

    botStatus = wasRestartRequested
      ? `Restart requested; reconnecting in ${reconnectDelayMs / 1_000} seconds`
      : `Disconnected: ${String(reason || "connection ended")}`;
    logger.warn({ reason, wasRestartRequested }, "Minecraft bot disconnected.");
    const delay = restartAfterStop ? 0 : reconnectDelayMs;
    restartAfterStop = false;
    scheduleReconnect(delay);
  });

  currentBot.on("error", (error) => {
    if (bot !== currentBot) return;
    botStatus = `Error: ${error.message}`;
    logger.error({ err: error }, "Minecraft bot connection error.");
  });

  currentBot.on("move", () => updateBotPosition(currentBot));
}

function ensureControlsAvailable(): void {
  if (!isPublishedDeployment || !serverSettingsReady) {
    throw new BotControlUnavailableError();
  }
}

export function getBotStatus(): BotStatusSnapshot {
  return {
    status: botStatus,
    position: botPosition,
    connected: botStatus === "Connected and spawned",
    desiredState,
    controlAvailable: isPublishedDeployment && serverSettingsReady,
    serverHost,
    serverPort,
    username,
  };
}

export function updateBotServerSettings(
  settings: MinecraftBotServerSettings,
  reconnectIfRunning = true,
): string {
  const changed =
    settings.serverHost !== serverHost || settings.serverPort !== serverPort;

  serverHost = settings.serverHost;
  serverPort = settings.serverPort;
  serverSettingsReady = true;

  if (!changed) {
    return "Server settings saved. No connection change was needed.";
  }

  if (
    !reconnectIfRunning ||
    !isPublishedDeployment ||
    desiredState !== "running"
  ) {
    return "Server settings saved. They will be used the next time the bot starts.";
  }

  return requestBotRestart("Minecraft server settings changed.");
}

export function setBotConfigurationUnavailable(error: unknown): void {
  serverSettingsReady = false;
  botStatus = "Could not load saved Minecraft server settings.";
  logger.error({ err: error }, "Could not load saved Minecraft server settings.");
}

export function startBot(): string {
  ensureControlsAvailable();
  if (desiredState === "running") {
    return bot || reconnectTimeout
      ? "The bot is already running or connecting."
      : "The bot is already scheduled to start.";
  }

  desiredState = "running";
  clearTimeout(reconnectTimeout);
  reconnectTimeout = undefined;

  if (bot) {
    restartAfterStop = true;
    botStatus = "Start requested; waiting for the current connection to close.";
    return "Start requested. The bot will connect as soon as its current session closes.";
  }

  restartAfterStop = false;
  botStatus = "Start requested; connecting to Minecraft…";
  createBot();
  return "Start requested. Connecting to Minecraft.";
}

export function stopBot(): string {
  ensureControlsAvailable();
  desiredState = "stopped";
  restartAfterStop = false;
  restartInProgress = false;
  clearTimeout(reconnectTimeout);
  reconnectTimeout = undefined;
  clearTimeout(restartFallbackTimeout);
  restartFallbackTimeout = undefined;
  clearBotTimers();

  const currentBot = bot;
  if (!currentBot) {
    botPosition = "N/A";
    botStatus = "Stopped";
    return "The bot is stopped.";
  }

  botStatus = "Stopping…";
  try {
    currentBot.quit("Stopped from the web control panel.");
    restartFallbackTimeout = setTimeout(() => {
      if (bot !== currentBot) return;

      logger.warn("Bot did not close cleanly after Stop; forcing the connection closed.");
      try {
        currentBot.end("Stopped from the web control panel.");
      } catch (error) {
        logger.error({ err: error }, "Could not force-close the Minecraft client.");
      }

      if (bot === currentBot) {
        bot = undefined;
        botPosition = "N/A";
        clearTimeout(restartFallbackTimeout);
        restartFallbackTimeout = undefined;
        if (desiredState === "running") {
          botStatus = "Reconnecting after a new Start request…";
          scheduleReconnect(restartAfterStop ? 0 : reconnectDelayMs);
          restartAfterStop = false;
        } else {
          botStatus = "Stopped";
        }
      }
    }, 5_000);
  } catch (error) {
    logger.error({ err: error }, "Could not stop the Minecraft bot cleanly.");
    try {
      currentBot.end("Stopped from the web control panel.");
    } catch (endError) {
      logger.error({ err: endError }, "Could not force-close the Minecraft client.");
    }
    if (bot === currentBot) {
      bot = undefined;
      botPosition = "N/A";
      botStatus = "Stopped";
    }
  }

  return "Stop requested. Automatic reconnect is disabled.";
}

function requestBotRestart(reason: string): string {
  desiredState = "running";
  restartAfterStop = false;
  clearTimeout(reconnectTimeout);
  reconnectTimeout = undefined;

  const currentBot = bot;
  if (!currentBot) {
    botStatus = "Restart requested; connecting to Minecraft…";
    createBot();
    return "Restart requested. Connecting to Minecraft.";
  }

  restartInProgress = true;
  botStatus = "Restart requested; disconnecting the current session…";
  clearBotTimers();
  restartFallbackTimeout = setTimeout(() => {
    if (bot !== currentBot) return;

    logger.warn("Bot did not disconnect after Restart; forcing its connection closed.");
    try {
      currentBot.end(`${reason} fallback.`);
    } catch (error) {
      logger.error({ err: error }, "Could not force-close the Minecraft client.");
    }

    if (bot === currentBot) {
      bot = undefined;
      restartInProgress = false;
      clearTimeout(restartFallbackTimeout);
      restartFallbackTimeout = undefined;
      botPosition = "N/A";
      botStatus = `Restart requested; reconnecting in ${reconnectDelayMs / 1_000} seconds`;
      scheduleReconnect();
    }
  }, 5_000);

  try {
    currentBot.quit(reason);
  } catch (error) {
    clearTimeout(restartFallbackTimeout);
    restartFallbackTimeout = undefined;
    restartInProgress = false;
    botStatus = `Restart failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    logger.error({ err: error }, "Could not restart the Minecraft bot.");
    scheduleReconnect();
    return "Could not close the current session cleanly. A reconnect was scheduled.";
  }

  return `Restart requested. The bot will reconnect in about ${reconnectDelayMs / 1_000} seconds.`;
}

export function restartBot(): string {
  ensureControlsAvailable();
  const now = Date.now();
  const elapsedSinceRestart = now - lastManualRestartAt;
  if (lastManualRestartAt && elapsedSinceRestart < restartCooldownMs) {
    throw new RestartCooldownError(
      Math.ceil((restartCooldownMs - elapsedSinceRestart) / 1_000),
    );
  }

  lastManualRestartAt = now;
  return requestBotRestart("Manual restart requested.");
}

export function startBotOnPublishedDeployment(): void {
  if (!isPublishedDeployment || !serverSettingsReady) return;
  desiredState = "running";
  createBot();
}
