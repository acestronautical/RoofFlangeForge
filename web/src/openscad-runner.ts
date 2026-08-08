/*
 * Client-side wrapper around openscad.worker.ts.
 *
 * A single worker is spun up lazily and reused across renders. Each render
 * gets a unique message id so responses can be routed back to the right
 * caller. The wasm binary is loaded exactly once by the worker (it caches its
 * factory promise), so subsequent renders skip re-instantiation of the module
 * but still get a fresh runtime state per render (that's done inside the
 * worker, not here).
 */

let workerPromise: Promise<Worker> | null = null;
let msgId = 0;

function getWorker(): Promise<Worker> {
    if (!workerPromise) {
        workerPromise = Promise.resolve(
            new Worker(new URL("./openscad.worker.ts", import.meta.url), {
                type: "module",
                name: "openscad",
            }),
        );
    }
    return workerPromise;
}

export async function runScad(
    scadFile: string,
    params: Record<string, string | number>,
): Promise<Uint8Array> {
    const worker = await getWorker();
    const id = ++msgId;
    return new Promise((resolve, reject) => {
        const listener = (ev: MessageEvent) => {
            if (ev.data.id !== id) return;
            worker.removeEventListener("message", listener);
            if (ev.data.ok) resolve(ev.data.bytes as Uint8Array);
            else reject(new Error(ev.data.error));
        };
        worker.addEventListener("message", listener);
        worker.postMessage({ type: "render", id, scad: scadFile, params });
    });
}
