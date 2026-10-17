import {
  GetBotStatusResponse,
  RestartBotResponse,
  StartBotResponse,
  StopBotResponse,
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
} from "../lib/minecraft-bot";

const router: IRouter = Router();

router.get("/bot/status", (_req, res): void => {
  res.json(GetBotStatusResponse.parse(getBotStatus()));
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
