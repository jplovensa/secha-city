# SECHA City · The House of Five Senses

[Play SECHA City](https://jplovensa.github.io/secha-city/)

## Central City

Open **Run Central City** to manage the interior district. The city starts with four vacant plots, one designer and 1,200 credits. Hire a builder or designer, choose a pavilion and shell material, assign an available worker, furnish the finished room and open it. Visitors generate revenue for the next sites. Each built pavilion can be explored at eye level. City operations are saved in the current browser.

## Story missions

1. **A Room for Two** — follow Josephine’s brief through the garden and carved wayang gallery, then design a room for Ibu in Rumah Teduh.
2. **The First Commission** — choose timber, a divider and lighting within 850 SECHA credits. Compare the finished package with the original room.
3. **Opening Night** — set the city lighting, add guests to the salon and open the studio.

Choose Walk the streets from the title screen or collect the city keys at the end. The district adds the Compact Home, Family Townhouse, Garden Villa and Kitchen and Bath Lab exteriors from the SketchUp master. Drive through three rings on the perimeter road to visit the landmarks.

Walk with **WASD**, drag to look, and press **E** to interact. Use **Approach** to walk up to a character automatically. In the car, **W/S** accelerate or reverse, **A/D** steer, and **E** exits. The directional buttons support touchscreens. The Cast menu places a character at a clear spot in the current room. Route returns to locations reached in the story. The guided edition offers the story and design tasks without 3D. Room design settings are saved in the browser.

## Development

Requires Node 22. Run `npm ci`, `npm run dev`, `npm run build`, and `npm run check`. Push to `main` to publish to GitHub Pages. The base path is relative so the models load from `/secha-city/`.

For the source model export, run `tools/export_scene.py` from the SketchUp model workspace with its SketchUp SDK loader and the model path and output directory as arguments.

### Dialogue audio

The game uses the browser’s built-in English speech for the director brief and character dialogue. The static game also reads `public/voices.json` for optional prerecorded HeyGen dialogue. When a licensed HeyGen API key is configured in the local environment, run `node tools/render-heygen.mjs` to render the English chapter dialogue, then commit the clips and manifest. The key is used only during the local render. The player uses the recorded clip when one exists and otherwise uses a browser voice. Written dialogue is always available.

### Credits

- [Character assets](public/CHARACTER-CREDITS.md)
- [Ruang Bayang artwork](public/ARTWORK-CREDITS.md)
- [Five-Door Hatchback by tevy](https://tevy.dev/models/hatchback), CC0 1.0.
