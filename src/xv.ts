import xvideos from '@rodrigogs/xvideos';
import * as puppeteer from 'puppeteer';
const getVid = async (page = 1, size = 1, search = '', puppeteerConfig: puppeteer.PuppeteerNodeLaunchOptions & puppeteer.ConnectOptions) => {

    console.log({ search, page });
    const { videos } = await xvideos.videos.search({ page, k: search });
    let resultList = videos.length > size && size > 0 ? videos.splice(0, size) : videos;

    return await Promise.all(await resultList.map(async video => {
        const { image, title, url, files: { high, low } } = await xvideos.videos.details(video, puppeteerConfig);
        const response = { image, title, url, high, low };
        console.log({ response });
        return response;

    }));
};

export { getVid };;