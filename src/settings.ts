import { getFontsConfig } from "./resourceConfig.js";
import { applySelectedFont, getSelectedFontKey } from "./font.js";

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

function openSettingsDialog(): void {
    const dialog = document.getElementById("settings-dialog")!;
    const body = dialog.querySelector(".settings-body")!;

    // Rebuild each time to reflect current state
    body.innerHTML = "";
    buildFontSection(body as HTMLElement);

    dialog.classList.remove("hidden");
}

function closeSettingsDialog(): void {
    document.getElementById("settings-dialog")?.classList.add("hidden");
}

export function initSettings(): void {
    document.getElementById("settings-close")?.addEventListener("click", closeSettingsDialog);
    document.getElementById("settings-btn")?.addEventListener("click", openSettingsDialog);
}
