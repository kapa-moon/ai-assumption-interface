import { pgTable, text, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  condition: text("condition"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  qualtricsDataSent: integer("qualtrics_data_sent").default(0),
});

export const turns = pgTable("turns", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").references(() => sessions.id),
  turnIndex: integer("turn_index").notNull(),
  
  // Messages
  userMessage: text("user_message").notNull(),
  assistantMessage: text("assistant_message").notNull(),
  
  // AI Inferred mental models
  inductData: jsonb("induct_data"),
  typesSupportData: jsonb("types_support_data"),
  
  // User adjustments
  inductUserData: jsonb("induct_user_data"),
  typesSupportUserData: jsonb("types_support_user_data"),
  inductUserReasons: jsonb("induct_user_reasons"),
  typesSupportUserReasons: jsonb("types_support_user_reasons"),
  
  // Reactions (thumbs up/down per dimension)
  inductReactions: jsonb("induct_reactions"),
  typesSupportReactions: jsonb("types_support_reactions"),
  
  // Inline feedback (highlights)
  highlights: jsonb("highlights"),
  
  // Turn-level feedback (feeling/helpfulness scores)
  feelingScore: integer("feeling_score"),
  helpfulnessScore: integer("helpfulness_score"),
  
  createdAt: timestamp("created_at").defaultNow(),
});
