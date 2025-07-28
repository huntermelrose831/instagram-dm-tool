const fs = require('fs');

const puppeteer = require('puppeteer');

async function scrapeProduct(url) {

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

const page = await browser.newPage();

await page.setUserAgent(

'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +

'AppleWebKit/537.36 (KHTML, like Gecko) ' +

'Chrome/91.0.4472.124 Safari/537.36'

);

await page.goto(url, { waitUntil: 'networkidle2' });

await page.waitForSelector('[aria-label="Close"]', { timeout: 5000 });
console.log('clicking close button if it exists...');
await page.click('[aria-label="Close"]');
  





await autoScroll(page, 'div.x5yr21d');

await page.waitForSelector('span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.xo1l8bm.x5n08af.x10wh9bi.xpm28yp.x8viiok.x1o7cslx a', { timeout: 5000 });
console.log('scrolling done moving on to scraping...');
const elements = await page.$$('span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.xo1l8bm.x5n08af.x10wh9bi.xpm28yp.x8viiok.x1o7cslx a');

const data = (await Promise.all(elements.map(async el => {
  // Remove 'Verified' and trim
  return (await page.evaluate(el => el.textContent, el)).replace('Verified', '').trim();
})))
// Filter out empty strings and entries that end with 'likes'
.filter(username => username && !/likes$/i.test(username));
console.log(data);



await browser.close();
return data;

}

async function autoScroll(page, selector) {
  await page.waitForSelector(selector, { timeout: 10000 });
  const scrollableSection = await page.$(selector);

  if (!scrollableSection) {
    throw new Error(`Could not find element with selector: ${selector}`);
  }

  let lastHeight = await page.evaluate(el => el.scrollHeight, scrollableSection);

  while (true) {
    await page.evaluate(el => el.scrollTo(0, el.scrollHeight), scrollableSection);
    
    const newHeight = await page.evaluate(el => el.scrollHeight, scrollableSection);
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
  }
}



module.exports = { scrapeProduct };