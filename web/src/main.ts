import { runScad } from "./openscad-runner";
import { StlViewer } from "./viewer";

const MM_PER_IN = 25.4;

// All numeric inputs are treated as canonical inches internally; the units
// select just controls how those values are displayed and typed by the user.
type Unit = "in" | "mm";

const form = document.getElementById("params") as HTMLFormElement;
const unitsSelect = form.elements.namedItem("units") as HTMLInputElement;
const shapeSelect = form.elements.namedItem("shape") as HTMLSelectElement;
const roofProfileSelect = form.elements.namedItem("roof_profile") as HTMLSelectElement;
const renderBtn = document.getElementById("render") as HTMLButtonElement;
const downloadBtn = document.getElementById("download") as HTMLButtonElement;
const shareBtn = document.getElementById("share") as HTMLButtonElement;
const helpBtn = document.getElementById("help") as HTMLButtonElement;
const themeBtn = document.getElementById("theme") as HTMLButtonElement;
const helpDialog = document.getElementById("help-dialog") as HTMLDialogElement;
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
// The hidden `units` input is the source of truth; the header segmented
// control just flips its value and fires `change` so the rest of the app
// (unit conversion, step swap) reacts normally.
for (const btn of document.querySelectorAll<HTMLButtonElement>(".unit-toggle button")) {
    btn.addEventListener("click", () => {
        const next = btn.dataset.unit as Unit;
        if (unitsSelect.value === next) return;
        unitsSelect.value = next;
        unitsSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
}
function syncUnitToggle(unit: Unit): void {
    document.querySelectorAll<HTMLButtonElement>(".unit-toggle button").forEach((btn) => {
        btn.setAttribute("aria-checked", btn.dataset.unit === unit ? "true" : "false");
    });
}
syncUnitToggle(currentUnit);
// Per-field spinner increments in inches. Missing entries fall back to 0.1
// in / 1 mm. Note: `step` only controls the up/down arrows and validity --
// users can always type any value; the form uses `novalidate` so step-off
// values submit fine.
const STEP_IN: Record<string, number> = {
    ID: 0.25, OD: 0.25,
    inner_x: 0.25, inner_y: 0.25, outer_x: 0.25, outer_y: 0.25,
    strip_x: 0.25, strip_y: 0.25,
    main_thick: 0.0625,
    preview_xy: 1, preview_thickness: 0.01,
    rib_width: 0.125, indent_top_w: 0.125, indent_bot_w: 0.125,
    indent_depth: 0.0625, corner_r: 0.0625,
    corr_pitch: 0.125, corr_depth: 0.0625,
    tolerance: 0.005,
    bolt_pcd: 0.25, bolt_inner_distance: 0.0625, bolt_hole_d: 0.03125,
};
const STEP_MM: Record<string, number> = {
    ID: 5, OD: 5,
    inner_x: 5, inner_y: 5, outer_x: 5, outer_y: 5,
    strip_x: 5, strip_y: 5,
    main_thick: 1,
    preview_xy: 10, preview_thickness: 0.25,
    rib_width: 2, indent_top_w: 2, indent_bot_w: 2,
    indent_depth: 1, corner_r: 1,
    corr_pitch: 2, corr_depth: 1,
    tolerance: 0.1,
    bolt_pcd: 5, bolt_inner_distance: 1, bolt_hole_d: 0.5,
};
function applyStepsForUnit(unit: Unit): void {
    // HTML step validation flags any typed value that isn't an exact
    // multiple of `step` as :invalid -- painful for typed measurements
    // like 3.425 with step 0.125. Force step="any" for validation and
    // handle Arrow-key stepping manually below with per-field increments.
    void unit;
    form.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach((input) => {
        // Integer counters keep their HTML-provided step (e.g. step="1").
        if (input.name === "bolt_n_circ" || input.name === "bolt_per_side") return;
        input.step = "any";
    });
}
applyStepsForUnit(currentUnit);

// Arrow-key stepping with per-field increments (STEP_IN / STEP_MM).
form.addEventListener("keydown", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLInputElement) || t.type !== "number") return;
    if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
    if (t.name === "bolt_n_circ" || t.name === "bolt_per_side") return;
    const table = currentUnit === "mm" ? STEP_MM : STEP_IN;
    const step = table[t.name];
    if (step === undefined) return;
    ev.preventDefault();
    const current = Number(t.value);
    const base = Number.isNaN(current) ? 0 : current;
    const direction = ev.key === "ArrowUp" ? 1 : -1;
    t.value = String(round(base + direction * step, 6));
    t.dispatchEvent(new Event("input", { bubbles: true }));
});

unitsSelect.addEventListener("change", () => {
    const next = unitsSelect.value as Unit;
    if (next === currentUnit) return;
    const ratio = next === "mm" ? MM_PER_IN : 1 / MM_PER_IN;
    form.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach((input) => {
        // data-unitless inputs (e.g. angles in degrees) shouldn't scale.
        if (input.dataset.unitless !== undefined) return;
        const val = Number(input.value);
        if (!Number.isNaN(val)) input.value = String(round(val * ratio, 4));
    });
    const label = next === "mm" ? "millimeters" : "inches";
    form.querySelectorAll<HTMLSpanElement>(".unit-suffix").forEach((el) => {
        el.textContent = label;
    });
    currentUnit = next;
    applyStepsForUnit(currentUnit);
    syncUnitToggle(currentUnit);
});

// Bolt-holes checkbox controls visibility of its sub-fields.
const boltHolesInput = form.elements.namedItem("bolt_holes") as HTMLInputElement;
function syncBoltHolesVisibility(): void {
    const shown = boltHolesInput.checked;
    form.querySelectorAll<HTMLElement>("[data-bolts-only]").forEach((el) => {
        el.hidden = !shown;
        el.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
            input.disabled = !shown;
        });
    });
}
boltHolesInput.addEventListener("change", syncBoltHolesVisibility);
syncBoltHolesVisibility();

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

// Keep the bolt-position inputs' `min`/`max` in sync with the current shape
// dimensions so :invalid styling flags out-of-range values before submit.
// Circular uses PCD directly, so its bounds are [ID, OD]. Rectangular uses
// distance-from-inner, bounded above by the narrowest ring width.
const boltPcdInput = form.elements.namedItem("bolt_pcd") as HTMLInputElement | null;
const boltInnerDistInput =
    form.elements.namedItem("bolt_inner_distance") as HTMLInputElement | null;

function syncBoltBounds(): void {
    const shape = shapeSelect.value;
    const data = new FormData(form);
    const displayFactor = currentUnit === "mm" ? MM_PER_IN : 1;
    if (shape === "circular" && boltPcdInput) {
        const idIn = inches(data, "ID");
        const odIn = inches(data, "OD");
        if (idIn > 0 && odIn > idIn) {
            boltPcdInput.min = String(round(idIn * displayFactor, 4));
            boltPcdInput.max = String(round(odIn * displayFactor, 4));
        } else {
            boltPcdInput.removeAttribute("min");
            boltPcdInput.removeAttribute("max");
        }
    }
    if (shape === "rectangular" && boltInnerDistInput) {
        const rx = (inches(data, "outer_x") - inches(data, "inner_x")) / 2;
        const ry = (inches(data, "outer_y") - inches(data, "inner_y")) / 2;
        const ring = Math.min(rx, ry);
        if (Number.isFinite(ring) && ring > 0) {
            boltInnerDistInput.max = String(round(ring * displayFactor, 4));
        } else {
            boltInnerDistInput.removeAttribute("max");
        }
    }
    syncFieldErrors();
}

// Inline error message under each validated numeric input. Kept in the same
// <label> so it can be hidden/disabled alongside the field when the shape
// switches.
function ensureFieldError(input: HTMLInputElement): HTMLSpanElement {
    let err = input.parentElement?.querySelector<HTMLSpanElement>(":scope > .field-error");
    if (!err && input.parentElement) {
        err = document.createElement("span");
        err.className = "field-error";
        input.parentElement.appendChild(err);
    }
    return err as HTMLSpanElement;
}
function fieldErrorText(input: HTMLInputElement): string {
    if (input.disabled || input.hidden) return "";
    if (!input.value) return "";
    const val = Number(input.value);
    if (Number.isNaN(val)) return "";
    const unitLabel = currentUnit === "mm" ? "mm" : "in";
    if (input.max !== "" && val > Number(input.max)) {
        return `Must be \u2264 ${input.max} ${unitLabel}`;
    }
    if (input.min !== "" && val < Number(input.min)) {
        return `Must be \u2265 ${input.min} ${unitLabel}`;
    }
    return "";
}
function syncFieldErrors(): void {
    for (const input of [boltPcdInput, boltInnerDistInput]) {
        if (!input) continue;
        const err = ensureFieldError(input);
        err.textContent = fieldErrorText(input);
    }
}

form.addEventListener("input", (ev) => {
    const t = ev.target as HTMLElement;
    if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement) {
        syncBoltBounds();
    }
});
shapeSelect.addEventListener("change", syncBoltBounds);
unitsSelect.addEventListener("change", syncBoltBounds);
syncBoltBounds();

// Show/hide fields that depend on the selected roof profile ------------------
function syncRoofProfileVisibility(): void {
    const profile = roofProfileSelect.value;
    form.querySelectorAll<Element>("[data-roof-profile]").forEach((el) => {
        const isThis = (el as HTMLElement).dataset.roofProfile === profile;
        // SVG elements don't reflect the `hidden` IDL property to an
        // attribute the way HTML elements do, so set the attribute directly
        // -- otherwise the [hidden] CSS selector misses.
        if (isThis) el.removeAttribute("hidden");
        else el.setAttribute("hidden", "");
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

function flangeOffsetXInches(data: FormData): number {
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
        overrides.flange_offset_x = flangeOffsetXInches(data);
        overrides.preview_xy = inches(data, "preview_xy");
        overrides.sheet_thickness = inches(data, "preview_thickness");
        const previewScad =
            profile === "corrugated"
                ? "corrugated_roof_preview.scad"
                : "trapezoidal_roof_preview.scad";
        const mountLabel = flangeOffsetXInches(data) === 0 ? "rib" : "indent";
        return {
            scad: previewScad,
            overrides,
            outName: `roof_${profile}_${mountLabel}-centered.stl`,
        };
    }

    // sheet_thickness is left at the SCAD default (0.032 in / ~0.8 mm, a
    // typical stamped body panel) so the topside/underside sandwich has
    // room for a real panel without adding another UI knob.
    overrides.main_thick = inches(data, "main_thick");
    overrides.flange_offset_x = flangeOffsetXInches(data);
    overrides.side = `"${String(data.get("side"))}"`;
    // Tolerance is applied SCAD-side via offset() on the 2D cutter profile
    // before the extrude, so the opening dimensions (ID/OD, inner/outer,
    // strip size) are never scaled -- only the roof-mating pads shrink.
    overrides.tolerance = inches(data, "tolerance");

    // Bolt-hole opt-in. Only pass shape-relevant params so we don't leak
    // circular fields into a rectangular render (or vice versa).
    const boltsOn = data.get("bolt_holes") === "on";
    if (boltsOn) {
        overrides.bolt_holes = "true";
        overrides.bolt_hole_d = inches(data, "bolt_hole_d");
    }

    const mount = flangeOffsetXInches(data) === 0 ? "rib-centered" : "indent-centered";
    const face =
        overrides.side === '"top"' ? "topside"
        : overrides.side === '"bottom"' ? "underside"
        : "both";

    if (shape === "circular") {
        overrides.ID = inches(data, "ID");
        overrides.OD = inches(data, "OD");
        if (boltsOn) {
            overrides.bolt_n = Number(data.get("bolt_n_circ"));
            // The user enters the bolt-circle diameter (PCD) directly, in
            // the same units as ID/OD -- no radial-vs-diametral math.
            overrides.bolt_pcd = inches(data, "bolt_pcd");
            const angle = Number(data.get("bolt_angle"));
            if (!Number.isNaN(angle) && angle !== 0) overrides.bolt_angle = angle;
        }
        return {
            scad: "circular_adapter.scad",
            overrides,
            outName: `circular_${mount}_${face}_ID${overrides.ID}_OD${overrides.OD}.stl`,
        };
    }
    if (shape === "strip") {
        overrides.strip_x = inches(data, "strip_x");
        overrides.strip_y = inches(data, "strip_y");
        if (boltsOn) {
            overrides.bolt_place = `"${String(data.get("bolt_place"))}"`;
        }
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
    if (boltsOn) {
        overrides.bolt_per_side = Number(data.get("bolt_per_side"));
        // SCAD's bolt_edge_inset is measured from the OUTER edge; convert
        // from the user-facing distance-from-inner-edge value.
        const ringWidth = ((overrides.outer_x as number) - (overrides.inner_x as number)) / 2;
        overrides.bolt_edge_inset = ringWidth - inches(data, "bolt_inner_distance");
    }
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

// Auto-render with debouncing ---------------------------------------------
// Any form change starts a debounce timer. When it fires, a render is
// dispatched via requestSubmit(). If a render is already running, we mark
// a re-render as pending and fire it once the current one finishes.
const AUTO_RENDER_DEBOUNCE_MS = 500;
let autoRenderTimer: number | null = null;
let isRendering = false;
let pendingRerender = false;
let autoRenderInFlight = false;

function scheduleAutoRender(): void {
    if (autoRenderTimer !== null) clearTimeout(autoRenderTimer);
    autoRenderTimer = window.setTimeout(() => {
        autoRenderTimer = null;
        if (isRendering) {
            pendingRerender = true;
            return;
        }
        autoRenderInFlight = true;
        form.requestSubmit();
    }, AUTO_RENDER_DEBOUNCE_MS);
}

form.addEventListener("input", (ev) => {
    // Skip if a field-error was just typed into (invalid field re-render
    // would just refuse). Silent skip is handled inside the submit path.
    void ev;
    scheduleAutoRender();
});
form.addEventListener("change", scheduleAutoRender);

// Submit --------------------------------------------------------------------
form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    // Distinguish manual Render click from a debounced auto-render so the
    // out-of-range toast only appears when the user explicitly asked for it.
    const isAuto = autoRenderInFlight;
    autoRenderInFlight = false;
    // Bolts opt-in; only validate the position input for the currently active
    // shape's field.
    const boltsOn = boltHolesInput.checked;
    const shape = shapeSelect.value;
    const validate: HTMLInputElement | null = !boltsOn
        ? null
        : shape === "circular" ? boltPcdInput
        : shape === "rectangular" ? boltInnerDistInput
        : null;
    if (validate && !validate.checkValidity()) {
        if (!isAuto) {
            const firstTextNode = Array.from(validate.parentElement?.childNodes ?? [])
                .find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
            const label = firstTextNode?.textContent?.trim() ?? validate.name;
            const detail = fieldErrorText(validate) || "value is out of range";
            showToast(`${label}: ${detail}`, "Fix the highlighted field and try again.", 3600, "error");
            validate.focus();
        }
        return;
    }
    isRendering = true;
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
        isRendering = false;
        // If the user tweaked something during the render, run another.
        if (pendingRerender) {
            pendingRerender = false;
            scheduleAutoRender();
        }
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
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
            if (el.checked) params.set(el.name, "1");
            continue;
        }
        params.set(el.name, el.value);
    }
    return params;
}

function writeParamsToUrl(): void {
    const params = serializeParams();
    // Include the auto-render flag so anyone opening the shared URL sees the
    // exact STL without an extra click.
    params.set("render", "1");
    const qs = params.toString();
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
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
            el.checked = value === "1" || value === "on" || value === "true";
            el.dispatchEvent(new Event("change", { bubbles: true }));
            continue;
        }
        if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
            el.value = value;
        }
    }
    currentUnit = unitsSelect.value as Unit;
}
applyParamsFromUrl();

// Collapsible fieldsets ----------------------------------------------------
// Click a fieldset's legend to collapse/expand its contents. State is
// keyed by the legend text and persisted in localStorage so the layout
// sticks across reloads.
const COLLAPSED_KEY = "collapsedFieldsets";
let collapsedFieldsets = new Set<string>();
try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (raw) collapsedFieldsets = new Set(JSON.parse(raw) as string[]);
} catch { /* ignore malformed storage */ }

function saveCollapsedFieldsets(): void {
    try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsedFieldsets]));
    } catch { /* quota / private mode - fine to skip */ }
}

form.querySelectorAll<HTMLFieldSetElement>("fieldset").forEach((fs) => {
    const legend = fs.querySelector<HTMLLegendElement>(":scope > legend");
    if (!legend) return;
    fs.classList.add("collapsible");
    const key = legend.textContent?.trim() ?? "";
    if (collapsedFieldsets.has(key)) fs.classList.add("collapsed");
    legend.setAttribute("role", "button");
    legend.setAttribute("tabindex", "0");
    legend.setAttribute("aria-expanded", fs.classList.contains("collapsed") ? "false" : "true");
    const toggle = (): void => {
        const nowCollapsed = fs.classList.toggle("collapsed");
        legend.setAttribute("aria-expanded", nowCollapsed ? "false" : "true");
        if (nowCollapsed) collapsedFieldsets.add(key);
        else collapsedFieldsets.delete(key);
        saveCollapsedFieldsets();
    };
    legend.addEventListener("click", toggle);
    legend.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            toggle();
        }
    });
});

// Hint tooltips ------------------------------------------------------------
// A single tooltip element is appended to <body> so it escapes the .controls
// pane's overflow: auto clipping. Position is recomputed on each hover and
// clamped to the viewport (flipped below the icon if it doesn't fit above).
const hintTooltip = document.createElement("div");
hintTooltip.className = "hint-tooltip";
hintTooltip.setAttribute("role", "tooltip");
document.body.appendChild(hintTooltip);

function showHint(icon: HTMLElement): void {
    const text = icon.dataset.tooltip ?? "";
    if (!text) return;
    hintTooltip.textContent = text;
    hintTooltip.classList.add("visible");
    const iconRect = icon.getBoundingClientRect();
    const tipRect = hintTooltip.getBoundingClientRect();
    const gap = 8;
    const margin = 8;
    let x = iconRect.left + iconRect.width / 2 - tipRect.width / 2;
    x = Math.max(margin, Math.min(x, window.innerWidth - tipRect.width - margin));
    let y = iconRect.top - tipRect.height - gap;
    if (y < margin) y = iconRect.bottom + gap;
    hintTooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function hideHint(): void {
    hintTooltip.classList.remove("visible");
}

document.body.addEventListener("mouseover", (ev) => {
    const icon = (ev.target as HTMLElement).closest<HTMLElement>(".hint-icon");
    if (icon) showHint(icon);
});
document.body.addEventListener("mouseout", (ev) => {
    if ((ev.target as HTMLElement).closest(".hint-icon")) hideHint();
});
document.body.addEventListener("focusin", (ev) => {
    const icon = (ev.target as HTMLElement).closest<HTMLElement>(".hint-icon");
    if (icon) showHint(icon);
});
document.body.addEventListener("focusout", hideHint);

// If the URL carries `render=1`, kick off a render automatically so a
// shared link reproduces the STL without a manual click. The submit path is
// what wires up the progress ticker and download button, so use it directly.
if (new URLSearchParams(location.search).get("render") === "1") {
    form.requestSubmit();
}

helpBtn.addEventListener("click", () => helpDialog.showModal());
helpDialog.querySelector<HTMLButtonElement>(".help-close")?.addEventListener(
    "click", () => helpDialog.close());
helpDialog.addEventListener("click", (ev) => {
    // Click on the backdrop (the dialog element itself, not children) closes.
    if (ev.target === helpDialog) helpDialog.close();
});

// Theme toggle. Persisted in localStorage; viewer background follows.
type Theme = "dark" | "light";
const THEME_BG: Record<Theme, number> = { dark: 0x1e2124, light: 0xd1d5db };
function applyTheme(t: Theme): void {
    document.documentElement.dataset.theme = t;
    viewer.setBackgroundColor(THEME_BG[t]);
}
const savedTheme = (localStorage.getItem("theme") as Theme | null) ?? "dark";
applyTheme(savedTheme);
themeBtn.addEventListener("click", () => {
    const next: Theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", next);
    applyTheme(next);
});

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
function showToast(
    title: string,
    body: string,
    durationMs = 2400,
    variant: "info" | "error" = "info",
): void {
    toast.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const code = document.createElement("code");
    code.textContent = body;
    toast.append(strong, code);
    toast.classList.toggle("error", variant === "error");
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
