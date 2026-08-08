/*
 * Web Worker that hosts openscad-wasm. Runs off the main thread so:
 *   1. The render-progress ticker in main.ts actually keeps updating.
 *   2. The form stays interactive while a big render is crunching.
 *
 * Protocol (main <-> worker):
 *   in : { id, type: 'render', scad, params }
 *   out: { id, ok: true, bytes } | { id, ok: false, error }
 */

const SCAD_SOURCES = [
    "circular_adapter.scad",
    "rectangular_adapter.scad",
    "strip.scad",
    "trapezoidal_roof.scad",
    "trapezoidal_roof_preview.scad",
] as const;

let openScadFactoryPromise: Promise<any> | null = null;
let scadSourceCache: Map<string, string> | null = null;

const base = import.meta.env.BASE_URL;

async function loadOpenScad(): Promise<any> {
    if (!openScadFactoryPromise) {
        const url = new URL(`${base}openscad/openscad.js`, self.location.href).href;
        openScadFactoryPromise = import(/* @vite-ignore */ url).then((mod) => mod.default);
    }
    return openScadFactoryPromise;
}

async function loadScadSources(): Promise<Map<string, string>> {
    if (scadSourceCache) return scadSourceCache;
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

async function runScadInWorker(
    scadFile: string,
    params: Record<string, string | number>,
): Promise<Uint8Array> {
    const [OpenSCAD, sources] = await Promise.all([loadOpenScad(), loadScadSources()]);
    // Fresh instance every render; reusing corrupts Emscripten runtime state
    // (see notes in previous non-worker implementation).
    const instance = await OpenSCAD({ noInitialRun: true });
    for (const [name, text] of sources) {
        instance.FS.writeFile(`/${name}`, text);
    }

    const args: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        args.push("-D", `${key}=${value}`);
    }
    args.push("-o", "/out.stl", `/${scadFile}`);

    try {
        instance.callMain(args);
    } catch (err) {
        throw new Error(
            typeof err === "number" ? `openscad aborted (exception #${err})` : String(err),
        );
    }

    return instance.FS.readFile("/out.stl") as Uint8Array;
}

self.addEventListener("message", async (ev: MessageEvent) => {
    const { id, type, scad, params } = ev.data as {
        id: number;
        type: string;
        scad: string;
        params: Record<string, string | number>;
    };
    if (type !== "render") return;
    try {
        const bytes = await runScadInWorker(scad, params);
        (self as unknown as Worker).postMessage({ id, ok: true, bytes });
    } catch (err) {
        (self as unknown as Worker).postMessage({
            id,
            ok: false,
            error: (err as Error).message,
        });
    }
});
