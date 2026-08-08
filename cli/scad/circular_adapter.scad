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

// -----------------------------------------------------------------------------
// Roof profile: which cross-section to conform the underside to
// -----------------------------------------------------------------------------
roof_profile = "trapezoidal";            // "trapezoidal" or "corrugated"
roof_depth   = (roof_profile == "corrugated") ? corr_depth : indent_depth;

// -----------------------------------------------------------------------------
// Adapter shape
// -----------------------------------------------------------------------------
ID          = 6.500;                      // inner diameter (must be >= fan cutout)
OD          = 10.000;                     // outer diameter
main_thick  = roof_depth;                 // thickness of this piece above (topside) or below (underside) the rib plateau plane

// -----------------------------------------------------------------------------
// Position of the fan center on the roof and which side the adapter mounts on
// -----------------------------------------------------------------------------
fan_offset_x = 0;                         // 0 = rib-centered; indent_center_x = indent-centered
side         = "top";                     // "top" (outside of vehicle) or "bottom" (inside cabin)

// -----------------------------------------------------------------------------
// Render controls
// -----------------------------------------------------------------------------
$fn    = 240;
IN2MM  = 25.4;

// -----------------------------------------------------------------------------
// Derived: blank Z range for the requested side, cutter extents.
// Each blank spans `main_thick + indent_depth` in Z so the finished part is
// `main_thick` thick at its thinnest cross-section and `main_thick +
// indent_depth` thick at its thickest, symmetric top/bottom (topside is
// thin at ribs and thick at indents; underside is the reverse). Their union
// fills a constant-thickness cylinder with a `sheet_thickness` slot around
// the physical roof.
// -----------------------------------------------------------------------------
z_top  = (side == "top") ? +main_thick    : -sheet_thickness;
z_bot  = (side == "top") ? -roof_depth    : -main_thick - roof_depth - sheet_thickness;
cut_xy = 2 * OD;
cut_z  = 4 * roof_depth;

scale([IN2MM, IN2MM, IN2MM]) circular_adapter();

// =============================================================================
// Modules
// =============================================================================

module circular_adapter() {
    difference() {
        translate([0, 0, z_bot])
            linear_extrude(height = z_top - z_bot)
                difference() {
                    circle(d = OD);
                    circle(d = ID);
                }
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
