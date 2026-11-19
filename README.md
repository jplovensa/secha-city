# SECHA City · The House of Five Senses

[Play Chapter 01](https://jplovensa.github.io/secha-city/) — A Room for Two.

Walk through Josephine’s reception and garden, select a timber finish, reveal four stages of the Ruang Bayang wayang wall, then design and hand over a room in Rumah Teduh. This chapter uses browser-ready geometry exported from the SECHA City SketchUp model. The live Rooted-inspired divider is generated from the selected spacing each time the player changes it.

Move with **WASD**, drag to look and press **E** to interact. On touchscreens, use the four direction buttons and drag the scene to look. Meet each character in reach or choose Approach to walk to the marker. Conversations unlock the next activity. The Route menu returns to locations you have reached. The guided edition offers the dialogue, activities and a divider preview when WebGL is unavailable. Sound is opt-in and the room draft stays in the browser.

## Development

Requires Node 22.

```sh
npm ci
npm run dev
npm run build
npm run check
```

Push to `main` to publish the Vite build with GitHub Actions. The relative Vite base and public model URLs work when the site lives under `/secha-city/`. For the source export, run `tools/export_scene.py` from the SketchUp model workspace with its SketchUp SDK loader and the model path and output directory as arguments.

For human model provenance and licences, see [the character credits](public/CHARACTER-CREDITS.md).

The carved panel uses profiles from the Tropenmuseum collection. See [the artwork credits](public/ARTWORK-CREDITS.md) for source objects, adaptations and licence. The city model, SECHA branding and design direction are from the SECHA City project.
