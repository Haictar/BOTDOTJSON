# 24/7 Minecraft Bot

A Mineflayer bot named TRIO with a live status dashboard and web controls for starting, stopping, restarting, and changing its Minecraft server address and port.

## Run & Operate

- `pnpm --filter @workspace/minecraft-bot run dev` — run the dashboard.
- `pnpm --filter @workspace/api-server run dev` — run the API and bot service.
- `pnpm run typecheck` — typecheck the workspace.
- The development dashboard and API do not connect to Minecraft. The bot connects automatically only in the published deployment to avoid duplicate logins with the same username.
- Start, Stop, Restart, and server-setting controls are intentionally unauthenticated. Anyone who can reach the published dashboard can control the bot and change its target server.
- Stop disables automatic reconnect. Start enables reconnect and opens a new Minecraft connection. Restart reconnects after a short delay and is limited to one manual restart every 30 seconds.
- Server address and port are editable on the dashboard and persisted in PostgreSQL. Saving changes while TRIO is running requests a reconnect to the new server.
- The bot uses Mineflayer's default offline authentication. Online-mode Minecraft servers need account authentication configured before connecting.

## Minecraft Settings

The imported server address and port initialize the saved settings once; dashboard edits are then authoritative. The bot username defaults to TRIO. `MINECRAFT_HOST` and `MINECRAFT_PORT` seed the initial settings, while `MINECRAFT_USERNAME` can override the bot name:

- `MINECRAFT_HOST` — server host.
- `MINECRAFT_PORT` — server port.
- `MINECRAFT_USERNAME` — bot username.
- `BOT_START_X`, `BOT_START_Y`, `BOT_START_Z` — teleport start coordinates.

The bot teleports 10 blocks on the X axis every 60 seconds, returns to its start coordinates and reconnects hourly, and retries unexpected disconnects after 10 seconds. Teleport commands require server permission.

## Project Layout

- `artifacts/minecraft-bot` — React status dashboard.
- `artifacts/api-server` — status API and Mineflayer lifecycle manager.
- `lib/api-spec/openapi.yaml` — source contract for generated API hooks and validation schemas.
