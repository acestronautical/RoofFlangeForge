/*
 * OpenSCAD-WASM runner.
 *
 * The 2022.03.20 release ships as ES modules under /openscad/. Because those
 * files internally use bare-URL `import` statements ("./openscad.wasm.js"),
 * they only resolve if the browser fetches the entry from the same absolute
 * directory -- so we load it with a raw dynamic import against a URL under
 * `import.meta.env.BASE_URL` (which is the Vite-configured base path).
 *
 * A fresh OpenSCAD instance is built per render. Reusing an instance across
 * `callMain()` calls corrupts Emscripten's runtime state (Emscripten throws
 * an exception-pointer integer on the second invocation), so we pay a small
 * ~200 ms reinstantiation cost each render instead. The .wasm binary itself
 * is browser-cached so this is cheap after the first load.
 *
 * Once instantiated, calls look like:
 *     await runScad("circular_adapter.scad", { ID: 6.375, side: '"top"' });
 * The values are passed through as OpenSCAD `-D` overrides, so quoting rules
 * for strings ("top" / "bottom") have to be honored by the caller.
 */

// The scad sources are copied into public/scad/ by the build step and fetched
// at runtime so the wasm's MEMFS can mount them.
const SCAD_SOURCES = [
    "circular_adapter.scad",
    "rectangular_adapter.scad",
    "trapezoidal_roof.scad",
    "trapezoidal_roof_preview.scad",
] as const;

// Cache: the ESM entry factory (idempotent — the browser dedupes)
// and the fetched scad-source texts (also fine to cache).
let openScadFactoryPromise: Promise<any> | null = null;
let scadSourceCache: Map<string, string> | null = null;

async function loadOpenScad(): Promise<any> {
    if (!openScadFactoryPromise) {
        const base = import.meta.env.BASE_URL;
        const url = new URL(`${base}openscad/openscad.js`, window.location.href).href;
        openScadFactoryPromise = import(/* @vite-ignore */ url).then((mod) => mod.default);
    }
    return openScadFactoryPromise;
}

async function loadScadSources(): Promise<Map<string, string>> {
    if (scadSourceCache) return scadSourceCache;
    const base = import.meta.env.BASE_URL;
    const entries = await Promise.all(
        SCAD_SOURCES.map(async (name) => {
            const res = await fetch(`${base}scad/${name}`);
            if (!res.ok) throw new Error(`fetch ${name} -> ${res.status}`);
            return [name, await res.text()] as const;
        }),
    );
    scadSourceCache = new Map(entries);
    return scadSourceCache;
}

/**
 * Render a scad source with a bag of parameter overrides. Returns the STL
 * bytes.
 */
export async function runScad(
    scadFile: string,
    params: Record<string, string | number>,
): Promise<Uint8Array> {
    const [OpenSCAD, sources] = await Promise.all([loadOpenScad(), loadScadSources()]);
    const instance = await OpenSCAD({ noInitialRun: true });
    for (const [name, text] of sources) {
        instance.FS.writeFile(`/${name}`, text);
    }

    const outputName = "/out.stl";
    const args: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        args.push("-D", `${key}=${value}`);
    }
    args.push("-o", outputName);
    args.push(`/${scadFile}`);

    try {
        instance.callMain(args);
    } catch (err) {
        // Emscripten throws a pointer integer on abort; try to salvage a
        // readable message from the wasm's stderr capture.
        throw new Error(
            typeof err === "number"
                ? `openscad aborted (exception #${err})`
                : String(err),
        );
    }

    return instance.FS.readFile(outputName) as Uint8Array;
}
