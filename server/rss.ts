import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'media'],
      ['media:thumbnail', 'thumbnail'],
      ['enclosure', 'enclosure'],
    ],
  },
});

export async function fetchCoinDeskRSS() {
  try {
    const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    console.log('RSS Feed fetched:', feed.items?.length || 0, 'items');
    
    // Debug: Check first item's structure
    if (feed.items.length > 0) {
      const firstItem = feed.items[0] as any;
      console.log('🔍 First item keys:', Object.keys(firstItem));
      console.log('🔍 contentEncoded:', firstItem.contentEncoded ? firstItem.contentEncoded.substring(0, 200) : 'NOT FOUND');
      console.log('🔍 content:encoded:', firstItem['content:encoded'] ? firstItem['content:encoded'].substring(0, 200) : 'NOT FOUND');
      console.log('🔍 content:', firstItem.content ? firstItem.content.substring(0, 200) : 'NOT FOUND');
    }
    
    const results = feed.items.slice(0, 10).map((item: any, index) => {
      const url = item.link || '';
      const id = (index + 1).toString();
      
      // Try multiple ways to access the encoded content
      const fullContent = item.contentEncoded || item['content:encoded'] || item.content || '';
      const description = item.contentSnippet || item.summary || '';
      
      console.log(`📰 Article ${id}: ${item.title?.substring(0, 50)}... - Content: ${fullContent ? fullContent.length : 0} chars, Description: ${description.length} chars`);
      
      return {
        id,
        title: item.title || '',
        description,
        content: fullContent, // Include full content from RSS
        sourceTitle: 'CoinDesk',
        sourceDomain: 'coindesk.com',
        publishedAt: new Date(item.pubDate || new Date().toISOString()),
        createdAt: new Date(),
        image: item.media?.$.url || item.enclosure?.url || item.thumbnail?.$.url || null,
        originalUrl: url,
        kind: 'article',
        author: item.creator || null
      };
    });

    console.log('✅ Transformed results:', results.length, 'articles with content');
    return { results };
  } catch (error) {
    console.error('❌ Error fetching RSS feed:', error);
    throw error;
  }
}
