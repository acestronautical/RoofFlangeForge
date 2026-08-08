#!/usr/bin/env bash
# =============================================================================
# reproducibility.sh
#
# Renders a fixed matrix of SCAD configurations twice with the same OpenSCAD
# binary and asserts the two STLs are byte-identical. Any drift means a
# non-deterministic SCAD path (undefined variable, iteration order, etc.),
# which would break shareable URL reproducibility.
#
# Uses whatever `openscad` binary is on PATH (override with OPENSCAD=...).
# On CI, install the same way the workflow does. Locally, this is just what
# `brew install openscad` gives you.
# =============================================================================
set -euo pipefail

OSC="${OPENSCAD:-openscad}"
if ! command -v "$OSC" >/dev/null 2>&1; then
    echo "openscad not found on PATH (or set OPENSCAD=/path/to/openscad)" >&2
    exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCAD_DIR="$REPO_ROOT/cli/scad"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Each row is `label:scad:D1|D2|D3|...` where each D is one -D arg passed
# verbatim to OpenSCAD, so SCAD strings need to be quoted in-line (e.g.
# `side="top"`). Splitting on `|` avoids the shell-quoting headaches you get
# with `eval`.
configs=(
    'circular_rib_top      :circular_adapter.scad         :flange_offset_x=0|side="top"'
    'circular_indent_bot   :circular_adapter.scad         :flange_offset_x=2.75|side="bottom"'
    'circular_with_bolts   :circular_adapter.scad         :flange_offset_x=0|side="top"|bolt_holes=true'
    'rectangular_rib_top   :rectangular_adapter.scad      :flange_offset_x=0|side="top"'
    'rectangular_with_bolts:rectangular_adapter.scad      :flange_offset_x=0|side="top"|bolt_holes=true'
    'strip_rib_top         :strip.scad                    :flange_offset_x=0|side="top"'
    'strip_with_bolts      :strip.scad                    :flange_offset_x=0|side="top"|bolt_holes=true'
    'strip_corrugated      :strip.scad                    :roof_profile="corrugated"|flange_offset_x=0|side="top"'
    'trap_roof_preview     :trapezoidal_roof_preview.scad :flange_offset_x=0'
    'corr_roof_preview     :corrugated_roof_preview.scad  :flange_offset_x=0'
)

failed=0
for row in "${configs[@]}"; do
    IFS=':' read -r label scad dstr <<< "$row"
    label="$(echo "$label" | awk '{$1=$1};1')"
    scad="$(echo "$scad" | awk '{$1=$1};1')"
    dstr="$(echo "$dstr" | awk '{$1=$1};1')"

    args=()
    IFS='|' read -ra ds <<< "$dstr"
    for d in "${ds[@]}"; do args+=(-D "$d"); done

    out1="$TMP/${label}-1.stl"
    out2="$TMP/${label}-2.stl"
    "$OSC" "${args[@]}" -o "$out1" "$SCAD_DIR/$scad" 2>"$TMP/${label}.log"
    "$OSC" "${args[@]}" -o "$out2" "$SCAD_DIR/$scad" 2>>"$TMP/${label}.log"

    size1=$(stat -f%z "$out1" 2>/dev/null || stat -c%s "$out1")
    if [ "$size1" -lt 500 ]; then
        echo "FAIL $label: output too small ($size1 bytes) -- check openscad log:"
        cat "$TMP/${label}.log"
        failed=1
        continue
    fi

    h1=$(shasum -a 256 "$out1" | awk '{print $1}')
    h2=$(shasum -a 256 "$out2" | awk '{print $1}')
    if [ "$h1" != "$h2" ]; then
        echo "FAIL $label: not reproducible ($h1 vs $h2)"
        failed=1
    else
        printf "PASS %-25s %s (%d bytes)\n" "$label" "$h1" "$size1"
    fi
done

if [ "$failed" -ne 0 ]; then
    echo
    echo "One or more configs are not reproducible or produced empty output." >&2
    exit 1
fi
echo
echo "All configs render deterministically."
