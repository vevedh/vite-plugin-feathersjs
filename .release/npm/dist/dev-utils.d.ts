interface DevUser {
    name: string | undefined;
    email: string | undefined;
}
export declare const getDevUser: () => Promise<DevUser>;
export declare const getSandbox: () => string | undefined;
export {};
