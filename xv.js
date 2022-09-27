const xvideos = require('@rodrigogs/xvideos');
const getVid = async (page = 1, size = 1, search = '', puppeteerConfig) => {

    console.log({ search, page });
    const { videos } = await xvideos.videos.search({ page, k: search });
    if (size > 1 && videos.length > size) {
        videos.splice(size);
    }
    const result = await Promise.all(await videos.map(async video => {
        const { image, title, url, files: { high, low } } = await xvideos.videos.details(video, puppeteerConfig);
        const response = { image, title, url, high, low };
        console.log({ response });
        return response;

    }));
    console.log({ result });
    return result;
};

module.exports = { getVid };