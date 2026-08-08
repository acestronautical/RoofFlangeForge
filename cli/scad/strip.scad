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
fan_offset_x = 0;                         // 0 = rib-centered; indent_center_x = indent-centered
side         = "top";                     // "top" (outside of roof) or "bottom" (inside)

// -----------------------------------------------------------------------------
// Render controls
// -----------------------------------------------------------------------------
$fn    = 240;
IN2MM  = 25.4;

// -----------------------------------------------------------------------------
// Derived (see circular_adapter.scad for the rationale on the Z math)
// -----------------------------------------------------------------------------
z_top  = (side == "top") ? +main_thick    : -sheet_thickness;
z_bot  = (side == "top") ? -roof_depth    : -main_thick - roof_depth - sheet_thickness;
cut_xy = 2 * max(strip_x, strip_y);
cut_z  = 4 * roof_depth;

scale([IN2MM, IN2MM, IN2MM]) strip();

// =============================================================================
// Modules
// =============================================================================

module strip() {
    difference() {
        translate([0, 0, z_bot])
            linear_extrude(height = z_top - z_bot)
                square([strip_x, strip_y], center = true);
        roof_cutter();
    }
}

module roof_cutter() {
    if (roof_profile == "corrugated")
        corrugated_roof_cutter(
            fan_offset_x = fan_offset_x,
            pitch        = corr_pitch,
            depth        = corr_depth,
            cut_xy       = cut_xy,
            cut_z        = cut_z,
            side         = side,
            thickness    = sheet_thickness
        );
    else
        trapezoidal_roof_cutter(
            fan_offset_x = fan_offset_x,
            cut_xy       = cut_xy,
            cut_z        = cut_z,
            side         = side,
            thickness    = sheet_thickness
        );
}
