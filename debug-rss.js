import Parser from 'rss-parser';

(async () => {
  try {
    console.log('Testing RSS content extraction...');
    
    const parser = new Parser({
      customFields: {
        item: ['content:encoded', ['media:content', 'media'], ['media:thumbnail', 'thumbnail'], ['enclosure', 'enclosure']]
      }
    });
    
    const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    const item = feed.items[0];
    
    console.log('\n=== FIRST ARTICLE DEBUG ===');
    console.log('Title:', item.title);
    console.log('Link:', item.link);
    console.log('Content snippet length:', item.contentSnippet?.length || 0);
    console.log('Content snippet preview:', item.contentSnippet?.slice(0, 200) || 'No snippet');
    console.log('Full content:encoded length:', item['content:encoded']?.length || 0);
    console.log('Full content:encoded preview:', item['content:encoded']?.slice(0, 300) || 'No encoded content');
    console.log('Regular content:', item.content?.slice(0, 200) || 'No regular content');
    
    console.log('\n=== TESTING WHAT SERVER SENDS ===');
    const serverData = {
      id: "1",
      title: item.title || '',
      description: item.contentSnippet || item.content || '',
      content: item['content:encoded'] || '',
      published_at: item.pubDate || new Date().toISOString(),
      kind: "news",
      source: {
        title: 'CoinDesk',
        domain: 'coindesk.com'
      },
      original_url: item.link || '',
      image: item.media?.$.url || item.enclosure?.url || item.thumbnail?.$.url || null,
    };
    
    console.log('Server content field length:', serverData.content.length);
    console.log('Server content preview:', serverData.content.slice(0, 300));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
