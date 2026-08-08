// =============================================================================
// 2013 Ford Transit Connect  -  Maxxfan Dome roof adapter
//
// Adapter = ring blank - roof cutter (see roof.scad). The ONLY rounding in
// the finished part comes from `roof_corner_r` on the roof cutter, so the
// resulting adapter has:
//   * sharp OD, ID, and top face      (adapter itself is not radiused)
//   * sharp pad arc-ends              (where pad meets the annulus ID/OD)
//   * rounded pad top corners         (from the roof rib -> indent-sidewall bend)
//   * rounded pad tip corners         (from the roof sidewall -> floor bend)
//
// `fan_offset_x` selects the mounting position on the roof:
//     0                       -> fan is centered on a rib          (default)
//     roof_indent_center_x    -> fan is centered on an indent
//     any real value          -> arbitrary off-center mount
//
// `side` selects which side of the roof the adapter mounts on:
//     "top"    -> outside of the vehicle, sits on top of the roof (default)
//     "bottom" -> inside the cabin, pads point up into the indents
//
// All design math is in inches; final scale converts to mm for slicing.
// =============================================================================

include <roof.scad>

$fn = 240;

// -----------------------------------------------------------------------------
// Mounting position and side on the roof (override with -D from the command line)
// -----------------------------------------------------------------------------
fan_offset_x = 0;
side         = "top";                    // "top" or "bottom"

// -----------------------------------------------------------------------------
// Roof stamping radius. This is the only fillet in the finished part; it lives
// on the roof cutter, so it only shapes the pad top / tip corners.
// -----------------------------------------------------------------------------
roof_corner_r = 0.0625;                  // 1/16" - matches typical automotive stamping

// -----------------------------------------------------------------------------
// Adapter dimensions (inches) -- what the finished part measures
// -----------------------------------------------------------------------------
ID           = 6.500;
OD           = 10.000;
main_thick   = 0.375;                    // ring above rib plateau
pad_drop     = 0.450;                    // pad protrusion into indent
total_thick  = main_thick + pad_drop;    // 0.825"

// Cutter indent void shape (undersized vs the actual roof for install clearance)
cutter_top_w   = 1.950;
cutter_bot_w   = 1.450;
cutter_depth   = pad_drop;

// -----------------------------------------------------------------------------
// Cutter extents (must be larger than OD so it fully covers the ring)
// -----------------------------------------------------------------------------
CUT_XY = 40;
CUT_Z  =  5;

// -----------------------------------------------------------------------------
// Unit conversion (STL exports in mm)
// -----------------------------------------------------------------------------
IN2MM = 25.4;

scale([IN2MM, IN2MM, IN2MM])
    if (side == "bottom") mirror([0, 0, 1]) adapter();
    else                  adapter();

// =============================================================================
// Modules
// =============================================================================

module adapter() {
    difference() {
        ring_blank();
        roof_cutter(
            fan_offset_x         = fan_offset_x,
            cutter_indent_top_w  = cutter_top_w,
            cutter_indent_bot_w  = cutter_bot_w,
            cutter_indent_depth  = cutter_depth,
            cutter_corner_r      = roof_corner_r,
            cut_xy               = CUT_XY,
            cut_z                = CUT_Z,
            side                 = "top"
        );
    }
}

// Annular prism from Z = -pad_drop to Z = +main_thick
module ring_blank() {
    translate([0, 0, -pad_drop])
        linear_extrude(height = total_thick)
            difference() {
                circle(d = OD);
                circle(d = ID);
            }
}
