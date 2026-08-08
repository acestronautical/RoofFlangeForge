// =============================================================================
// trapezoidal_roof_preview.scad
//
// Visual sanity check for trapezoidal_roof.scad. Renders a manageable chunk
// of the roof as a thin sheet-metal-like panel so the STL reads like a real
// stamped roof rather than a solid block.
//
// The volumetric `trapezoidal_roof_cutter` used by circular_adapter.scad
// stays unchanged; this file only calls `trapezoidal_roof_sheet`.
// =============================================================================

include <trapezoidal_roof.scad>

$fn = 240;

// -----------------------------------------------------------------------------
// Preview extents (inches).  Big enough to show at least three ribs and two
// indents on each side of the fan center.  Sheet thickness is bumped up from
// the real ~0.032" gauge to 0.100" purely so it reads clearly as an STL.
// -----------------------------------------------------------------------------
preview_xy      = 12;
sheet_thickness = 0.100;

fan_offset_x = 0;                        // 0 = rib-centered; indent_center_x = indent-centered

IN2MM = 25.4;

scale([IN2MM, IN2MM, IN2MM])
    trapezoidal_roof_sheet(
        fan_offset_x    = fan_offset_x,
        cut_xy          = preview_xy,
        sheet_thickness = sheet_thickness
    );
