import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  tokenBalance: integer("token_balance").notNull().default(0),
  dailyClaims: integer("daily_claims").notNull().default(0),
  lastClaimDate: timestamp("last_claim_date"),
});

export const newsArticles = pgTable("news_articles", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  publishedAt: timestamp("published_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  kind: text("kind").notNull(),
  sourceTitle: text("source_title").notNull(),
  sourceDomain: text("source_domain"),
  originalUrl: text("original_url").notNull(),
  url: text("url"),
  image: text("image"),
  instruments: text("instruments").array(),
  votes: text("votes"),
  author: text("author"),
});

export const userClaims = pgTable("user_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  articleId: varchar("article_id").notNull().references(() => newsArticles.id),
  tokensEarned: integer("tokens_earned").notNull(),
  claimedAt: timestamp("claimed_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertNewsArticleSchema = createInsertSchema(newsArticles).omit({
  createdAt: true,
});

export const insertUserClaimSchema = createInsertSchema(userClaims).omit({
  id: true,
  claimedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = z.infer<typeof insertNewsArticleSchema>;
export type UserClaim = typeof userClaims.$inferSelect;
export type InsertUserClaim = z.infer<typeof insertUserClaimSchema>;

export const cryptoPanicResponseSchema = z.object({
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(z.object({
    id: z.number(),
    slug: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    content: z.string().optional(), // Full article content from RSS
    published_at: z.string(),
    created_at: z.string().optional(),
    kind: z.string(),
    source: z.object({
      title: z.string(),
      region: z.string().optional(),
      domain: z.string().optional(),
      type: z.string().optional(),
    }),
    original_url: z.string(),
    url: z.string().optional(),
    image: z.string().optional(),
    instruments: z.array(z.object({
      code: z.string(),
      title: z.string(),
      slug: z.string().optional(),
    })).optional(),
    votes: z.object({
      negative: z.number().optional(),
      positive: z.number().optional(),
      important: z.number().optional(),
      liked: z.number().optional(),
      disliked: z.number().optional(),
      lol: z.number().optional(),
      toxic: z.number().optional(),
      saved: z.number().optional(),
      comments: z.number().optional(),
    }).optional(),
    author: z.string().optional(),
  })),
});

export type CryptoPanicResponse = z.infer<typeof cryptoPanicResponseSchema>;
