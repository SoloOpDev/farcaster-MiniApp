import express from 'express';
import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/news", async (_req, res) => {
    try {
      const { fetchCoinDeskRSS } = await import('./rss');
      console.log('Fetching news from CoinDesk RSS...');
      const newsData = await fetchCoinDeskRSS();
      res.json(newsData);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ 
        message: "Failed to fetch news articles",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
