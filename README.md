# SECHA City · The House of Five Senses

[Play SECHA City](https://jplovensa.github.io/secha-city/)

## Renovation mission

Start the renovation mission from the city menu. Walk from the gallery portal into Rumah Teduh, inspect the bedroom and choose a scope and screen finish against a single IDR 30 million budget and move-in date. Approve the illustrative quote, then compare waiting, switching finishes and fitting the screen after move-in. Each option shows its cost, handover date, dependencies and next owner.

Copy or download the finished brief to bring to a Studio+ consultation. The mission saves in the current browser. **Play mission without 3D** opens the same decisions and brief if WebGL is unavailable.

`renovation-data.js` holds the scenario. `renovation-mission.js` calculates the quote and timeline. `renovation-ui.js` handles mission steps, room previews and brief export. Timeline lead times use calendar days and overlap room prep with procurement.

## Central City

Open **Run Central City** to manage the interior district. The city starts with four vacant plots, one designer and 1,200 credits. Hire a builder or designer, choose a pavilion and shell material, assign an available worker, furnish the finished room and open it. Visitors generate revenue for the next sites. Drag over a plot to orbit it, scroll to zoom, or explore a built pavilion at eye level. City operations are saved in the current browser.

## Story missions

1. **A Room for Two** — follow Josephine’s brief through the garden and carved wayang gallery, then design a room for Ibu in Rumah Teduh.
2. **The First Commission** — choose timber, a divider and lighting within 850 SECHA credits. Compare the finished package with the original room.
3. **Opening Night** — set the city lighting, add guests to the salon and open the studio.

Choose **Drive the city** to visit the garage. Pick a City Hatch, Terracotta Coupé or Pandan Touring, then start the four-corner **Perimeter drift** mission or choose **Free drive**. Tap **Space** while turning to break traction and release it to regain grip. Slides inside marked zones score towards the 100-point target. The cockpit and chase views are available via **C** or the camera button. Touch devices have a handbrake button and the same camera and garage controls. Choose **Walk the streets** to explore on foot and get into the parked car. Follow the marked perimeter through South Gate, the Material Lab and Garden Villa. The street scene reuses the Compact Home, Family Townhouse, Garden Villa and Kitchen and Bath Lab exteriors from the SketchUp master.

Walk with **WASD**, drag to look, and press **E** to interact. Use **Approach** to walk up to a character automatically. In the car, **W/S** accelerate or reverse, **A/D** steer, and **E** exits. The directional buttons support touchscreens. The Cast menu places a character at a clear spot in the current room. Route returns to locations reached in the story. The guided edition offers the story and design tasks without 3D. Room design settings are saved in the browser.

## Development

Requires Node 22. Run `npm ci`, `npm run dev`, `npm run build`, and `npm run check`. Push to `main` to publish to GitHub Pages. The base path is relative so the models load from `/secha-city/`.

For the source model export, run `tools/export_scene.py` from the SketchUp model workspace with its SketchUp SDK loader and the model path and output directory as arguments.

Story dialogue appears as text. The mission’s optional Pandan Walk audio compares open air and sheltered ambience.

### Credits

- [Character assets](public/CHARACTER-CREDITS.md)
- [Ruang Bayang artwork](public/ARTWORK-CREDITS.md)
- [Five-Door Hatchback by tevy](https://tevy.dev/models/hatchback), CC0 1.0.

- [Classic 1970s Coupé](https://tevy.dev/models/classic-coupe) and [Family Estate Car](https://tevy.dev/models/estate-car) by tevy, CC0 1.0. The build downloads and verifies a pinned version of each model and serves both from the site.
