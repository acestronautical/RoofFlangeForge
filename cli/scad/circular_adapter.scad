// =============================================================================
// circular_adapter.scad
//
// An annular mounting adapter that conforms to a periodic trapezoidal-rib
// roof (see trapezoidal_roof.scad).
//
// The topside and underside variants are the two halves of a single cylinder
// split along the roof surface:
//
//   side = "top"    -> the piece ABOVE the roof, with pads that drop DOWN
//                      into the indents
//   side = "bottom" -> the piece BELOW the roof, with pockets that receive
//                      those pads from below
//
// Their union fills a solid ring cylinder of thickness `main_thick + indent_depth`
// on each side of the roof plateau plane (2 * main_thick when main_thick equals
// indent_depth, which is the default).
//
// All dimensions in inches; final scale converts to millimeters.
// =============================================================================

include <trapezoidal_roof.scad>
include <corrugated_roof.scad>
include <bolt_pattern.scad>

// -----------------------------------------------------------------------------
// Roof profile: which cross-section to conform the underside to
// -----------------------------------------------------------------------------
roof_profile = "trapezoidal";            // "trapezoidal" or "corrugated"
roof_depth   = (roof_profile == "corrugated") ? corr_depth : indent_depth;

// -----------------------------------------------------------------------------
// Adapter shape
// -----------------------------------------------------------------------------
ID          = 6.500;                      // inner diameter (must be >= the opening you're framing)
OD          = 10.000;                     // outer diameter
main_thick  = roof_depth;                 // thickness of this piece above (topside) or below (underside) the rib plateau plane

// -----------------------------------------------------------------------------
// Position of the flange center on the roof and which side the adapter mounts on
// -----------------------------------------------------------------------------
flange_offset_x = 0;                         // 0 = rib-centered; indent_center_x = indent-centered
side         = "top";                     // "top" (outside), "bottom" (inside), or "both" (both sides side by side)

// -----------------------------------------------------------------------------
// Bolt holes (opt-in). See bolt_pattern.scad.
// -----------------------------------------------------------------------------
bolt_holes  = false;                      // set true to subtract a bolt pattern
bolt_n      = 8;                          // number of bolts on the bolt circle
bolt_pcd    = (ID + OD) / 2;              // pitch circle diameter (default: centered on the ring)
bolt_hole_d = 0.250;                      // through-hole diameter

// -----------------------------------------------------------------------------
// Render controls
// -----------------------------------------------------------------------------
$fn    = 240;
IN2MM  = 25.4;

// -----------------------------------------------------------------------------
// Derived: cutter extents. Z range is computed per-side inside the module
// (see circular_adapter) so "both" mode can render top + bottom at once.
// -----------------------------------------------------------------------------
cut_xy = 2 * OD;
cut_z  = 4 * roof_depth;

scale([IN2MM, IN2MM, IN2MM]) render_all();

// =============================================================================
// Modules
// =============================================================================

module render_all() {
    if (side == "both") {
        gap = OD * 1.1;
        translate([-gap/2, 0, 0]) circular_adapter("top");
        translate([+gap/2, 0, 0]) circular_adapter("bottom");
    } else {
        circular_adapter(side);
    }
}

module circular_adapter(s = side) {
    z_top = (s == "top") ? +main_thick    : -sheet_thickness;
    z_bot = (s == "top") ? -roof_depth    : -main_thick - roof_depth - sheet_thickness;
    difference() {
        translate([0, 0, z_bot])
            linear_extrude(height = z_top - z_bot)
                difference() {
                    circle(d = OD);
                    circle(d = ID);
                }
        roof_cutter(s);
        if (bolt_holes)
            circular_bolt_pattern(
                n       = bolt_n,
                pcd     = bolt_pcd,
                hole_d  = bolt_hole_d,
                h       = 4 * (main_thick + roof_depth + sheet_thickness)
            );
    }
}

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
