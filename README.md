# SECHA City · The House of Five Senses

[Play SECHA City](https://jplovensa.github.io/secha-city/)

## The House Opens at Dusk

SECHA City is a continuous Babylon.js world built from the original SketchUp district, arrival gardens, Wayang Gallery, Material Library and Rumah Teduh interior. The current commission begins with Josephine at reception. Visit Ibu at Rumah Teduh, bring her brief to Dina at the Material Library, and choose a timber screen. Return to reveal the finished room at dusk. The selected screen, lighting, fee and trust outcome change with the decision, and the browser saves the commission.

Walk with **WASD** or the touch controls and drag the view to look around. Press **E** to interact. **Follow route** walks to the current objective through the connected city. The compass map shows landmarks and the next stop.

The garage is by the perimeter road, behind reception. Choose the City Hatch, Terracotta Coupé or Pandan Touring. Press **C** to switch between cockpit and chase views and use **Space** for the handbrake. The drift challenge starts from the driving controls.

The former preview URL redirects to the main city. The earlier city-builder and story menus remain in repository history.

## Development

Requires Node 22. Run `npm ci`, `npm run dev`, `npm run build`, and `npm run check`. Push to `main` to publish to GitHub Pages. The base path is relative so the models load from `/secha-city/`.

For the source model export, run `tools/export_scene.py` from the SketchUp model workspace with its SketchUp SDK loader and the model path and output directory as arguments.

Story dialogue appears as text. The mission’s optional Pandan Walk audio compares open air and sheltered ambience.

### Credits

- [Character assets](public/CHARACTER-CREDITS.md)
- [Ruang Bayang artwork](public/ARTWORK-CREDITS.md)
- [Five-Door Hatchback by tevy](https://tevy.dev/models/hatchback), CC0 1.0.

- [Classic 1970s Coupé](https://tevy.dev/models/classic-coupe) and [Family Estate Car](https://tevy.dev/models/estate-car) by tevy, CC0 1.0. The build downloads and verifies a pinned version of each model and serves both from the site.
- [Kloofendal 48d Partly Cloudy](https://polyhaven.com/a/kloofendal_48d_partly_cloudy) daylight HDRI by Greg Zaal via Poly Haven, CC0 1.0.
