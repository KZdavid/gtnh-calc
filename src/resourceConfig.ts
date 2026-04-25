type RuntimeResourceConfig = {
    resourceBaseUrl?: string;
};

declare global {
    interface Window {
        GTNH_RESOURCE_CONFIG?: RuntimeResourceConfig;
    }
}

const DEFAULT_DATA_PATH = "./data.bin";
const DEFAULT_ATLAS_PATH = "./atlas.webp";

function trimLeadingDotSlash(path: string): string {
    return path.replace(/^\.\//, "");
}

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function getRuntimeConfig(): RuntimeResourceConfig {
    return window.GTNH_RESOURCE_CONFIG ?? {};
}

function resolveConfiguredUrl(path: string): string {
    const { resourceBaseUrl } = getRuntimeConfig();
    if (!resourceBaseUrl) {
        return path;
    }

    return new URL(trimLeadingDotSlash(path), normalizeBaseUrl(resourceBaseUrl)).toString();
}

export function getRepositoryDataUrl(): string {
    return resolveConfiguredUrl(DEFAULT_DATA_PATH);
}

export function getAtlasUrl(): string {
    return resolveConfiguredUrl(DEFAULT_ATLAS_PATH);
}

export function applyResourceCssVariables(): void {
    document.documentElement.style.setProperty("--resource-atlas-url", `url(\"${getAtlasUrl()}\")`);
}
