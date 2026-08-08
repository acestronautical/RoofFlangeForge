# Roof Flange Forge

Design and 3D-print flange adapters that mount cleanly on a ribbed sheet-metal
roof — van roofs, shed roofs, RV panels, corrugated agricultural buildings.
Enter your roof's rib profile, pick a flange shape, and download an STL that
bridges the ribs and gives a fan, vent, skylight, or duct a flat, sealable
base.

![Roof Flange Forge](docs/screenshot.png)

## Get it

- **In your browser** — <https://acestronautical.github.io/RoofFlangeForge/>
- **As a desktop app** — [download the latest release](https://github.com/acestronautical/RoofFlangeForge/releases/latest)
  for macOS, Windows, or Linux

Both versions do the same thing and work fully offline once loaded.

## What you can make

- **Circular flange** — round mounting ring for round-flange fittings (Maxxair
  Dome, 6"–7" vents, roof jacks, small skylights)
- **Rectangular flange** — framed opening for fans in a rectangular cutout
  (defaults suit MaxxFan-family 14×14" fans)
- **Strip** — a mounting bar with no cutout, for roof-rack rails, panel mount
  bases, cable tie-downs
- **Roof preview** — an at-a-glance cross-section of the profile you configured,
  handy when you're eyeballing whether your numbers match the real panel

Every flange can be configured for either a **trapezoidal** roof (stamped body
panels, most vans) or a **corrugated** roof (sinusoidal, e.g. barn tin), and
comes in a **topside** piece, an **underside** piece, or **both at once** (both
mating parts spread apart in one STL, ready to sandwich the sheet metal
between them).

Optional bolt holes can be turned on with a single click. They auto-center on
the ring material and expose a signed offset to nudge them inward or outward.

## Using it

1. Open the app, pick **inches** or **millimeters** at the top.
2. Pick a **Shape** and set its size.
3. Set the **Roof** profile and dimensions to match the sheet metal you're
   mounting on. Every field has a hover hint; the **Show diagram** link at
   the bottom of the Roof section pops up a labeled cross-section.
4. Choose **Placement** — whether the flange center sits over a rib or an
   indent, and whether you're printing the topside, underside, or both.
5. Turn on **Bolt holes** if you want the holes pre-drilled.
6. Hit **Render**, review the preview, then **Download**.

The share button in the top-right copies a link that reproduces your exact
STL — bookmark it, send it to a friend, or come back to it later.

Read the [help modal](https://acestronautical.github.io/RoofFlangeForge/?help=1)
in the app for tips on tolerance adjustments (loose fit, snug fit, sheet
thickness, corner radius) before you commit to a full print.

## Credits

Development notes for the code are in [DEV.md](DEV.md).
