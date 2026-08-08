// =============================================================================
// rectangular_adapter.scad
//
// A rectangular mounting adapter (14x14-style MaxxFan family) that conforms
// to a periodic trapezoidal-rib roof (see trapezoidal_roof.scad). Structure
// is identical to circular_adapter.scad; only the blank shape differs
// (rectangular frame instead of an annulus).
//
// Topside and underside variants are the two halves of a single cylinder
// (well, rectangular prism) split along the roof surface -- see
// circular_adapter.scad for the full explanation.
//
// All dimensions in inches; final scale converts to millimeters.
// =============================================================================

include <trapezoidal_roof.scad>

// -----------------------------------------------------------------------------
// Adapter shape
// -----------------------------------------------------------------------------
inner_x     = 14.000;                     // fan cutout size in X (across ribs)
inner_y     = 14.000;                     // fan cutout size in Y (along ribs)
outer_x     = 15.500;                     // overall X extent
outer_y     = 15.500;                     // overall Y extent
main_thick  = indent_depth;               // thickness of this piece above/below the rib plateau plane

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
// Derived (see circular_adapter.scad for the rationale on the Z math)
// -----------------------------------------------------------------------------
z_top  = (side == "top") ? +main_thick    : -sheet_thickness;
z_bot  = (side == "top") ? -indent_depth  : -main_thick - indent_depth - sheet_thickness;
cut_xy = 2 * max(outer_x, outer_y);
cut_z  = 4 * indent_depth;

scale([IN2MM, IN2MM, IN2MM]) rectangular_adapter();

// =============================================================================
// Modules
// =============================================================================

module rectangular_adapter() {
    difference() {
        translate([0, 0, z_bot])
            linear_extrude(height = z_top - z_bot)
                difference() {
                    square([outer_x, outer_y], center = true);
                    square([inner_x, inner_y], center = true);
                }
        trapezoidal_roof_cutter(
            fan_offset_x = fan_offset_x,
            cut_xy       = cut_xy,
            cut_z        = cut_z,
            side         = side
        );
    }
}
