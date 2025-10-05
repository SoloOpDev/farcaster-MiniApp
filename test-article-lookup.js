import Parser from 'rss-parser';
import fetch from 'node-fetch';

// Helpers from routes.js
function encodeId(link) {
  return encodeURIComponent(link);
}

function decodeId(id) {
  try {
    return decodeURIComponent(id);
  } catch {
    return null;
  }
}

async function testArticleLookup() {
  console.log('Fetching live RSS feed from CoinDesk...');
  const parser = new Parser();
  const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');

  if (!feed.items || feed.items.length === 0) {
    console.error('Error: Failed to fetch or parse RSS feed.');
    return;
  }

  const firstArticle = feed.items[0];
  const originalLink = firstArticle.link;
  console.log(`\n--- Testing with the first article ---`);
  console.log(`Original Link: ${originalLink}`);

  const generatedId = encodeId(originalLink);
  console.log(`Generated ID: ${generatedId}`);

  const decodedLink = decodeId(generatedId);
  console.log(`Decoded Link:  ${decodedLink}`);

  if (originalLink !== decodedLink) {
    console.error('Error: Link does not match after encoding and decoding!');
    return;
  }

  console.log('\n--- Simulating API Lookup ---');
  const foundItem = feed.items.find(item => item.link === decodedLink);

  if (foundItem) {
    console.log('✅ Success: Article found in the feed using the decoded link.');
    console.log(`Found Title: ${foundItem.title}`);
  } else {
    console.error('❌ Error: Could not find the article in the feed using the decoded link.');
  }
}

testArticleLookup();
