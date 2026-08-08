# Roof Flange Forge

Parametric flange-adapter generator for ribbed sheet-metal roofs — van roofs,
shed roofs, RV panels, corrugated agricultural buildings. Point it at your
roof's rib profile and it produces a printable STL that bridges the ribs and
gives a fan, vent, skylight, or duct a flat, sealable base.

Runs entirely client-side via `openscad-wasm` (Manifold engine, no server), or
as a native desktop app via Electron.

![Roof Flange Forge web app](docs/screenshot.png)

## Get it

- **Web**: <https://acestronautical.github.io/RoofFlangeForge/>
- **Desktop**: [latest release](https://github.com/acestronautical/RoofFlangeForge/releases/latest)
  ships .dmg (macOS x64 + arm64), .exe (Windows x64), and .AppImage (Linux x64)
- **CLI**: `cli/build_stls.sh` if you have OpenSCAD installed locally

## What it makes

- **Circular flange** — round mounting ring for round-flange fittings (Maxxair
  Dome, 6"–7" vents, roof jacks, small skylights)
- **Rectangular flange** — framed opening for fans in a rectangular cutout
  (defaults suit MaxxFan-family 14×14" fans)
- **Strip** — a mounting bar with no cutout, for roof-rack rails, panel mounts,
  cable tie-downs
- **Roof preview** — cross-section visualization of the profile

For every shape:

- **Roof profile**: trapezoidal ribs (stamped body panel) or corrugated
  (sinusoidal, e.g. barn tin)
- **Placement**: rib- vs. indent-centered, and topside / underside / both
  (renders both mating parts spread apart in one STL, ready to print together)
- **Optional bolt holes**: auto-centered on the ring material with a signed
  offset. Circular gets N bolts on the bolt circle; rectangular gets N per
  side (corners always in); strip drops bolts on ribs, indents, or every other
- **Inches or millimeters** — the model is unit-aware; the URL is
  bookmarkable/shareable and reproduces the exact STL on load

## Directory layout

```
cli/scad/                  Parametric SCAD sources (single source of truth)
cli/build_stls.sh          Batch-render every variant
cli/tests/                 Reproducibility test (see .github/workflows/test.yml)
web/                       Vite + TypeScript + three.js web app
web/electron/main.cjs      Electron main process (npm run electron:dist)
web/public/openscad/       Vendored openscad-wasm (Manifold, ~11 MB)
web/public/scad -> ../../cli/scad     symlink; single source of truth
.github/workflows/
  pages.yml                Push to main → deploy web app to GitHub Pages
  test.yml                 Push/PR → reproducibility test against nightly OpenSCAD
  release.yml              Tag push (v*) → build .dmg/.exe/.AppImage on the matrix
  build-openscad-wasm.yml  Manual dispatch → rebuild openscad-wasm, open PR
```

## CLI

Install OpenSCAD (`brew install openscad`), then render a one-off:

```bash
openscad \
    -D 'ID=6.375' \
    -D 'OD=10.5' \
    -D 'side="top"' \
    -D 'bolt_holes=true' \
    -o adapter.stl \
    cli/scad/circular_adapter.scad
```

Every top-level variable in the SCAD is overridable. `cli/build_stls.sh`
batch-renders the standard variants into `generated_stl/`.

## Cutting a release

```bash
git tag v0.2.0
git push --tags
```

The **Release desktop builds** workflow packages the Electron app on macOS,
Windows, and Linux runners in parallel and attaches the installers to the
GitHub Release for that tag.

## Upgrading openscad-wasm

Actions tab → **Build openscad-wasm from main** → *Run workflow*. That runs
the Docker build on Ubuntu, copies fresh artifacts into
`web/public/openscad/` (skipping the 8 MB fonts blob and MCAD library we
don't use), and opens a PR to review.

## Design notes

- The roof profile is periodic: trapezoidal is defined by `rib_width`,
  `indent_top_w`, `indent_bot_w`, `indent_depth`, `corner_r`; corrugated by
  `corr_pitch` and `corr_depth`. Chamfered rib bends are baked into the
  surface polygon (no offset/minkowski shenanigans), so the geometry stays
  manifold at any `corner_r`.
- The adapter is `blank − roof_cutter − bolt_pattern` (bolts opt-in).
  Topside and underside are the two halves of one prism split along the
  roof surface, with a `sheet_thickness` gap between them for the physical
  panel. Their union fills a constant-thickness volume.
- `roof_cutter()` dispatches on `roof_profile` at render time, so switching
  between trapezoidal and corrugated is one variable, not a different file.

## Credits

Design lineage: inspired by [a prior project](https://example.invalid/)'s CNC-machined
expanded-PVC Maxxfan Dome adapter. Roof geometry was reverse-engineered from
photo measurements of a example ribbed sheet-metal; the file is general enough
to model any ribbed sheet-metal profile in that family.
