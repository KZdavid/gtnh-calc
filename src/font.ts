import type { GameDataLocale } from "./resourceConfig.js";
import { getFontsConfig, resolveFontUrl } from "./resourceConfig.js";

const FONT_PREF_KEY = "gtnh.selectedFont";

let userFontStyleEl: HTMLStyleElement | null = null;

type FontFormatConfig = {
    uiSizePx?: number;
    uiLineHeightPx?: number;
    controlSizePx?: number;
    controlLineHeightPx?: number;
    inputLineHeightPx?: number;
    smallSizePx?: number;
    smallLineHeightPx?: number;
    smallWordSpacingPx?: number;
};

type FontLocaleProfile = {
    format?: FontFormatConfig;
};

const defaultFontFormat: Required<FontFormatConfig> = {
    uiSizePx: 16,
    uiLineHeightPx: 22,
    controlSizePx: 16,
    controlLineHeightPx: 22,
    inputLineHeightPx: 16,
    smallSizePx: 8,
    smallLineHeightPx: 8,
    smallWordSpacingPx: 1,
};

const fontProfiles: Record<string, FontLocaleProfile> = {
    default: {},
    en: {},
    "zh-cn": {
        format: {
            uiSizePx: 18,
            uiLineHeightPx: 24,
            controlSizePx: 18,
            controlLineHeightPx: 24,
            inputLineHeightPx: 18,
            smallSizePx: 9,
            smallLineHeightPx: 9,
            smallWordSpacingPx: 1,
        },
    },
};

function normalizeLocaleKey(locale: string): string {
    return locale.toLowerCase();
}

function resolveLocaleProfile(locale: string): FontLocaleProfile {
    const normalized = normalizeLocaleKey(locale);
    if (fontProfiles[normalized]) return fontProfiles[normalized];
    const prefix = normalized.split("-")[0];
    if (fontProfiles[prefix]) return fontProfiles[prefix];
    return fontProfiles.default;
}

function resolveFontFormat(locale: string): Required<FontFormatConfig> {
    return { ...defaultFontFormat, ...(resolveLocaleProfile(locale).format ?? {}) };
}

function applyFontFormat(locale: string): void {
    const rootStyle = document.documentElement.style;
    const format = resolveFontFormat(locale);
    rootStyle.setProperty("--font-ui-size", `${format.uiSizePx}px`);
    rootStyle.setProperty("--font-ui-line-height", `${format.uiLineHeightPx}px`);
    rootStyle.setProperty("--font-ui-control-size", `${format.controlSizePx}px`);
    rootStyle.setProperty("--font-ui-control-line-height", `${format.controlLineHeightPx}px`);
    rootStyle.setProperty("--font-ui-input-line-height", `${format.inputLineHeightPx}px`);
    rootStyle.setProperty("--font-ui-small-size", `${format.smallSizePx}px`);
    rootStyle.setProperty("--font-ui-small-line-height", `${format.smallLineHeightPx}px`);
    rootStyle.setProperty("--font-ui-small-word-spacing", `${format.smallWordSpacingPx}px`);
}

export function applyDatabaseLocaleFont(databaseLocale: GameDataLocale): void {
    document.documentElement.dataset.dbLocale = databaseLocale;
    applyFontFormat(databaseLocale);
}

export function getSelectedFontKey(): string | null {
    return localStorage.getItem(FONT_PREF_KEY);
}

export function applySelectedFont(key: string): void {
    const { options } = getFontsConfig();
    if (!options) return;

    const option = options[key];
    if (!option) return;

    localStorage.setItem(FONT_PREF_KEY, key);

    if (option.systemOnly) {
        // Use secondary font stack only, skip primary entirely
        userFontStyleEl?.remove();
        userFontStyleEl = null;
        document.documentElement.style.removeProperty("--font-ui-primary");
        document.documentElement.style.setProperty("--font-ui", "var(--font-ui-secondary)");
        return;
    }

    if (!option.url) {
        // No custom URL: revert to the default SDK_SC_Web primary font
        userFontStyleEl?.remove();
        userFontStyleEl = null;
        document.documentElement.style.removeProperty("--font-ui-primary");
        document.documentElement.style.removeProperty("--font-ui");
        return;
    }

    const resolvedUrl = resolveFontUrl(option.url);
    const familyName = `UserFont_${key}`;

    if (!userFontStyleEl) {
        userFontStyleEl = document.createElement("style");
        document.head.appendChild(userFontStyleEl);
    }
    userFontStyleEl.textContent = [
        `@font-face {`,
        `    font-family: '${familyName}';`,
        `    src: url('${resolvedUrl}') format('truetype');`,
        `    font-display: swap;`,
        `}`,
    ].join("\n");

    document.documentElement.style.removeProperty("--font-ui");
    document.documentElement.style.setProperty("--font-ui-primary", `"${familyName}"`);
}

export function applyInitialFontPreference(): void {
    const { options, default: defaultKey } = getFontsConfig();
    if (!options || Object.keys(options).length === 0) return;

    const saved = getSelectedFontKey();
    const key = (saved && options[saved]) ? saved : defaultKey;
    if (key && options[key]) {
        applySelectedFont(key);
    }
}