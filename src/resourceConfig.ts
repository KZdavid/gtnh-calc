/**
 * Game-data locale is intentionally independent from UI locale.
 * UI text and in-game data (items/recipes/machine names) can be chosen separately.
 * This type is only for game content language selection.
 */
export type GameDataLocale = "en" | "zh-CN";

type ResourceKey = 'data' | 'atlas';

export type FontOption = {
    label: string;
    url?: string;
    systemOnly?: boolean;
};

export type FontsConfig = {
    default?: string;
    options?: Record<string, FontOption>;
};

type RuntimeResourceConfig = {
    resources?: Partial<Record<ResourceKey, string>>;
    fonts?: FontsConfig;
};

declare global {
    interface Window {
        GTNH_RESOURCE_CONFIG?: RuntimeResourceConfig;
    }
}

const DEFAULT_PATHS: Record<ResourceKey, string> = {
    data:  "./data/data.bin",
    atlas: "./data/atlas.webp",
};

function getRuntimeConfig(): RuntimeResourceConfig {
    return window.GTNH_RESOURCE_CONFIG ?? {};
}

export function getResourceUrl(key: ResourceKey): string {
    const override = getRuntimeConfig().resources?.[key];
    return override ?? new URL(DEFAULT_PATHS[key], document.baseURI).href;
}

export function getRepositoryDataUrl(): string {
    return getResourceUrl('data');
}

export function getAtlasUrl(): string {
    return getResourceUrl('atlas');
}

export function applyResourceCssVariables(): void {
    document.documentElement.style.setProperty(
        "--resource-atlas-url",
        `url("${getResourceUrl('atlas')}")`
    );
}

export function getFontsConfig(): FontsConfig {
    return getRuntimeConfig().fonts ?? {};
}

export function resolveFontUrl(url: string): string {
    return new URL(url, document.baseURI).href;
}
