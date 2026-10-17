import {
  GetBotSettingsResponse,
  GetBotStatusResponse,
  RestartBotResponse,
  StartBotResponse,
  StopBotResponse,
  UpdateBotSettingsBody,
  UpdateBotSettingsResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import {
  BotControlUnavailableError,
  getBotStatus,
  restartBot,
  RestartCooldownError,
  startBot,
  stopBot,
  updateBotServerSettings,
} from "../lib/minecraft-bot";
import {
  getOrCreateMinecraftBotServerSettings,
  saveMinecraftBotServerSettings,
} from "../lib/minecraft-bot-settings-store";

const router: IRouter = Router();
const apiErrorSchema = z.object({ message: z.string() });

router.get("/bot/status", (_req, res): void => {
  res.json(GetBotStatusResponse.parse(getBotStatus()));
});

router.get("/bot/settings", async (req, res): Promise<void> => {
  try {
    const settings = await getOrCreateMinecraftBotServerSettings();
    res.json(GetBotSettingsResponse.parse(settings));
  } catch (error) {
    req.log.error({ err: error }, "Could not load Minecraft server settings.");
    res
      .status(500)
      .json(apiErrorSchema.parse({ message: "Could not load server settings." }));
  }
});

router.put("/bot/settings", async (req, res): Promise<void> => {
  const parsed = UpdateBotSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(
      apiErrorSchema.parse({
        message: parsed.error.issues[0]?.message ?? "Invalid server settings.",
      }),
    );
    return;
  }

  try {
    const settings = await saveMinecraftBotServerSettings(parsed.data);
    const message = updateBotServerSettings(settings);
    req.log.info({ serverHost: settings.serverHost, serverPort: settings.serverPort }, "Minecraft server settings updated.");
    res.json(UpdateBotSettingsResponse.parse({ message, settings }));
  } catch (error) {
    req.log.error({ err: error }, "Could not save Minecraft server settings.");
    res
      .status(500)
      .json(apiErrorSchema.parse({ message: "Could not save server settings." }));
  }
});

function performAction(
  res: Response,
  action: () => string,
  responseSchema:
    | typeof StartBotResponse
    | typeof StopBotResponse
    | typeof RestartBotResponse,
): void {
  try {
    const message = action();
    res.status(202).json(
      responseSchema.parse({
        message,
        status: getBotStatus(),
      }),
    );
  } catch (error) {
    const statusCode =
      error instanceof BotControlUnavailableError
        ? 409
        : error instanceof RestartCooldownError
          ? 429
          : 500;
    const message =
      error instanceof Error ? error.message : "The bot action failed.";
    res.status(statusCode).json(z.object({ message: z.string() }).parse({ message }));
  }
}

router.post("/bot/start", (req, res): void => {
  req.log.info("Bot start requested.");
  performAction(res, startBot, StartBotResponse);
});

router.post("/bot/stop", (req, res): void => {
  req.log.info("Bot stop requested.");
  performAction(res, stopBot, StopBotResponse);
});

router.post("/bot/restart", (req, res): void => {
  req.log.info("Bot restart requested.");
  performAction(res, restartBot, RestartBotResponse);
});

export default router;
