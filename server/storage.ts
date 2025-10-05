import { type User, type InsertUser, type NewsArticle, type InsertNewsArticle, type UserClaim, type InsertUserClaim } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTokens(userId: string, tokenBalance: number, dailyClaims: number): Promise<User | undefined>;
  resetDailyClaims(userId: string): Promise<User | undefined>;
  
  getNewsArticles(limit?: number, offset?: number): Promise<NewsArticle[]>;
  getNewsArticle(id: string): Promise<NewsArticle | undefined>;
  createNewsArticle(article: InsertNewsArticle): Promise<NewsArticle>;
  createNewsArticles(articles: InsertNewsArticle[]): Promise<NewsArticle[]>;
  
  getUserClaims(userId: string): Promise<UserClaim[]>;
  getUserClaimForArticle(userId: string, articleId: string): Promise<UserClaim | undefined>;
  createUserClaim(claim: InsertUserClaim): Promise<UserClaim>;
  getUserDailyClaims(userId: string, date: Date): Promise<UserClaim[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private newsArticles: Map<string, NewsArticle>;
  private userClaims: Map<string, UserClaim>;

  constructor() {
    this.users = new Map();
    this.newsArticles = new Map();
    this.userClaims = new Map();
    
    const defaultUser: User = {
      id: "default-user",
      username: "crypto_trader",
      password: "password",
      tokenBalance: 12.5,
      dailyClaims: 2,
      lastClaimDate: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      tokenBalance: 0,
      dailyClaims: 0,
      lastClaimDate: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserTokens(userId: string, tokenBalance: number, dailyClaims: number): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      tokenBalance, 
      dailyClaims,
      lastClaimDate: new Date(),
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async resetDailyClaims(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser = { ...user, dailyClaims: 0 };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getNewsArticles(limit = 20, offset = 0): Promise<NewsArticle[]> {
    const articles = Array.from(this.newsArticles.values());
    return articles
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(offset, offset + limit);
  }

  async getNewsArticle(id: string): Promise<NewsArticle | undefined> {
    return this.newsArticles.get(id);
  }

  async createNewsArticle(article: InsertNewsArticle): Promise<NewsArticle> {
    const newsArticle: NewsArticle = {
      ...article,
      description: article.description ?? null,
      sourceDomain: article.sourceDomain ?? null,
      url: article.url ?? null,
      image: article.image ?? null,
      instruments: article.instruments ?? null,
      votes: article.votes ?? null,
      author: article.author ?? null,
      createdAt: new Date(),
    };
    this.newsArticles.set(article.id, newsArticle);
    return newsArticle;
  }

  async createNewsArticles(articles: InsertNewsArticle[]): Promise<NewsArticle[]> {
    const newsArticles: NewsArticle[] = [];
    for (const article of articles) {
      const newsArticle = await this.createNewsArticle(article);
      newsArticles.push(newsArticle);
    }
    return newsArticles;
  }

  async getUserClaims(userId: string): Promise<UserClaim[]> {
    return Array.from(this.userClaims.values()).filter(
      (claim) => claim.userId === userId
    );
  }

  async getUserClaimForArticle(userId: string, articleId: string): Promise<UserClaim | undefined> {
    return Array.from(this.userClaims.values()).find(
      (claim) => claim.userId === userId && claim.articleId === articleId
    );
  }

  async createUserClaim(claim: InsertUserClaim): Promise<UserClaim> {
    const id = randomUUID();
    const userClaim: UserClaim = {
      ...claim,
      id,
      claimedAt: new Date(),
    };
    this.userClaims.set(id, userClaim);
    return userClaim;
  }

  async getUserDailyClaims(userId: string, date: Date): Promise<UserClaim[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.userClaims.values()).filter(
      (claim) => 
        claim.userId === userId &&
        claim.claimedAt >= startOfDay &&
        claim.claimedAt <= endOfDay
    );
  }
}

export const storage = new MemStorage();
