import express from 'express';
import type { Express } from "express";
import { storage } from "./storage.js";

let redis: any = null;

async function getRedis() {
  if (redis) return redis;
  
  try {
    const { Redis } = await import('@upstash/redis');
    redis = new Redis({
      url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
    console.log('✅ Connected to Upstash Redis');
    return redis;
  } catch (err) {
    console.warn('⚠️ Redis not available, using in-memory storage');
    return null;
  }
}

const memoryArticles = new Map<string, Set<string>>();
const memoryClaims = new Map<string, any>();
const memoryTime = new Map<string, number>();

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function registerFarcasterRoutes(app: Express) {
  // Record article read
  app.post("/api/record-article", async (req, res) => {
    try {
      const { fid, articleId } = req.body;
      
      if (!fid || !articleId) {
        return res.status(400).json({ error: "Missing fid or articleId" });
      }

      const today = getTodayKey();
      const articlesKey = `user:${fid}:articles:${today}`;
      const timeKey = `user:${fid}:lastArticleTime`;
      
      const db = await getRedis();
      
      if (db) {
        // Use Redis
        const articles = await db.get(articlesKey) || [];
        if (!articles.includes(articleId)) {
          articles.push(articleId);
          await db.set(articlesKey, articles);
          await db.expire(articlesKey, 86400); // Expire after 24 hours
        }
        await db.set(timeKey, Date.now());
        
        res.json({ 
          success: true, 
          articlesRead: articles.length,
          message: `Article ${articleId} recorded for FID ${fid}`
        });
      } else {
        // Fallback to in-memory
        const key = `${fid}:${today}`;
        if (!memoryArticles.has(key)) {
          memoryArticles.set(key, new Set());
        }
        const articles = memoryArticles.get(key)!;
        articles.add(articleId);
        memoryTime.set(fid.toString(), Date.now());
        
        res.json({ 
          success: true, 
          articlesRead: articles.size,
          message: `Article ${articleId} recorded for FID ${fid}`
        });
      }
    } catch (error) {
      console.error("Error recording article:", error);
      res.status(500).json({ error: "Failed to record article" });
    }
  });

  // Check eligibility for claiming
  app.post("/api/check-eligibility", async (req, res) => {
    try {
      const { fid } = req.body;
      
      if (!fid) {
        return res.status(400).json({ error: "Missing fid" });
      }

      const today = getTodayKey();
      const articlesKey = `user:${fid}:articles:${today}`;
      const claimKey = `user:${fid}:claims`;
      const timeKey = `user:${fid}:lastArticleTime`;
      
      const db = await getRedis();
      
      if (db) {
        // Use Redis
        const articles = await db.get(articlesKey) || [];
        const articlesRead = articles.length;
        
        const claimData = await db.get(claimKey) || { lastClaimDate: '', claimedToday: false };
        const hasClaimedToday = claimData.lastClaimDate === today;
        
        const lastTime = await db.get(timeKey) || 0;
        const tenSecondsPasssed = (Date.now() - lastTime) >= 10000;
        
        const eligible = articlesRead >= 3 && !hasClaimedToday && tenSecondsPasssed;
        
        res.json({
          eligible,
          articlesRead,
          hasClaimedToday,
          tenSecondsPasssed,
          timeRemaining: tenSecondsPasssed ? 0 : Math.ceil((10000 - (Date.now() - lastTime)) / 1000)
        });
      } else {
        // Fallback to in-memory
        const key = `${fid}:${today}`;
        const articles = memoryArticles.get(key) || new Set();
        const articlesRead = articles.size;
        
        const claimData = memoryClaims.get(fid.toString()) || { lastClaimDate: '', claimedToday: false };
        const hasClaimedToday = claimData.lastClaimDate === today;
        
        const lastTime = memoryTime.get(fid.toString()) || 0;
        const tenSecondsPasssed = (Date.now() - lastTime) >= 10000;
        
        const eligible = articlesRead >= 3 && !hasClaimedToday && tenSecondsPasssed;
        
        res.json({
          eligible,
          articlesRead,
          hasClaimedToday,
          tenSecondsPasssed,
          timeRemaining: tenSecondsPasssed ? 0 : Math.ceil((10000 - (Date.now() - lastTime)) / 1000)
        });
      }
    } catch (error) {
      console.error("Error checking eligibility:", error);
      res.status(500).json({ error: "Failed to check eligibility" });
    }
  });

  // Record claim
  app.post("/api/record-claim", async (req, res) => {
    try {
      const { fid, tokens, txHash } = req.body;
      
      if (!fid) {
        return res.status(400).json({ error: "Missing fid" });
      }

      const today = getTodayKey();
      const claimKey = `user:${fid}:claims`;
      
      const db = await getRedis();
      
      if (db) {
        // Use Redis
        await db.set(claimKey, {
          lastClaimDate: today,
          claimedToday: true,
          tokens,
          txHash
        });
        await db.expire(claimKey, 86400 * 2); // Expire after 2 days
      } else {
        // Fallback to in-memory
        memoryClaims.set(fid.toString(), {
          lastClaimDate: today,
          claimedToday: true
        });
      }
      
      // Also store in existing storage for compatibility
      try {
        await storage.createUserClaim({
          userId: `fid-${fid}`,
          articleId: 'daily-claim',
          tokensEarned: tokens?.length || 1
        });
      } catch (err) {
        console.error('Failed to store in legacy storage:', err);
      }
      
      res.json({ 
        success: true,
        message: `Claim recorded for FID ${fid}`,
        tokens,
        txHash
      });
    } catch (error) {
      console.error("Error recording claim:", error);
      res.status(500).json({ error: "Failed to record claim" });
    }
  });

  // Get user stats
  app.get("/api/user-stats/:fid", async (req, res) => {
    try {
      const { fid } = req.params;
      
      const today = getTodayKey();
      const articlesKey = `user:${fid}:articles:${today}`;
      const claimKey = `user:${fid}:claims`;
      
      const db = await getRedis();
      
      if (db) {
        // Use Redis
        const articles = await db.get(articlesKey) || [];
        const claimData = await db.get(claimKey) || { lastClaimDate: '', claimedToday: false };
        
        res.json({
          fid: parseInt(fid),
          articlesReadToday: articles.length,
          hasClaimedToday: claimData.lastClaimDate === today,
          lastClaimDate: claimData.lastClaimDate || null
        });
      } else {
        // Fallback to in-memory
        const key = `${fid}:${today}`;
        const articles = memoryArticles.get(key) || new Set();
        const claimData = memoryClaims.get(fid) || { lastClaimDate: '', claimedToday: false };
        
        res.json({
          fid: parseInt(fid),
          articlesReadToday: articles.size,
          hasClaimedToday: claimData.lastClaimDate === today,
          lastClaimDate: claimData.lastClaimDate || null
        });
      }
    } catch (error) {
      console.error("Error getting user stats:", error);
      res.status(500).json({ error: "Failed to get user stats" });
    }
  });
}
