import { runScad } from "./openscad-runner";
import { StlViewer } from "./viewer";

const MM_PER_IN = 25.4;

// All numeric inputs are treated as canonical inches internally; the units
// select just controls how those values are displayed and typed by the user.
type Unit = "in" | "mm";

const form = document.getElementById("params") as HTMLFormElement;
const unitsSelect = form.elements.namedItem("units") as HTMLSelectElement;
const shapeSelect = form.elements.namedItem("shape") as HTMLSelectElement;
const roofProfileSelect = form.elements.namedItem("roof_profile") as HTMLSelectElement;
const renderBtn = document.getElementById("render") as HTMLButtonElement;
const downloadBtn = document.getElementById("download") as HTMLButtonElement;
const shareBtn = document.getElementById("share") as HTMLButtonElement;
const toast = document.getElementById("toast") as HTMLDivElement;
const status = document.getElementById("status") as HTMLParagraphElement;
const dimsLine = document.getElementById("dims") as HTMLDivElement;
const canvas = document.getElementById("preview") as HTMLCanvasElement;

const viewer = new StlViewer(canvas);
window.addEventListener("resize", () => viewer.resize());

let lastBytes: Uint8Array | null = null;
let lastName = "";
let currentUnit: Unit = unitsSelect.value as Unit;
let renderTicker: number | null = null;

function startRenderProgress(): number {
    const t0 = performance.now();
    const spinnerFrames = ["\u2807", "\u2811", "\u2819", "\u2838", "\u28b0", "\u28a0", "\u2844", "\u2846"];
    let frame = 0;
    const tick = (): void => {
        const elapsed = (performance.now() - t0) / 1000;
        status.textContent = `${spinnerFrames[frame]} Rendering\u2026 ${elapsed.toFixed(1)}s`;
        frame = (frame + 1) % spinnerFrames.length;
    };
    tick();
    renderTicker = window.setInterval(tick, 120);
    return t0;
}

function stopRenderProgress(): void {
    if (renderTicker !== null) {
        clearInterval(renderTicker);
        renderTicker = null;
    }
}

// Units toggle --------------------------------------------------------------
unitsSelect.addEventListener("change", () => {
    const next = unitsSelect.value as Unit;
    if (next === currentUnit) return;
    const ratio = next === "mm" ? MM_PER_IN : 1 / MM_PER_IN;
    form.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach((input) => {
        const val = Number(input.value);
        if (!Number.isNaN(val)) input.value = String(round(val * ratio, 4));
    });
    const label = next === "mm" ? "(mm)" : "(in)";
    form.querySelectorAll<HTMLSpanElement>(".unit-suffix").forEach((el) => {
        el.textContent = label;
    });
    currentUnit = next;
});

function round(value: number, places: number): number {
    const p = 10 ** places;
    return Math.round(value * p) / p;
}

// Show/hide fields that depend on the selected shape ------------------------
function syncShapeVisibility(): void {
    const shape = shapeSelect.value;
    form.querySelectorAll<HTMLElement>("[data-shape]").forEach((el) => {
        const isThis = el.dataset.shape === shape;
        el.hidden = !isThis;
        el.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
            input.disabled = !isThis;
        });
    });
    form.querySelectorAll<HTMLElement>("[data-shape-only]").forEach((el) => {
        const allowed = (el.dataset.shapeOnly ?? "").split(/\s+/);
        const visible = allowed.includes(shape);
        el.hidden = !visible;
        el.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach(
            (input) => {
                input.disabled = !visible;
            },
        );
    });
}
shapeSelect.addEventListener("change", syncShapeVisibility);
syncShapeVisibility();

// Show/hide fields that depend on the selected roof profile ------------------
function syncRoofProfileVisibility(): void {
    const profile = roofProfileSelect.value;
    form.querySelectorAll<HTMLElement>("[data-roof-profile]").forEach((el) => {
        const isThis = el.dataset.roofProfile === profile;
        el.hidden = !isThis;
        el.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
            input.disabled = !isThis;
        });
    });
}
roofProfileSelect.addEventListener("change", syncRoofProfileVisibility);
syncRoofProfileVisibility();

// Collect params ------------------------------------------------------------
type RenderJob = {
    scad: string;
    overrides: Record<string, string | number>;
    outName: string;
};

// Read a form value as inches regardless of the current display unit.
function inches(data: FormData, name: string): number {
    const raw = Number(data.get(name));
    if (Number.isNaN(raw)) return 0;
    return currentUnit === "mm" ? raw / MM_PER_IN : raw;
}

function fanOffsetXInches(data: FormData): number {
    const mount = String(data.get("mount"));
    if (mount !== "indent") return 0;
    if (String(data.get("roof_profile")) === "corrugated") {
        return inches(data, "corr_pitch") / 2;
    }
    const ribW = inches(data, "rib_width");
    const indentW = inches(data, "indent_top_w");
    return ribW / 2 + indentW / 2;
}

function roofOverrides(data: FormData): Record<string, string | number> {
    const profile = String(data.get("roof_profile"));
    if (profile === "corrugated") {
        return {
            roof_profile: '"corrugated"',
            corr_pitch: inches(data, "corr_pitch"),
            corr_depth: inches(data, "corr_depth"),
        };
    }
    return {
        roof_profile: '"trapezoidal"',
        rib_width: inches(data, "rib_width"),
        indent_top_w: inches(data, "indent_top_w"),
        indent_bot_w: inches(data, "indent_bot_w"),
        indent_depth: inches(data, "indent_depth"),
        corner_r: inches(data, "corner_r"),
    };
}

function buildJob(): RenderJob {
    const data = new FormData(form);
    const shape = String(data.get("shape"));
    const profile = String(data.get("roof_profile"));

    const overrides: Record<string, string | number> = roofOverrides(data);

    if (shape === "roof") {
        overrides.fan_offset_x = fanOffsetXInches(data);
        overrides.preview_xy = inches(data, "preview_xy");
        overrides.sheet_thickness = inches(data, "preview_thickness");
        const previewScad =
            profile === "corrugated"
                ? "corrugated_roof_preview.scad"
                : "trapezoidal_roof_preview.scad";
        const mountLabel = fanOffsetXInches(data) === 0 ? "rib" : "indent";
        return {
            scad: previewScad,
            overrides,
            outName: `roof_${profile}_${mountLabel}-centered.stl`,
        };
    }

    overrides.sheet_thickness = inches(data, "sheet_thickness");
    overrides.main_thick = inches(data, "main_thick");
    overrides.fan_offset_x = fanOffsetXInches(data);
    overrides.side = `"${String(data.get("side"))}"`;

    const mount = fanOffsetXInches(data) === 0 ? "rib-centered" : "indent-centered";
    const face = overrides.side === '"top"' ? "topside" : "underside";

    if (shape === "circular") {
        overrides.ID = inches(data, "ID");
        overrides.OD = inches(data, "OD");
        return {
            scad: "circular_adapter.scad",
            overrides,
            outName: `circular_${mount}_${face}_ID${overrides.ID}_OD${overrides.OD}.stl`,
        };
    }
    if (shape === "strip") {
        overrides.strip_x = inches(data, "strip_x");
        overrides.strip_y = inches(data, "strip_y");
        return {
            scad: "strip.scad",
            overrides,
            outName: `strip_${mount}_${face}_${overrides.strip_x}x${overrides.strip_y}.stl`,
        };
    }
    overrides.inner_x = inches(data, "inner_x");
    overrides.inner_y = inches(data, "inner_y");
    overrides.outer_x = inches(data, "outer_x");
    overrides.outer_y = inches(data, "outer_y");
    return {
        scad: "rectangular_adapter.scad",
        overrides,
        outName: `rectangular_${mount}_${face}_${overrides.inner_x}x${overrides.inner_y}.stl`,
    };
}

function formatDims(xMm: number, yMm: number, zMm: number): string {
    const f = (mm: number) => `${(mm / MM_PER_IN).toFixed(3)}"`;
    return `Model: ${f(xMm)} \u00d7 ${f(yMm)} \u00d7 ${f(zMm)}  (${xMm.toFixed(1)} \u00d7 ${yMm.toFixed(1)} \u00d7 ${zMm.toFixed(1)} mm)`;
}

// Submit --------------------------------------------------------------------
form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    renderBtn.disabled = true;
    downloadBtn.disabled = true;
    const t0 = startRenderProgress();
    try {
        const { scad, overrides, outName } = buildJob();
        const bytes = await runScad(scad, overrides);
        stopRenderProgress();
        const ms = Math.round(performance.now() - t0);
        lastBytes = bytes;
        lastName = outName;
        const dims = viewer.load(bytes);
        dimsLine.textContent = formatDims(dims.xMm, dims.yMm, dims.zMm);
        status.textContent = `Rendered ${bytes.length.toLocaleString()} bytes in ${ms} ms`;
        downloadBtn.disabled = false;
        writeParamsToUrl();
    } catch (err) {
        stopRenderProgress();
        status.textContent = `Error: ${(err as Error).message}`;
    } finally {
        renderBtn.disabled = false;
    }
});

// Download ------------------------------------------------------------------
downloadBtn.addEventListener("click", () => {
    if (!lastBytes) return;
    const arrayBuffer = lastBytes.buffer.slice(
        lastBytes.byteOffset,
        lastBytes.byteOffset + lastBytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "model/stl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = lastName;
    a.click();
    URL.revokeObjectURL(url);
});

// Share --------------------------------------------------------------------
// Serialize the currently-enabled form controls into a URL query string.
// Disabled controls (shape-mode or roof-profile toggles hide them) are
// skipped so the URL only carries the fields that actually apply.
function serializeParams(): URLSearchParams {
    const params = new URLSearchParams();
    for (const el of form.elements as unknown as Iterable<HTMLElement>) {
        if (
            !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)
            || !el.name
            || el.disabled
        ) continue;
        params.set(el.name, el.value);
    }
    return params;
}

function writeParamsToUrl(): void {
    const qs = serializeParams().toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

// Apply ?key=value pairs to the form. Units are applied first so subsequent
// numeric fields land in the right display unit; then shape/roof-profile so
// visibility settles before per-mode fields are populated.
function applyParamsFromUrl(): void {
    const params = new URLSearchParams(location.search);
    if (params.size === 0) return;
    const priority = ["units", "shape", "roof_profile"];
    for (const name of priority) {
        const v = params.get(name);
        if (v == null) continue;
        const el = form.elements.namedItem(name);
        if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
            el.value = v;
            el.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }
    for (const [name, value] of params) {
        if (priority.includes(name)) continue;
        const el = form.elements.namedItem(name);
        if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
            el.value = value;
        }
    }
    currentUnit = unitsSelect.value as Unit;
}
applyParamsFromUrl();

shareBtn.addEventListener("click", async () => {
    writeParamsToUrl();
    const url = location.href;
    try {
        await navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard", url);
        shareBtn.classList.add("copied");
        setTimeout(() => shareBtn.classList.remove("copied"), 1500);
    } catch {
        showToast("Couldn\u2019t copy \u2014 select and copy manually:", url, 6000);
        window.prompt("Copy this link:", url);
    }
});

let toastTimer: number | null = null;
function showToast(title: string, body: string, durationMs = 2400): void {
    toast.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const code = document.createElement("code");
    code.textContent = body;
    toast.append(strong, code);
    toast.hidden = false;
    // Force a reflow so the transition kicks in.
    void toast.offsetWidth;
    toast.classList.add("show");
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
        window.setTimeout(() => { toast.hidden = true; }, 200);
    }, durationMs);
}
