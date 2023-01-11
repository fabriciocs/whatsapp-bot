import { MessageMedia } from 'whatsapp-web.js';
import WPAPI from 'wpapi';
import { giveMeImage, writeAText, writeInstructions } from './ai';
import CurrierModel from './currier';
import { prepareText } from './util';

const baseBlogPrompt = 'crie um post de blog comercial focado em grandes empresas e startups disruptivas baseado no texto:';
const baseImagePrompt = 'crie uma intrução de design digital para a criação de uma imagem que ilustre o texto:';
const buildSubject = (subject: string) => `${baseBlogPrompt}\n\n"${subject}"`;
const buildImageSubject = (prompt: string) => `${baseImagePrompt}\n\n"${prompt}"`;

export type Post = {
    title: string;
    content: string;
    status: string;
    categories: number[];
};


export type AiPost = {
    title: string;
    prompt: string;
    status: string;
};

export type PostResponse = {
    id: number;
    date: string;
    date_gmt: string;
    guid: { rendered: string };
    modified: string;
    modified_gmt: string;
    slug: string;
    status: string;
    type: string;
    link: string;
    title: { rendered: string };
    content: {
        rendered: string;
        protected: boolean;
    };
    excerpt: {
        rendered: string;
        protected: boolean;
    };
    author: number;
    featured_media: number;
    comment_status: string;
    ping_status: string;
    sticky: boolean;
    template: string;
    format: string;
    meta: [];
    categories: number[];
    tags: [];
    _links: {
        self: { href: string }[];
        collection: [{ href: string }];
        about: [{ href: string }];
        author: [{ embeddable: boolean; href: string }];
        replies: [{ embeddable: boolean; href: string }];
        'version-history': [{ count: number; href: string }];
        'wp:attachment': [{ href: string }];
        'wp:term': [{ taxonomy: string; embeddable: boolean; href: string }];
        curies: [{ name: string; href: string; templated: boolean }];
    };
    _paging: {
        total: number;
        totalPages: number;
        links: { 'https://api.w.org/': string };
    };
};




export default class Wordpress {
    private wpApi: any;

    constructor(private currie: CurrierModel, private wordpressUrl: string = process.env.WP_SITE_URL,  username: string = process.env.WP_USERNAME, password: string = process.env.WP_PASSWORD) {
        this.wpApi = new WPAPI({
            endpoint: this.wordpressUrl,
            username,
            password
        });
    }

    public get Api() {
        return this.wpApi;
    }
    public async getPosts(): Promise<PostResponse[]> {
        return await this.wpApi.posts().get();
    }

    
    public async getPages(): Promise<any[]> {
        return await this.wpApi.pages().get();
    }
    public async createPost(post: Post) {
        return await this.wpApi.posts().create(post);
    }



    public async upload(imageUrl) {
        const { data } = await MessageMedia.fromUrl(imageUrl);
        const buffer = Buffer.from(data, 'base64');
        const title = `${+new Date().getTime()}.png`;
        return await this.wpApi.media().file(buffer, title).create({
            title,
            alt_text: title,
        });
    }


    public async createCategoriesFromContent(content: string, splitChar = ';') {
        const categories = await this.currie.categories(content);
        console.log({ categories })
        const list = await this.wpApi.categories().get({ per_page: 100 });

        const promises = categories.split(splitChar).filter(Boolean).map(async (category) => await this.createCategory(category?.trim(), list));
        return await Promise.all(await promises);
    }
    public async createCategory(fullname: string, list: any[] = []) {
        const category = fullname?.replace(/[\n\.]/, '').trim();
        const categoryExists = list.find((cat: any) => cat.name === category);
        if (categoryExists) return category;
        return await this.wpApi.categories().create({ name: category });
    }

    public async createAiPost({ prompt: ugly, title, status = 'publish' }: AiPost) {
        const prompt = prepareText(ugly)
        const blogSubject = buildSubject(prompt)
        const result = await writeAText({ stop: ['stop'], prompt: blogSubject });
        const fullAnswer = result?.choices?.[0]?.text;
        if (fullAnswer) {
            const fullCategories = await this.createCategoriesFromContent(prompt);

            const categories = fullCategories.map((category: any) => category?.id || 0).filter(k => k > 0);
            const postCreated = await this.createPost({ title, content: fullAnswer, status: status, categories });
            try {
                const simpleImagePrompt = buildImageSubject(prompt);
                const imagePromptResponse = await writeInstructions(simpleImagePrompt);
                const imagePrompt = imagePromptResponse?.choices?.[0]?.text;
                const imageUrl = await giveMeImage(prepareText(imagePrompt), '1024x1024');
                if (imageUrl) {
                    const { data } = await MessageMedia.fromUrl(imageUrl);
                    const buffer = Buffer.from(data, 'base64');
                    const { id } = await this.wpApi.media().file(buffer, `${postCreated.id}.png`).create({
                        title,
                        alt_text: title,
                        description: imagePrompt
                    });
                    await this.wpApi.posts().id(postCreated.id).update({ featured_media: id });
                }
            } catch (error) {
                console.error(error);
            }
            return postCreated;
        };
    }
}