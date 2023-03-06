
export interface Secrets {
    openai: Openai;
    facebook: Facebook;
    phoneNumbers: PhoneNumbers;
}
export interface Openai {
    apiKey: string;
}
export interface Facebook {
    accountId: string;
    accessToken: string;
    verifyToken: string;
}
export interface PhoneNumbers {
    admins: string[];
}

export const loadSecrets = (jsonString: string): Secrets => {
    const secrets = JSON.parse(jsonString) as Secrets;
    return secrets;
}
