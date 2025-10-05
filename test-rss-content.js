const Parser = require('rss-parser');

(async () => {
  const parser = new Parser({
    customFields: {
      item: ['content:encoded']
    }
  });
  const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
  const firstItem = feed.items[0];
  console.log('Title:', firstItem.title);
  console.log('Link:', firstItem.link);
  console.log('Description:', firstItem.contentSnippet);
  console.log('Full Content:', firstItem['content:encoded'] ? firstItem['content:encoded'].slice(0, 500) + '...' : 'No full content');
})();
