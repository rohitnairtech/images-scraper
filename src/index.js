const GoogleScraper = require('./google/index');
const logger = require('./logger');

// Function to download images
async function downloadImages(queries, limit = 5, directory = 'downloads', asBuffer = false) {
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
        if(Array.isArray(queries)){
            for(key in imageUrls){
                imageUrls[key] = imageUrls[key].map(item => item.url)
            }
            return imageUrls;
        }
        return Object.values(imageUrls).flat().map(item => item.url);
    } catch (error) {
        logger.error('Error fetching image URLs:', error);
        return [];
    }
}

// Export both functions
module.exports = { downloadImages, listImageUrls };
