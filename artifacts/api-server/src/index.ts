import app from "./app";
import { logger } from "./lib/logger";
import {
  setBotConfigurationUnavailable,
  startBotOnPublishedDeployment,
  updateBotServerSettings,
} from "./lib/minecraft-bot";
import { getOrCreateMinecraftBotServerSettings } from "./lib/minecraft-bot-settings-store";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void getOrCreateMinecraftBotServerSettings()
    .then((settings) => {
      updateBotServerSettings(settings, false);
      logger.info("Loaded saved Minecraft server settings.");
      startBotOnPublishedDeployment();
    })
    .catch((error) => setBotConfigurationUnavailable(error));
});
