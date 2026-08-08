// =============================================================================
// trapezoidal_roof.scad
//
// Parametric model of a periodic sheet-metal roof whose cross-section is a
// series of flat rib plateaus separated by trapezoidal indent valleys. The
// defaults match the example ribbed sheet-metal roof, but every dimension is
// a top-level variable and can be overridden with OpenSCAD's -D flag, so this
// file can drive adapter designs for any roof with the same profile family.
//
// Exports:
//     module trapezoidal_roof_cutter(...)   - solid block on one side of the
//                                             roof surface, sized for
//                                             subtraction from a ring blank.
//     module trapezoidal_roof_sheet(...)    - thin sheet-metal-like
//                                             visualization of the roof.
//
// All dimensions are in inches; unit conversion happens in the consumer.
// =============================================================================

// -----------------------------------------------------------------------------
// Roof cross-section defaults (inches). Every one is overridable via -D.
// -----------------------------------------------------------------------------
rib_width      = 3.500;        // rib plateau width (flat top between indents)
indent_top_w   = 2.000;        // indent width at rib plateau level (top of the trapezoid)
indent_bot_w   = 1.500;        // indent width at the floor              (bottom of the trapezoid)
indent_depth   = 0.500;        // vertical drop from rib plateau to indent floor
corner_r       = 0.0625;       // convex bend radius on the rib-to-sidewall corners
sheet_thickness = 0.032;       // sheet-metal gauge (~0.8 mm on automotive body panels)

// Derived
roof_pitch          = rib_width + indent_top_w;                    // rib CL to next rib CL
indent_center_x     = rib_width/2 + indent_top_w/2;                // rib CL to adjacent indent CL

// =============================================================================
// trapezoidal_roof_cutter(fan_offset_x, top_w, bot_w, depth, r,
//                         cut_xy, cut_z, side)
//
// A solid block on one side of the roof surface, sized so the roof is fully
// captured within its X-Y footprint. Subtract from a ring blank to carve the
// roof profile into it.
//
// The block's top surface (when side == "top") sits at Z = 0 at rib plateau
// level and drops into trapezoidal valleys at every indent centerline.
//
// Parameters:
//   fan_offset_x - horizontal shift of the roof pattern under the fan:
//                    0                 -> a rib centerline sits at X = 0
//                    indent_center_x   -> an indent centerline sits at X = 0
//                    any real value    -> arbitrary off-center placement
//   top_w        - indent top width to carve  (default: real roof indent_top_w)
//   bot_w        - indent bottom width to carve
//   depth        - indent depth to carve
//   r            - convex bend radius on the rib-to-sidewall corners
//   cut_xy       - half-width of the cutter in X and Y (large enough to cover
//                  the ring blank in every direction)
//   cut_z        - depth of the cutter block below the roof surface
//   side         - "top"    : block fills the space BELOW the roof surface
//                             (subtract to build a topside adapter)
//                  "bottom" : block fills the space ABOVE the roof surface
//                             (subtract to build an underside adapter)
// =============================================================================
module trapezoidal_roof_cutter(
    fan_offset_x = 0,
    top_w        = indent_top_w,
    bot_w        = indent_bot_w,
    depth        = indent_depth,
    r            = corner_r,
    cut_xy       = 40,
    cut_z        = 5,
    side         = "top",
    thickness    = sheet_thickness
) {
    // The bottom cutter aligns with the roof's BOTTOM face (offset down from
    // the top face by the sheet-metal gauge), so top+bottom cutters leave a
    // sheet-thickness gap between them where the physical roof lives.
    z_shift = (side == "bottom") ? -thickness : 0;
    translate([0, 0, z_shift])
        rotate([90, 0, 0])
            linear_extrude(height = 2*cut_xy, center = true)
                trapezoidal_roof_profile_2d(
                    fan_offset_x = fan_offset_x,
                    top_w        = top_w,
                    bot_w        = bot_w,
                    depth        = depth,
                    corner_r     = r,
                    cut_xy       = cut_xy,
                    cut_z        = cut_z,
                side         = side
            );
}

// The 2D cross-section of the cutter. Interior of the polygon = block material.
// CCW winding is chosen so the roof surface bounds the interior on the correct
// side; `offset(r=+r) offset(r=-r)` then rounds the CONVEX corners (the
// rib-to-sidewall bends) in place, matching how stamped sheet metal actually
// curves outward at those transitions.
module trapezoidal_roof_profile_2d(
    fan_offset_x,
    top_w,
    bot_w,
    depth,
    corner_r,
    cut_xy,
    cut_z,
    side = "top"
) {
    top_y = 0.010;             // small overlap into positive Z (a hair above the rib plateau)

    surface_ltr = trapezoidal_roof_surface_pts(
        fan_offset_x = fan_offset_x,
        top_w        = top_w,
        bot_w        = bot_w,
        depth        = depth,
        cut_xy       = cut_xy,
        top_y        = top_y
    );
    n = len(surface_ltr);

    pts = (side == "top")
        ? concat(
            [[-cut_xy, -cut_z], [+cut_xy, -cut_z]],
            [ for (i = [n-1 : -1 : 0]) surface_ltr[i] ]
        )
        : concat(
            [[+cut_xy, +cut_z], [-cut_xy, +cut_z]],
            surface_ltr
        );

    if (corner_r > 0)
        offset(r = +corner_r) offset(r = -corner_r) polygon(pts);
    else
        polygon(pts);
}

// List of (X, Y) points that trace the roof's TOP surface across [-cut_xy, +cut_xy],
// left to right, including the trapezoidal dip into every indent in range.
// Y in the 2D plane will become Z after the caller's rotate([90,0,0]).
function trapezoidal_roof_surface_pts(fan_offset_x, top_w, bot_w, depth, cut_xy, top_y) =
    let (
        n_max     = ceil(cut_xy / roof_pitch) + 1,
        indent_xs = [
            for (k = [-n_max : n_max])
                let (ix = indent_center_x + k * roof_pitch - fan_offset_x)
                if (abs(ix) <= cut_xy) ix
        ]
    )
    concat(
        [[-cut_xy, top_y]],
        [ for (ix = indent_xs)
            each [
                [ix - top_w/2, top_y],              // left rib-to-sidewall bend  (convex)
                [ix - bot_w/2, -depth],             // left sidewall-to-floor bend (concave)
                [ix + bot_w/2, -depth],             // right sidewall-to-floor bend (concave)
                [ix + top_w/2, top_y]               // right rib-to-sidewall bend  (convex)
            ]
        ],
        [[+cut_xy, top_y]]
    );

// =============================================================================
// trapezoidal_roof_sheet(...)
//
// Thin sheet-metal visualization of the roof. Same top surface as
// trapezoidal_roof_cutter, but the polygon closes to a bottom that is the
// top surface offset down by `sheet_thickness`. Not used by circular_adapter;
// intended for previewing the roof shape as a stamped panel.
//
// Corners are intentionally left sharp -- applying the same offset(r=-r)
// rounding used by the cutter would erode a real body-panel-gauge sheet
// (~0.032") to nothing.
// =============================================================================
module trapezoidal_roof_sheet(
    fan_offset_x    = 0,
    top_w           = indent_top_w,
    bot_w           = indent_bot_w,
    depth           = indent_depth,
    cut_xy          = 12,
    sheet_thickness = 0.100      // visualization thickness; not physically accurate
) {
    rotate([90, 0, 0])
        linear_extrude(height = 2*cut_xy, center = true)
            trapezoidal_roof_sheet_2d(
                fan_offset_x    = fan_offset_x,
                top_w           = top_w,
                bot_w           = bot_w,
                depth           = depth,
                cut_xy          = cut_xy,
                sheet_thickness = sheet_thickness
            );
}

module trapezoidal_roof_sheet_2d(fan_offset_x, top_w, bot_w, depth, cut_xy, sheet_thickness) {
    top_y = 0.010;

    surface_ltr = trapezoidal_roof_surface_pts(
        fan_offset_x = fan_offset_x,
        top_w        = top_w,
        bot_w        = bot_w,
        depth        = depth,
        cut_xy       = cut_xy,
        top_y        = top_y
    );
    n = len(surface_ltr);

    // CCW: top surface RTL (interior below the top edge) then bottom surface
    // LTR (interior above the bottom edge). Interior = sheet material.
    surface_rtl = [ for (i = [n-1 : -1 : 0]) surface_ltr[i] ];
    bottom_ltr  = [ for (p = surface_ltr) [p[0], p[1] - sheet_thickness] ];

    polygon(concat(surface_rtl, bottom_ltr));
}
