#!/usr/bin/env bash
# =============================================================================
# Regenerate every adapter STL variant from the .scad sources under ../scad/.
#
# Every design variable in these files is a top-level assignment and can be
# overridden with OpenSCAD's -D flag, so all variants come from one source
# per shape without editing the SCAD files.
#
# Usage (from anywhere):
#     cli/build_stls.sh          # rebuild everything into generated_stl/
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
CODE_DIR="$SCRIPT_DIR/scad"
OUT_DIR="$REPO_ROOT/generated_stl"
OSC="/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD"

if [[ ! -x "$OSC" ]]; then
    echo "OpenSCAD not found at $OSC" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"

# indent_center_x = rib_width/2 + indent_top_w/2 = 3.500/2 + 2.000/2 = 2.750"
# Kept in sync with trapezoidal_roof.scad; update if those defaults change.
INDENT_OFFSET="2.750"

# ID list for circular variants (fan cutout is 6.25", give a few overhang options)
CIRCULAR_IDS=(6.25 6.50 6.75)

face_to_side() {
    case "$1" in
        topside)   echo "top" ;;
        underside) echo "bottom" ;;
        *) echo "Unknown face: $1" >&2; return 1 ;;
    esac
}

mount_to_offset() {
    case "$1" in
        rib)    echo "0.0" ;;
        indent) echo "$INDENT_OFFSET" ;;
        *) echo "Unknown mount: $1" >&2; return 1 ;;
    esac
}

build_circular() {
    local mount="$1" face="$2" id="$3"
    local offset side out
    offset="$(mount_to_offset "$mount")"
    side="$(face_to_side "$face")"
    out="$OUT_DIR/circular_${mount}-centered_${face}_ID${id}_OD10.stl"
    echo "==> circular ${mount}-centered ${face} ID=${id}  ->  $(basename "$out")"
    "$OSC" \
        -D "ID=${id}" \
        -D "fan_offset_x=${offset}" \
        -D "side=\"${side}\"" \
        -o "$out" "$CODE_DIR/circular_adapter.scad" 2>&1 | tail -6
}

build_rectangular() {
    local mount="$1" face="$2"
    local offset side out
    offset="$(mount_to_offset "$mount")"
    side="$(face_to_side "$face")"
    out="$OUT_DIR/rectangular_${mount}-centered_${face}_14x14.stl"
    echo "==> rectangular ${mount}-centered ${face}  ->  $(basename "$out")"
    "$OSC" \
        -D "fan_offset_x=${offset}" \
        -D "side=\"${side}\"" \
        -o "$out" "$CODE_DIR/rectangular_adapter.scad" 2>&1 | tail -6
}

build_strip() {
    local mount="$1" face="$2"
    local offset side out
    offset="$(mount_to_offset "$mount")"
    side="$(face_to_side "$face")"
    out="$OUT_DIR/strip_${mount}-centered_${face}_15.5x3.stl"
    echo "==> strip ${mount}-centered ${face}  ->  $(basename "$out")"
    "$OSC" \
        -D "fan_offset_x=${offset}" \
        -D "side=\"${side}\"" \
        -o "$out" "$CODE_DIR/strip.scad" 2>&1 | tail -6
}

for mount in rib indent; do
    for face in topside underside; do
        for id in "${CIRCULAR_IDS[@]}"; do
            build_circular "$mount" "$face" "$id"
        done
        build_rectangular "$mount" "$face"
        build_strip "$mount" "$face"
    done
done

echo
echo "Done. STLs are in: $OUT_DIR"
ls -lh "$OUT_DIR"/*.stl
