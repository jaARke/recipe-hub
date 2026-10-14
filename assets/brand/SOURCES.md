# Brand assets

Where each brand file comes from. Derivatives are made once from their source and committed; regenerating one means repeating its procedure here, in a throwaway script outside the repository.

| File | What it is | Served |
| --- | --- | --- |
| `assets/brand/mascot-original.png` | The mascot's master, 1254 px RGBA PNG, as drawn | never; the source of every derivative |
| `assets/brand/mascot.svg` | A trace of the master by VTracer 0.6.12 (127 KB of bloated paths) | never; a vector source for a future simplified glyph |
| `src/components/brand/mascot-die-cut.png` | The mascot cropped, on a square, with a cream die-cut edge, 512 px RGBA PNG | through `next/image` in the `Mascot` component, which the optimizer resizes to WebP |
| `src/components/brand/wordmark-outline.ts` | "Barb’s Table" in Shantell Sans, outlined to one SVG path | inline in the `Wordmark` component |

## The die-cut mascot

Made with `sharp` 0.35.5, the repository's own dependency, at the master's scale:

1. Clear the master's stray pixels at alpha 1 or less (noise left by its background removal) to fully transparent.
2. Crop to the bounds of the remaining pixels (1188 × 1047 px at 38, 114) and center that on a transparent square 56 px wider than the artwork on each side (1300 px).
3. Make the edge: threshold the square's alpha at 128, Gaussian-blur it with sigma 20, set every value of 6 or more to 255 and the rest to 0 (about 40 px of growth, with round corners, filling the handle loops), blur that with sigma 1 for anti-aliasing, and use it as the alpha of a solid `#fdfaf3`, the light theme's background token in sRGB.
4. Composite the square artwork over the edge, resize to 512 × 512 with the Lanczos3 kernel, and write an RGBA PNG at compression level 9.

The cream edge keeps the ink outline visible on the dark theme, and matches the background on the light theme, so the one file serves both.

## The wordmark

The font is Shantell Sans 1.011 by ArrowType, under the SIL Open Font License 1.1: the variable font `ShantellSans[BNCE,INFM,SPAC,ital,wght].ttf` in the `Desktop` folder of `Shantell_Sans_1.011.zip` from the [1.011 release](https://github.com/arrowtype/shantell-sans/releases/tag/1.011) (the TTF's SHA-256 is `fbcd62f1c48f1d2cdf3f988f600c18137a4e42744370caf950c99d3b27567d25`). No Shantell Sans file is committed or loads at runtime.

The axes are weight 700, informality (`INFM`) 100, bounce (`BNCE`) 30, spacing (`SPAC`) 0, and italic 0. In a throwaway virtualenv with fontTools 4.66.1 and uharfbuzz 0.56.3:

```sh
fonttools varLib.instancer "ShantellSans[BNCE,INFM,SPAC,ital,wght].ttf" wght=700 INFM=100 BNCE=30 SPAC=0 ital=0 -o instance.ttf
python outline.py instance.ttf "Barb’s Table" > outline.json
```

`outline.py` shapes the text with HarfBuzz's default features (so `calt` picks the alternates that vary repeated letters, and `kern` spaces them), draws each glyph at its position with y flipped, moves the ink's bounds to 0 0, and rounds to whole font units (1000 per em):

```python
import json, sys
import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

font_path, text = sys.argv[1], sys.argv[2]
buffer = hb.Buffer()
buffer.add_str(text)
buffer.guess_segment_properties()
hb.shape(hb.Font(hb.Face(hb.Blob.from_file_path(font_path))), buffer)

font = TTFont(font_path)
glyphs, order = font.getGlyphSet(), font.getGlyphOrder()
placed, x = [], 0
for info, position in zip(buffer.glyph_infos, buffer.glyph_positions):
	placed.append((order[info.codepoint], x + position.x_offset, position.y_offset))
	x += position.x_advance

def draw(pen, dx=0, dy=0):
	for name, gx, gy in placed:
		glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, gx - dx, -gy - dy)))

bounds = BoundsPen(glyphs)
draw(bounds)
x0, y0, x1, y1 = (round(v) for v in bounds.bounds)
path = SVGPathPen(glyphs, ntos=lambda v: str(round(v)))
draw(path, x0, y0)
print(json.dumps({'width': x1 - x0, 'height': y1 - y0, 'd': path.getCommands()}))
```

The output's `width`, `height`, and `d` become `wordmarkOutline` in `wordmark-outline.ts`. The text is `siteName`, so a new name means outlining again.
