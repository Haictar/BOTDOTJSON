import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const minecraftBotSettingsTable = pgTable("minecraft_bot_settings", {
  id: integer("id").primaryKey().default(1),
  serverHost: text("server_host").notNull(),
  serverPort: integer("server_port").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertMinecraftBotSettingsSchema = createInsertSchema(
  minecraftBotSettingsTable,
).omit({ updatedAt: true });

export type InsertMinecraftBotSettings = z.infer<
  typeof insertMinecraftBotSettingsSchema
>;
export type MinecraftBotSettings =
  typeof minecraftBotSettingsTable.$inferSelect;
