import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();
const API_KEY = 'bd13a0ca9c2965fcd895a55cc9989037099a70ef';
const CRYPTO_PANIC_API = 'https://cryptopanic.com/api/v1/posts/';

router.get('/news', async (req, res) => {
  try {
    const response = await fetch(`${CRYPTO_PANIC_API}?auth_token=${API_KEY}&public=true&kind=news`);
    const data = await response.json() as {
      results: Array<{
        id: number;
        title: string;
        url: string;
        published_at: string;
        source: { title: string; domain: string };
        metadata?: { description?: string; image?: { url: string } };
      }>;
    };
    
    // Transform the data to match our frontend expectations
    const transformedResults = data.results.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.metadata?.description || '',
      source: {
        title: item.source.title,
        domain: item.source.domain
      },
      published_at: item.published_at,
      image: item.metadata?.image?.url || null,
      original_url: item.url
    }));

    res.json({
      results: transformedResults
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ message: 'Failed to fetch news' });
  }
});

export default router;
