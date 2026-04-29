import { applyDatabaseLocaleFont, applyInitialFontPreference } from "./font.js";
import { applyResourceCssVariables, getAtlasUrl, getRepositoryDataUrl } from "./resourceConfig.js";
import { getLocalFile } from "./localData.js";

const loading = document.getElementById("loading")!;
try {
    // Load the atlas image
    const localAtlas = await getLocalFile("atlas.webp");
    const atlas = new Image();
    if (localAtlas) {
        const blobUrl = URL.createObjectURL(new Blob([localAtlas], { type: "image/webp" }));
        atlas.src = blobUrl;
        document.documentElement.style.setProperty("--resource-atlas-url", `url("${blobUrl}")`);
    } else {
        atlas.src = getAtlasUrl();
        applyResourceCssVariables();
    }

    applyDatabaseLocaleFont("zh-CN");
    applyInitialFontPreference();

    // Load repository and data in parallel
    const localData = await getLocalFile("data.bin");
    const [repositoryModule, buffer] = await Promise.all([
        import("./repository.js"),
        localData
            ? new Response(new Blob([localData]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
            : fetch(getRepositoryDataUrl()).then(r => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer())
    ]);
    repositoryModule.Repository.load(buffer);
    applyDatabaseLocaleFont(repositoryModule.Repository.current.locale);
    console.log("Repository loaded", repositoryModule.Repository.current);

    // Then load other modules
    await Promise.all([
        import("./itemIcon.js"),
        import("./tooltip.js"),
        import("./nei.js"),
        import("./menu.js"),
        import("./recipeList.js"),
        import("./settings.js").then(m => m.initSettings()),
    ]);
    let page = await import("./page.js");
    page.UpdateProject();
    loading.remove();
} catch (error:any) {
    loading.innerHTML = "An error occurred on loading:<br>" + error.message;
    console.error(error);
}

export {};