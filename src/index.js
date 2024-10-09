const GoogleScraper = require('./google');
const logger = require('./logger');

// Function to download images
async function downloadImages(queries, limit = 5, directory = 'downloads') {
    const scraper = new GoogleScraper();
    try {
        await scraper.downloadImages(queries, limit, directory);
        logger.info('Images downloaded successfully');
        return true;
    } catch (error) {
        logger.error('Error downloading images:', error);
        return false;
    }
}

// Function to list image URLs
async function listImageUrls(queries, limit = 5) {
    const scraper = new GoogleScraper();
    try {
        const imageUrls = await scraper.getImageUrl(queries, limit);
        return Object.values(imageUrls).flat().map(item => item.url);
    } catch (error) {
        logger.error('Error fetching image URLs:', error);
        return [];
    }
}

// Export both functions
module.exports = { downloadImages, listImageUrls };
