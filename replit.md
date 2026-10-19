# 24/7 Minecraft Bot

A Mineflayer bot named TRIO with a live status dashboard and web controls for starting, stopping, restarting, and changing its Minecraft server address and port.

## Run & Operate

- `pnpm --filter @workspace/minecraft-bot run dev` — run the dashboard.
- `pnpm --filter @workspace/api-server run dev` — run the API and bot service.
- `pnpm run typecheck` — typecheck the workspace.
- The development dashboard and API do not connect to Minecraft. The published API starts TRIO when its process starts; the dashboard itself only requests status. Autoscale may pause while idle, so page traffic can wake the API and trigger its startup connection. Use a Reserved VM deployment to keep the bot and reconnect loop running continuously.
- Start, Stop, Restart, and server-setting controls are intentionally unauthenticated. Anyone who can reach the published dashboard can control the bot and change its target server.
- Stop disables automatic reconnect. Start enables reconnect and opens a new Minecraft connection. Restart reconnects after a short delay and is limited to one manual restart every 30 seconds.
- Server address and port are editable on the dashboard and persisted in PostgreSQL. Saving changes while TRIO is running requests a reconnect to the new server.
- The bot uses Mineflayer's default offline authentication. Online-mode Minecraft servers need account authentication configured before connecting.

## Minecraft Settings

The imported server address, port, and version initialize the saved settings once; dashboard edits are then authoritative. The bot username defaults to TRIO. `MINECRAFT_HOST`, `MINECRAFT_PORT`, and `MINECRAFT_VERSION` seed the initial settings, while `MINECRAFT_USERNAME` can override the bot name:

- `MINECRAFT_HOST` — server host.
- `MINECRAFT_PORT` — server port.
- `MINECRAFT_VERSION` — `auto` (default) or an exact supported Java version, such as `1.21.4`.
- `MINECRAFT_USERNAME` — bot username.
- `BOT_START_X`, `BOT_START_Y`, `BOT_START_Z` — teleport start coordinates.

The bot supports Java versions in the installed Mineflayer data set (currently 1.8.8–26.1). `auto` detects the server version from its status ping; if that ping is unavailable, set an exact version on the dashboard to bypass detection. Bedrock servers require a different protocol implementation and are not supported by this bot. The bot teleports 5 blocks along the positive X axis every 8 seconds, returns to its start coordinates and reconnects hourly, and retries unexpected disconnects with exponential backoff (starting at 10 seconds, capped at 5 minutes). Failed attempts are force-closed and timed out after 150 seconds. Teleport commands require server permission.

## Project Layout

- `artifacts/minecraft-bot` — React status dashboard.
- `artifacts/api-server` — status API and Mineflayer lifecycle manager.
- `lib/api-spec/openapi.yaml` — source contract for generated API hooks and validation schemas.
