// =============================================================================
// strip.scad
//
// A rectangular mounting strip that conforms to a periodic trapezoidal-rib
// roof (see trapezoidal_roof.scad). Structurally the same as
// rectangular_adapter.scad minus the inner cutout -- a solid bar that spans
// the ribs, suitable for roof-rack rails, panel mount bases, cable
// tie-downs, etc.
//
// Topside and underside variants are the two halves of a single prism split
// along the roof surface -- see circular_adapter.scad for the full explanation.
//
// All dimensions in inches; final scale converts to millimeters.
// =============================================================================

include <trapezoidal_roof.scad>
include <corrugated_roof.scad>
include <bolt_pattern.scad>

// -----------------------------------------------------------------------------
// Roof profile
// -----------------------------------------------------------------------------
roof_profile = "trapezoidal";            // "trapezoidal" or "corrugated"
roof_depth   = (roof_profile == "corrugated") ? corr_depth : indent_depth;

// -----------------------------------------------------------------------------
// Strip shape
// -----------------------------------------------------------------------------
strip_x     = 15.500;                     // length across ribs (X)
strip_y     = 3.000;                      // width along ribs (Y)
main_thick  = roof_depth;                 // thickness above/below the rib plateau plane

// -----------------------------------------------------------------------------
// Position on the roof and which side it mounts on
// -----------------------------------------------------------------------------
flange_offset_x = 0;                         // 0 = rib-centered; indent_center_x = indent-centered
side         = "top";                     // "top" (outside), "bottom" (inside), or "both" (both sides side by side)

// -----------------------------------------------------------------------------
// Bolt holes (opt-in). See bolt_pattern.scad.
// -----------------------------------------------------------------------------
bolt_holes  = false;                      // set true to subtract a bolt pattern
bolt_place  = "ribs";                     // "ribs", "indents", "both",
                                          //   "every-other-rib", "every-other-indent"
bolt_hole_d = 0.250;                      // through-hole diameter

// -----------------------------------------------------------------------------
// Render controls
// -----------------------------------------------------------------------------
$fn    = 240;
IN2MM  = 25.4;

// -----------------------------------------------------------------------------
// Derived cutter extents (Z range computed per-side inside the module).
// -----------------------------------------------------------------------------
cut_xy = 2 * max(strip_x, strip_y);
cut_z  = 4 * roof_depth;

scale([IN2MM, IN2MM, IN2MM]) render_all();

// =============================================================================
// Modules
// =============================================================================

module render_all() {
    if (side == "both") {
        // Strip is long in X; stack the two pieces along Y so the print bed
        // layout stays compact.
        gap = strip_y * 1.5;
        translate([0, -gap/2, 0]) strip("top");
        translate([0, +gap/2, 0]) strip("bottom");
    } else {
        strip(side);
    }
}

module strip(s = side) {
    z_top = (s == "top") ? +main_thick    : -sheet_thickness;
    z_bot = (s == "top") ? -roof_depth    : -main_thick - roof_depth - sheet_thickness;
    difference() {
        translate([0, 0, z_bot])
            linear_extrude(height = z_top - z_bot)
                square([strip_x, strip_y], center = true);
        roof_cutter(s);
        if (bolt_holes)
            bolt_column_at(
                strip_bolt_xs(),
                bolt_hole_d,
                4 * (main_thick + roof_depth + sheet_thickness)
            );
    }
}

// Roof pitch and feature widths for the currently-selected profile.
function _strip_pitch()    = (roof_profile == "corrugated") ? corr_pitch : roof_pitch;
function _strip_rib_w()    = (roof_profile == "corrugated") ? corr_pitch / 2 : rib_width;
function _strip_indent_w() = (roof_profile == "corrugated") ? corr_pitch / 2 : indent_top_w;
function _strip_indent_offset() =
    (roof_profile == "corrugated") ? corr_indent_center_x : indent_center_x;

// Include a feature centered at x only if at least half its width falls
// within the strip -- skips the partial rib/indent that gets clipped at
// either end.
function _feature_qualifies(x, w) =
    let (inside = min(x + w/2, strip_x/2) - max(x - w/2, -strip_x/2))
    inside >= w/2;

function _strip_rib_xs() =
    let (p = _strip_pitch(), w = _strip_rib_w(), n = ceil(strip_x / p) + 1)
    [ for (k = [-n : n])
        let (x = k * p - flange_offset_x)
        if (_feature_qualifies(x, w)) x ];

function _strip_indent_xs() =
    let (p = _strip_pitch(), w = _strip_indent_w(), off = _strip_indent_offset(),
         n = ceil(strip_x / p) + 1)
    [ for (k = [-n : n])
        let (x = off + k * p - flange_offset_x)
        if (_feature_qualifies(x, w)) x ];

function _every_other(xs) = [ for (i = [0 : 2 : len(xs) - 1]) xs[i] ];

function strip_bolt_xs() =
      bolt_place == "indents"            ? _strip_indent_xs()
    : bolt_place == "both"               ? concat(_strip_rib_xs(), _strip_indent_xs())
    : bolt_place == "every-other-rib"    ? _every_other(_strip_rib_xs())
    : bolt_place == "every-other-indent" ? _every_other(_strip_indent_xs())
    : _strip_rib_xs();

module roof_cutter(s = side) {
    if (roof_profile == "corrugated")
        corrugated_roof_cutter(
            flange_offset_x = flange_offset_x,
            pitch        = corr_pitch,
            depth        = corr_depth,
            cut_xy       = cut_xy,
            cut_z        = cut_z,
            side         = s,
            thickness    = sheet_thickness
        );
    else
        trapezoidal_roof_cutter(
            flange_offset_x = flange_offset_x,
            cut_xy       = cut_xy,
            cut_z        = cut_z,
            side         = s,
            thickness    = sheet_thickness
        );
}
