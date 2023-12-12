import wiki, { Result } from 'wikijs';
export default class Wikipedia {
    private wiki = wiki({ apiUrl: 'https://pt.wikipedia.org/w/api.php' });

    public async getWikiInfo(searchTerm: string): Promise<Result> {
        return await this.wiki.search(searchTerm);
    }
    public async sumary(searchTerm: string): Promise<string> {
        const page = await this.wiki.find(searchTerm, pages => pages.find(async p => (await p.categories?.(true))));
        return await page.summary();
    }
}