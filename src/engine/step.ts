export type Step<T = unknown> = {
    title: string;
    body: string;
    target?: string | null;
    next?: string;
    start?: () => T;
    done?: (s: T) => boolean;
};
export const defineStep = <T>(s: Step<T>) => s;