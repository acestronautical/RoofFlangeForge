// =============================================================================
// bolt_pattern.scad
//
// Bolt-hole cutter modules. Each generates a set of vertical through-hole
// cylinders you subtract from an adapter body. Fully self-contained: no
// dependency on adapter geometry beyond the enable flag and pass-through
// dimensions.
//
// Every adapter honors a top-level `bolt_holes = false` variable; when set
// true, the adapter subtracts the matching bolt pattern in a difference()
// pass. Leave the flag off (the default) and this file has zero effect --
// the geometry is byte-identical to the pre-bolt-holes version.
// =============================================================================

bolt_eps = 0.010;                        // face-clearing overlap on each end

// Centered vertically around z=0; caller sizes h to span the adapter.
module bolt_cyl(d, h) {
    translate([0, 0, -h/2])
        cylinder(h = h, d = d, $fn = 32);
}

// n bolts evenly spaced on a bolt circle of diameter pcd.
module circular_bolt_pattern(n, pcd, hole_d, h, angle_offset = 0) {
    for (i = [0 : n-1]) {
        a = angle_offset + i * 360 / n;
        translate([pcd/2 * cos(a), pcd/2 * sin(a), 0])
            bolt_cyl(hole_d, h);
    }
}

// Bolts around the perimeter of a rectangle: corners are always included,
// with n_per_side controlling total bolts on each edge (corners shared
// between the two edges they touch, so n_per_side = 2 gives 4 total,
// n_per_side = 3 gives 8, n_per_side = 4 gives 12, etc.).
module rectangular_bolt_pattern(outer_x, outer_y, n_per_side, edge_inset, hole_d, h) {
    ex = outer_x / 2 - edge_inset;
    ey = outer_y / 2 - edge_inset;

    for (p = [[+ex, +ey], [-ex, +ey], [+ex, -ey], [-ex, -ey]])
        translate([p[0], p[1], 0]) bolt_cyl(hole_d, h);

    if (n_per_side >= 3) {
        for (i = [1 : n_per_side - 2]) {
            x = -ex + i * (2 * ex) / (n_per_side - 1);
            y = -ey + i * (2 * ey) / (n_per_side - 1);
            translate([x, +ey, 0]) bolt_cyl(hole_d, h);
            translate([x, -ey, 0]) bolt_cyl(hole_d, h);
            translate([+ex, y, 0]) bolt_cyl(hole_d, h);
            translate([-ex, y, 0]) bolt_cyl(hole_d, h);
        }
    }
}

// n evenly-spaced bolts on the centerline of a strip of length strip_x.
module strip_bolt_pattern(strip_x, n, edge_inset, hole_d, h) {
    xs = n == 1 ? [0]
        : [ for (i = [0 : n-1]) -strip_x/2 + edge_inset + i * (strip_x - 2*edge_inset) / (n - 1) ];
    for (x = xs)
        translate([x, 0, 0]) bolt_cyl(hole_d, h);
}

// Drop a bolt at each X in xs, on the strip centerline (y=0).
module bolt_column_at(xs, hole_d, h) {
    for (x = xs)
        translate([x, 0, 0]) bolt_cyl(hole_d, h);
}
