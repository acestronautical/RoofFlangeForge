# Developer notes

Public docs live in [README.md](README.md). This file is for people working
on the code.

## Layout

```
cli/scad/                  Parametric SCAD sources (single source of truth)
cli/build_stls.sh          Batch-render every variant into generated_stl/
cli/tests/reproducibility.sh   Two-render byte-diff test (7 configs)
web/                       Vite + TypeScript + three.js web app
web/electron/main.cjs      Electron main process (npm run electron:dist)
web/public/openscad/       Vendored openscad-wasm (Manifold, ~11 MB)
web/public/scad -> ../../cli/scad   symlink; single source of truth for SCAD
.github/workflows/
  pages.yml                Push to main -> deploy web app to GitHub Pages
  test.yml                 Push / PR -> reproducibility test (nightly OpenSCAD)
  release.yml              Tag push (v*) -> build .dmg/.exe/.AppImage matrix
  build-openscad-wasm.yml  Manual dispatch -> rebuild openscad-wasm, open PR
```

## Local dev

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run electron:dev   # runs Electron pointed at the Vite server
npm run electron:dist  # packages a signed installer for your host OS
```

## CLI

Install a modern OpenSCAD locally (`brew install openscad`), then one-off:

```bash
openscad \
    -D 'ID=6.375' \
    -D 'OD=10.5' \
    -D 'side="top"' \
    -D 'bolt_holes=true' \
    -o adapter.stl \
    cli/scad/circular_adapter.scad
```

Every top-level variable in the SCAD is overridable via `-D`.

`cli/build_stls.sh` batch-renders the standard variants.

## Reproducibility test

`cli/tests/reproducibility.sh` renders a 7-config matrix twice with the same
OpenSCAD binary and asserts byte-identical output. Catches accidental
non-determinism (unset variables, iteration-order sensitivity, floating-point
edge cases) that would break shareable-URL reproducibility.

Run locally: `bash cli/tests/reproducibility.sh`. On CI the workflow installs
the nightly OpenSCAD AppImage — Ubuntu's apt is too old for Manifold (which
is deterministic; CGAL isn't for our bolt-hole configs).

## Cutting a release

```bash
git tag v0.2.0
git push --tags
```

The **Release desktop builds** workflow packages the Electron app on
macos-latest / windows-latest / ubuntu-latest in parallel and attaches the
installers to the GitHub Release for that tag via `softprops/action-gh-release`.

If you need to redo a release: `git push origin :v0.2.0 && git tag -d v0.2.0 &&
git tag v0.2.0 && git push --tags` (force re-tag, retriggers the workflow).

## Upgrading openscad-wasm

Actions tab → **Build openscad-wasm from main** → *Run workflow*. Docker-builds
openscad-wasm from source, filters out the fonts+MCAD files we don't use,
copies the fresh artifacts into `web/public/openscad/`, and opens a PR to
review. Merge to ship.

If the workflow fails at "Open PR" with
*"GitHub Actions is not permitted to create or approve pull requests"*, either
open the PR manually from the pushed branch `chore/openscad-wasm-upgrade`, or
enable the setting at *Repo Settings → Actions → General → Workflow permissions*.

## Design notes

- The roof profile is periodic: **trapezoidal** is defined by `rib_width`,
  `indent_top_w`, `indent_bot_w`, `indent_depth`, `corner_r`; **corrugated**
  by `corr_pitch` and `corr_depth`.
- Chamfered rib bends are baked into the surface polygon (no offset/minkowski
  gymnastics), so the geometry stays manifold at any `corner_r`. See
  `chamfer_polyline` in `trapezoidal_roof.scad`.
- Every adapter is `blank − roof_cutter − bolt_pattern` (bolts opt-in).
  Topside and underside are the two halves of one prism split along the
  roof surface, with a `sheet_thickness` gap between them. Their union fills
  a constant-thickness volume.
- `roof_cutter()` dispatches on `roof_profile` at render time, so switching
  between trapezoidal and corrugated is one variable, not a different file.
- Top-level `render_all()` handles `side="both"` by translating a topside
  and an underside apart and rendering both — makes a print-ready STL with
  both mating parts on the bed in one job.
- `bolt_pattern.scad` is fully isolated: adapters `include` it and gate its
  effect on a `bolt_holes = false` default. Set the flag off and the STL is
  byte-identical to a build without the file.

## Deploying

The `Deploy to GitHub Pages` workflow triggers on every push to `main`. It
builds the web app with `base: "/RoofFlangeForge/"` and publishes
`web/dist/` to Pages. The Electron build uses the same source with a relative
base URL (`ELECTRON=1 vite build`).
