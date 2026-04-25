type RuntimeResourceConfig = {
    resourceBaseUrl?: string;
};

declare global {
    interface Window {
        GTNH_RESOURCE_CONFIG?: RuntimeResourceConfig;
    }
}


// For local mode, use data/data.bin and data/atlas.webp
const LOCAL_DATA_PATH = "./data/data.bin";
const LOCAL_ATLAS_PATH = "./data/atlas.webp";
// For CDN mode, use data.bin and atlas.webp in root
const CDN_DATA_PATH = "./data.bin";
const CDN_ATLAS_PATH = "./atlas.webp";

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


// If resourceBaseUrl is set, use CDN paths; otherwise use local paths
export function getRepositoryDataUrl(): string {
    const { resourceBaseUrl } = getRuntimeConfig();
    return resolveConfiguredUrl(resourceBaseUrl ? CDN_DATA_PATH : LOCAL_DATA_PATH);
}

export function getAtlasUrl(): string {
    const { resourceBaseUrl } = getRuntimeConfig();
    return resolveConfiguredUrl(resourceBaseUrl ? CDN_ATLAS_PATH : LOCAL_ATLAS_PATH);
}

export function applyResourceCssVariables(): void {
    document.documentElement.style.setProperty("--resource-atlas-url", `url(\"${getAtlasUrl()}\")`);
}
