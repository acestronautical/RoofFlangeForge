// =============================================================================
// corrugated_roof.scad
//
// Parametric model of a periodic sinusoidal "corrugated" sheet-metal roof --
// the classic wavy metal panel seen on sheds, barns, and some industrial
// vehicles. Signature-compatible with trapezoidal_roof.scad's cutter so the
// adapters can dispatch between the two at render time.
//
// Exports:
//     module corrugated_roof_cutter(...)  - solid block on one side of the
//                                           roof surface, sized for
//                                           subtraction from a blank.
//     module corrugated_roof_sheet(...)   - thin sheet-metal-like
//                                           visualization of the roof.
//
// The trapezoidal file owns `sheet_thickness` (and `corner_r`); this file
// only declares corrugated-specific variables so both can be `include`d in
// the same adapter without collisions.
// =============================================================================

// -----------------------------------------------------------------------------
// Corrugated cross-section defaults (inches). Overridable via -D.
// -----------------------------------------------------------------------------
corr_pitch = 2.667;    // rib-to-rib spacing (one full wave, "wavelength")
corr_depth = 0.500;    // peak-to-trough vertical distance

// Derived
corr_indent_center_x = corr_pitch / 2;   // half-wavelength from a peak = trough centerline

// =============================================================================
// corrugated_roof_cutter(flange_offset_x, pitch, depth, cut_xy, cut_z, side,
//                       thickness, samples_per_pitch)
//
// See trapezoidal_roof_cutter for parameter semantics. `flange_offset_x = 0`
// puts a peak (rib) at X = 0; `flange_offset_x = corr_indent_center_x` puts a
// trough (indent) at X = 0.
// =============================================================================
module corrugated_roof_cutter(
    flange_offset_x      = 0,
    pitch             = corr_pitch,
    depth             = corr_depth,
    cut_xy            = 40,
    cut_z             = 5,
    side              = "top",
    thickness         = 0.032,
    samples_per_pitch = 64,
    tolerance         = 0
) {
    z_shift = (side == "bottom") ? -thickness : 0;
    // top_y is the tiny above-plateau overlap baked into the profile; used
    // here as the plateau reference line for the tolerance clip.
    top_y = 0.010;
    translate([0, 0, z_shift])
        rotate([90, 0, 0])
            linear_extrude(height = 2*cut_xy, center = true)
                if (tolerance <= 0) {
                    corrugated_roof_profile_2d(
                        flange_offset_x      = flange_offset_x,
                        pitch             = pitch,
                        depth             = depth,
                        cut_xy            = cut_xy,
                        cut_z             = cut_z,
                        side              = side,
                        samples_per_pitch = samples_per_pitch
                    );
                } else if (side == "top") {
                    intersection() {
                        offset(delta = tolerance)
                            corrugated_roof_profile_2d(
                                flange_offset_x      = flange_offset_x,
                                pitch             = pitch,
                                depth             = depth,
                                cut_xy            = cut_xy,
                                cut_z             = cut_z,
                                side              = "top",
                                samples_per_pitch = samples_per_pitch
                            );
                        translate([-2*cut_xy, -2*cut_z])
                            square([4*cut_xy, 2*cut_z + top_y]);
                    }
                } else {
                    // See trapezoidal_roof_cutter for the rationale: for the
                    // bottom side we can't just clip the offset polygon,
                    // because the trough pockets live below the plateau
                    // line and a symmetric clip would erase them. Union the
                    // above-plateau slice of the offset with an offset of
                    // just the below-plateau trough bulges instead.
                    union() {
                        intersection() {
                            offset(delta = tolerance)
                                corrugated_roof_profile_2d(
                                    flange_offset_x      = flange_offset_x,
                                    pitch             = pitch,
                                    depth             = depth,
                                    cut_xy            = cut_xy,
                                    cut_z             = cut_z,
                                    side              = "bottom",
                                    samples_per_pitch = samples_per_pitch
                                );
                            translate([-2*cut_xy, top_y])
                                square([4*cut_xy, 4*cut_z]);
                        }
                        offset(delta = tolerance) intersection() {
                            corrugated_roof_profile_2d(
                                flange_offset_x      = flange_offset_x,
                                pitch             = pitch,
                                depth             = depth,
                                cut_xy            = cut_xy,
                                cut_z             = cut_z,
                                side              = "bottom",
                                samples_per_pitch = samples_per_pitch
                            );
                            translate([-2*cut_xy, -2*cut_z])
                                square([4*cut_xy, 2*cut_z + top_y]);
                        }
                    }
                }
}

// The 2D cross-section of the cutter. `y = top_y` at the peak (rib plateau
// level, at Z = 0 after the extrude/rotate) and `y = top_y - depth` at the
// trough. Enough samples per wavelength that the polygon reads as a smooth
// curve after linear_extrude.
module corrugated_roof_profile_2d(
    flange_offset_x,
    pitch,
    depth,
    cut_xy,
    cut_z,
    side              = "top",
    samples_per_pitch = 64
) {
    top_y   = 0.010;              // small overlap above the rib plateau, matches trapezoidal
    amp     = depth / 2;          // half of peak-to-trough
    total_x = 2 * cut_xy;
    n       = max(2, ceil(total_x / pitch * samples_per_pitch));
    step    = total_x / n;

    // z(x) = top_y - amp + amp*cos(...) so peaks touch top_y and troughs sit at top_y - depth.
    surface_ltr = [
        for (i = [0 : n])
            let (x = -cut_xy + i * step)
            [x, top_y - amp + amp * cos(360 * (x - flange_offset_x) / pitch)]
    ];

    pts = (side == "top")
        ? concat(
            [[-cut_xy, -cut_z], [+cut_xy, -cut_z]],
            [ for (i = [n : -1 : 0]) surface_ltr[i] ]
        )
        : concat(
            [[+cut_xy, +cut_z], [-cut_xy, +cut_z]],
            surface_ltr
        );

    polygon(pts);
}

// =============================================================================
// corrugated_roof_sheet(...)
//
// Thin sheet-metal visualization of the roof. Same top surface as
// corrugated_roof_cutter, closed to a bottom offset down by `sheet_thickness`.
// =============================================================================
module corrugated_roof_sheet(
    flange_offset_x      = 0,
    pitch             = corr_pitch,
    depth             = corr_depth,
    cut_xy            = 12,
    sheet_thickness   = 0.100,     // visualization thickness; not physically accurate
    samples_per_pitch = 64
) {
    rotate([90, 0, 0])
        linear_extrude(height = 2*cut_xy, center = true)
            corrugated_roof_sheet_2d(
                flange_offset_x      = flange_offset_x,
                pitch             = pitch,
                depth             = depth,
                cut_xy            = cut_xy,
                sheet_thickness   = sheet_thickness,
                samples_per_pitch = samples_per_pitch
            );
}

module corrugated_roof_sheet_2d(
    flange_offset_x,
    pitch,
    depth,
    cut_xy,
    sheet_thickness,
    samples_per_pitch = 64
) {
    top_y   = 0.010;
    amp     = depth / 2;
    total_x = 2 * cut_xy;
    n       = max(2, ceil(total_x / pitch * samples_per_pitch));
    step    = total_x / n;

    top_ltr = [
        for (i = [0 : n])
            let (x = -cut_xy + i * step)
            [x, top_y - amp + amp * cos(360 * (x - flange_offset_x) / pitch)]
    ];
    // Bottom face parallels the top by shifting each Y down by sheet_thickness.
    bot_rtl = [ for (i = [n : -1 : 0]) [ top_ltr[i][0], top_ltr[i][1] - sheet_thickness ] ];

    polygon(concat(top_ltr, bot_rtl));
}
