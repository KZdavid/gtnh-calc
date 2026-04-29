import { getFontsConfig } from "./resourceConfig.js";
import { applySelectedFont, getSelectedFontKey } from "./font.js";
import { pickAndStoreFile, clearLocalFile, hasLocalFile, type LocalFileKey } from "./localData.js";

function buildFontSection(container: HTMLElement): void {
    const { options, default: defaultKey } = getFontsConfig();
    if (!options || Object.keys(options).length === 0) return;

    const section = document.createElement("div");
    section.className = "settings-section";

    const heading = document.createElement("h2");
    heading.textContent = "Font";
    section.appendChild(heading);

    const row = document.createElement("div");
    row.className = "settings-row";

    const label = document.createElement("label");
    label.setAttribute("for", "settings-font-select");
    label.textContent = "Font family";
    row.appendChild(label);

    const select = document.createElement("select");
    select.id = "settings-font-select";

    const currentKey = getSelectedFontKey() ?? defaultKey;
    for (const [key, option] of Object.entries(options)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = option.label;
        if (key === currentKey) opt.selected = true;
        select.appendChild(opt);
    }

    select.addEventListener("change", () => {
        applySelectedFont(select.value);
    });

    row.appendChild(select);
    section.appendChild(row);
    container.appendChild(section);
}

async function buildLocalDataSection(container: HTMLElement): Promise<void> {
    const section = document.createElement("div");
    section.className = "settings-section";

    const heading = document.createElement("h2");
    heading.textContent = "本地数据文件 (beta)";
    section.appendChild(heading);

    for (const key of ["data.bin", "atlas.webp"] as LocalFileKey[]) {
        const row = document.createElement("div");
        row.className = "settings-row";

        const label = document.createElement("label");
        label.textContent = key;
        row.appendChild(label);

        const has = await hasLocalFile(key);

        const btn = document.createElement("button");
        btn.textContent = has ? "清除" : "选择文件…";
        btn.className = "settings-file-btn";

        const status = document.createElement("span");
        status.className = "settings-file-status";
        if (has) status.textContent = "已加载本地文件";

        btn.addEventListener("click", async () => {
            status.textContent = "";
            status.className = "settings-file-status";
            try {
                if (has) {
                    await clearLocalFile(key);
                } else {
                    await pickAndStoreFile(key);
                }
            } catch (e: any) {
                if (e?.name !== "AbortError") {
                    status.textContent = e?.message ?? "未知错误";
                    status.className = "settings-file-status settings-file-error";
                }
            }
        });

        row.appendChild(btn);
        row.appendChild(status);
        section.appendChild(row);
    }

    container.appendChild(section);
}


async function openSettingsDialog(): Promise<void> {
    const dialog = document.getElementById("settings-dialog")!;
    const body = dialog.querySelector(".settings-body")!;

    body.innerHTML = "";
    buildFontSection(body as HTMLElement);
    await buildLocalDataSection(body as HTMLElement);

    dialog.classList.remove("hidden");
}

function closeSettingsDialog(): void {
    document.getElementById("settings-dialog")?.classList.add("hidden");
}

export function initSettings(): void {
    document.getElementById("settings-close")?.addEventListener("click", closeSettingsDialog);
    document.getElementById("settings-btn")?.addEventListener("click", openSettingsDialog);
}
