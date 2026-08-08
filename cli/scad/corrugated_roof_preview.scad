// =============================================================================
// corrugated_roof_preview.scad
//
// Visual sanity check for corrugated_roof.scad. Renders a manageable chunk
// of the roof as a thin sheet-metal-like panel so the STL reads like a real
// corrugated panel rather than a solid block.
// =============================================================================

include <corrugated_roof.scad>

$fn = 240;

preview_xy      = 12;
sheet_thickness = 0.100;

fan_offset_x = 0;                        // 0 = rib-centered (peak); corr_indent_center_x = indent-centered (trough)

IN2MM = 25.4;

scale([IN2MM, IN2MM, IN2MM])
    corrugated_roof_sheet(
        fan_offset_x    = fan_offset_x,
        cut_xy          = preview_xy,
        sheet_thickness = sheet_thickness
    );
