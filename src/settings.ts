import { getFontsConfig } from "./resourceConfig.js";
import { applySelectedFont, getSelectedFontKey } from "./font.js";
import { pickAndStoreFile, clearLocalFile, hasLocalFile, type LocalFileKey } from "./localData.js";
import { Repository } from "./repository.js";

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

    const hint = document.createElement("p");
    hint.className = "settings-file-hint";
    hint.textContent = 'data.bin 与 atlas.webp 必须同时来自同一版本，否则图标会错位。选择文件后点击"重新加载"生效。';
    section.appendChild(hint);

    const localeRow = document.createElement("div");
    localeRow.className = "settings-row";
    const localeLabel = document.createElement("span");
    localeLabel.className = "settings-file-hint";
    localeLabel.textContent = `当前数据库语言：${Repository.current?.locale ?? "未加载"}`;
    localeRow.appendChild(localeLabel);
    section.appendChild(localeRow);

    let dirty = false;
    const reloadBtn = document.createElement("button");
    reloadBtn.textContent = "重新加载";
    reloadBtn.className = "settings-file-btn";
    reloadBtn.disabled = true;
    reloadBtn.addEventListener("click", () => location.reload());

    for (const key of ["data.bin", "atlas.webp"] as LocalFileKey[]) {
        const row = document.createElement("div");
        row.className = "settings-row";

        const label = document.createElement("label");
        label.textContent = key;
        row.appendChild(label);

        let has = await hasLocalFile(key);

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
                    has = false;
                    btn.textContent = "选择文件…";
                    status.textContent = "已清除";
                } else {
                    await pickAndStoreFile(key);
                    has = true;
                    btn.textContent = "清除";
                    status.textContent = "已加载本地文件";
                }
                dirty = true;
                reloadBtn.disabled = false;
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

    const reloadRow = document.createElement("div");
    reloadRow.className = "settings-row";
    reloadRow.appendChild(reloadBtn);
    section.appendChild(reloadRow);

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
