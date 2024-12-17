'use strict';

const puppeteer = require('puppeteer-extra')
const fs = require("fs");
const axios = require("axios");
const path = require('path');
const logger = require('../logger');

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin());

const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))
/**
 * @param {string | array} userAgent user agent
 * @param {object} puppeteer puppeteer options
 * @param {object} tbs extra options for TBS request parameter
 */
class GoogleScraper {
  constructor({
    userAgent = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_5) AppleWebKit/537.36 (KHTML, like Gecko) Version/15.5 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.101 Safari/537.36',
    ],
    scrollDelay = 500,
    puppeteer = { headless: false },
    tbs = {},
    safe = false,
  } = {}) {
    this.userAgent = Array.isArray(userAgent)
      ? userAgent[Math.floor(Math.random() * userAgent.length)]
      : userAgent;
    this.scrollDelay = scrollDelay;
    this.puppeteerOptions = puppeteer;
    this.tbs = this._parseRequestParameters(tbs);
    this.safe = this._isQuerySafe(safe);
    this.browser = null;
  }
  /**
   * Method to download images based on query
   * @param {string | string[]} queries 
   * @param {number} limit 
   * @param {string} directory 
   * @returns {object}
   */
  async downloadImages(queries, limit = 5, directory = 'downloads') {
    const downloadFolder = path.join(process.cwd(), directory);

    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder);
    }

    const imageUrls = await this.getImageUrl(queries, limit);

    for (const queryKey in imageUrls) {
      const imageUrlList = imageUrls[queryKey];
      for (let i = 0; i < imageUrlList.length; i++) {
        const { url } = imageUrlList[i];
        let extension = '.jpg';
        try {
          const response = await axios.head(url);
          const contentType = response.headers['content-type'];
          if (contentType) {
            if (contentType.includes('image/jpeg')) extension = '.jpg';
            else if (contentType.includes('image/png')) extension = '.png';
            else if (contentType.includes('image/gif')) extension = '.gif';
            else if (contentType.includes('image/webp')) extension = '.webp';
          }
        } catch (error) {
          logger.info(`Error fetching headers for ${url}: ${error.message}`);
        }
        const fileName = `${queryKey}_${i + 1}${extension}`;
        const queryDownloadPath = path.join(downloadFolder, queryKey);
        if (!fs.existsSync(queryDownloadPath)) {
          fs.mkdirSync(queryDownloadPath);
        }

        const filePath = path.join(queryDownloadPath, fileName);

        try {
          const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
          fs.writeFileSync(filePath, imageResponse.data);
          logger.info(`Downloaded ${fileName}`);
        } catch (error) {
          logger.error(`Error downloading image from ${url}: ${error.message}`);
        }
      }
      logger.info(`Saved files at ${downloadFolder}`);
    }

    return imageUrls;
  }

  /**
   * Method to get an object with image urls  
   * @param {string | string[]} queries 
   * @param {number} limit 
   * @returns {object}
   */
  async getImageUrl(queries, limit = 5) {
    try {
  console.log(this.userAgent);

      const browser = await puppeteer.launch({
        headless: false, // Turn off headless mode to see the window
        args: [
          '--start-maximized', // Ensure the browser starts maximized
          '--window-size=1920,1080', // Set the window size explicitly
        ],
        defaultViewport: null, // Disable Puppeteer's default viewport settings
        ...this.puppeteerOptions // Include any additional options
      });
    
      const [page] = await browser.pages(); // Get the default page created at launch
    
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });
      // Set custom viewport size
      await page.setViewport({
        width: 1920,
        height: 1080,
      });

      await page.setBypassCSP(true);
      await page.setUserAgent(this.userAgent);
      const queriesIsArray = Array.isArray(queries);
      const imageUrlObject = {};
  
      /**
       * Fetch URLs for a given query
       * @param {string} query
       */
      const getUrls = async (query) => {
        const queryKey = query.replace(/\s/g, '');
        imageUrlObject[queryKey] = [];
      
        const pageUrl = `https://www.google.com/search?${this.safe}&source=lnms&tbs=${this.tbs},isz:l&tbm=isch&q=${this._parseRequestQueries(query)}`;
        logger.debug(pageUrl);
        await page.goto(pageUrl);

        // to check if capctha is present, if so wait until human removes it
        const captchaElement = await page.$('div[style*="font-size:13px"] b');
        if (captchaElement) {
            const captchaText = await page.evaluate(el => el.textContent, captchaElement);
            if (captchaText.includes("About this page")) {
                console.error("CAPTCHA detected. Waiting for manual intervention...");

                // Wait for the CAPTCHA to be solved manually
                await page.waitForFunction(
                    () => !document.querySelector('div[style*="font-size:13px"] b'), // Wait until CAPTCHA is no longer present
                    { timeout: 0 } // Set timeout to infinite
                );

                console.log("CAPTCHA solved. Resuming scraping...");
            }
        }



        // to find if image not found
        const element = await page.$('div.v3jTId[role="heading"]');
        if (element) {
          const textContent = await page.evaluate(el => el.textContent, element);
          console.log(textContent.includes("It looks like there aren't any 'Images' matches on this topic"));
          if(textContent.includes("It looks like there aren't any 'Images' matches on this topic")){
            return;
          }
        }
        // Scroll to load all thumbnails
        await page.evaluate(async () => {
          for (let i = 0; i < 10; i++) {
            window.scrollBy(0, window.innerHeight);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        });
      
        // Wait for thumbnails to load
        await page.waitForSelector('g-img.mNsIhb img.YQ4gaf', { visible: true, timeout: 90000 });
      
        // Collect all thumbnail elements
        const thumbnails = await page.$$('g-img.mNsIhb img.YQ4gaf');
        logger.info(`Found ${thumbnails.length} thumbnails for query "${query}"`);
      
        for (let i = 0; i < Math.min(thumbnails.length, limit); i++) {
          try {
            const updatedThumbnails = await page.$$('g-img.mNsIhb img.YQ4gaf');
            const thumbnail = updatedThumbnails[i];
      
            if (!thumbnail) {
              logger.warn(`Thumbnail ${i + 1} not found after refresh! Skipping...`);
              continue;
            }
      
            // Scroll thumbnail into view and click
            await page.evaluate((thumb) => thumb.scrollIntoView({ behavior: 'smooth', block: 'center' }), thumbnail);
            await page.waitForTimeout(500);
            await thumbnail.click();
      
            // Wait for the high-resolution image to load
            const fullImageSelector = 'img[aria-hidden="false"][jsname="kn3ccd"]'; // Ensure this matches the class in your DOM

            // Wait for the full image to load after clicking the thumbnail
            await page.waitForSelector(fullImageSelector, { visible: true, timeout: 20000 });
            
            const fullImageUrl = await page.evaluate(() => {
              const fullImageElement = document.querySelector('img[aria-hidden="false"][jsname="kn3ccd"]');
              return fullImageElement ? fullImageElement.src : null;
            });
            
            
            if (fullImageUrl) {
              imageUrlObject[queryKey].push({ query, url: fullImageUrl });
              logger.info(`Extracted high-res image URL: ${fullImageUrl}`);
            } else {
              logger.warn('High-resolution image not found.');
            }
          } catch (err) {
            logger.warn(`Error processing image ${i + 1} for query "${query}": ${err.message}`);
            await page.screenshot({ path: `error_image_${queryKey}_${i + 1}.png` });
            const pageContent = await page.content();
            fs.writeFileSync(`error_page_${queryKey}_${i + 1}.html`, pageContent);
          }
      
          // Go back to the search results page
          await page.goBack({ waitUntil: 'networkidle2' });
          await page.waitForSelector('g-img.mNsIhb img.YQ4gaf', { visible: true, timeout: 90000 });
        }
      };
      
  
      if (queriesIsArray) {
        for (const query of queries) {
          await getUrls(query);
        }
      } else {
        await getUrls(queries);
      }
  
      await browser.close();
      return imageUrlObject;
  
    } catch (err) {
      logger.error('An error occurred:', err);
    }
  }
  

  _parseRequestParameters(tbs) {
    if (!tbs) {
      return '';
    }

    return encodeURIComponent(
      Object.entries(tbs)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}:${value}`)
        .join(',')
    );
  }

  _parseRequestQueries(query) {
    return query ? encodeURIComponent(query) : '';
  }

  _isQuerySafe(safe) {
    return safe ? '&safe=active' : '';
  }
}

module.exports = GoogleScraper;
