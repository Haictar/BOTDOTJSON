# 24/7 Minecraft Bot

A Mineflayer bot with a live status dashboard and web controls for starting, stopping, or restarting the published bot.

## Run & Operate

- `pnpm --filter @workspace/minecraft-bot run dev` — run the dashboard.
- `pnpm --filter @workspace/api-server run dev` — run the API and bot service.
- `pnpm run typecheck` — typecheck the workspace.
- The development dashboard and API do not connect to Minecraft. The bot connects automatically only in the published deployment to avoid duplicate logins with the same username.
- Start, Stop, and Restart controls are intentionally unauthenticated. Anyone who can reach the published dashboard can control the bot.
- Stop disables automatic reconnect. Start enables reconnect and opens a new Minecraft connection. Restart reconnects after a short delay and is limited to one manual restart every 30 seconds.
- The bot uses Mineflayer's default offline authentication. Online-mode Minecraft servers need account authentication configured before connecting.

## Minecraft Settings

The imported values remain the defaults and can be overridden with environment variables:

- `MINECRAFT_HOST` — server host.
- `MINECRAFT_PORT` — server port.
- `MINECRAFT_USERNAME` — bot username.
- `BOT_START_X`, `BOT_START_Y`, `BOT_START_Z` — teleport start coordinates.

The bot teleports 10 blocks on the X axis every 60 seconds, returns to its start coordinates and reconnects hourly, and retries unexpected disconnects after 10 seconds. Teleport commands require server permission.

## Project Layout

- `artifacts/minecraft-bot` — React status dashboard.
- `artifacts/api-server` — status API and Mineflayer lifecycle manager.
- `lib/api-spec/openapi.yaml` — source contract for generated API hooks and validation schemas.
