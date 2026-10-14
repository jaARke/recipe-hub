# Brand assets

Where each brand file comes from. Derivatives are made once from their source and committed; regenerating one means repeating its procedure here, in a throwaway script outside the repository.

| File | What it is | Served |
| --- | --- | --- |
| `assets/brand/mascot-original.png` | The mascot's master, 1254 px RGBA PNG, as drawn | never; the source of every derivative |
| `assets/brand/mascot.svg` | A trace of the master by VTracer 0.6.12 (127 KB of bloated paths) | never; a vector source for a future simplified glyph |
| `src/components/brand/mascot-die-cut.png` | The mascot cropped, on a square, with a cream die-cut edge, 512 px RGBA PNG | through `next/image` in the `Mascot` component, which the optimizer resizes to WebP |
| `src/components/brand/wordmark-outline.ts` | "Barb’s Table" in Shantell Sans, outlined to one SVG path | inline in the `Wordmark` component and the share cards |
| `src/app/favicon.ico` | The mascot at 16, 32, and 48 px in one ICO, as provided with the artwork | browser tabs and bookmarks, through Next's `favicon` convention |
| `src/app/apple-icon.png` | The mascot on a cream square, 180 px opaque PNG | iPhone and iPad home screens, through Next's `apple-icon` convention |
| `public/icon-192.png`, `public/icon-512.png` | The mascot at 192 and 512 px, RGBA PNG, as provided with the artwork | the web manifest, purpose `any` |
| `public/icon-maskable-512.png` | The mascot inside the central 80% circle of a cream square, 512 px opaque PNG | the web manifest, purpose `maskable` |
| `assets/brand/mascot-card.png` | The die-cut at 320 px, RGBA PNG | the share cards, read at module scope |
| `public/email/lockup.png` | The header's lockup at 2x on a cream badge, 420 × 112 px opaque PNG | email headers, at 210 × 56 px |
| `assets/fonts/fraunces-soft-semibold.ttf` | Fraunces at the headings' weight, a static Latin subset | the share cards' recipe titles |
| `assets/fonts/hanken-grotesk-regular.ttf` | Hanken Grotesk Regular, a Latin subset | the share cards' body text |

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

## The icons

`favicon.ico`, `icon-192.png`, and `icon-512.png` are committed as provided with the artwork, in its `favicons/` set; the ICO holds 32-bit images at 16, 32, and 48 px. The set's 16 and 32 px PNGs are not kept, since the ICO holds both sizes, nor is its `apple-touch-icon.png`, which is transparent where iOS shows black.

The Apple and maskable icons are made from the master with `sharp` 0.35.5:

1. Clear the master's stray pixels and crop to the remaining pixels' bounds, as steps 1 and 2 of the die-cut do, without the square: 1188 × 1047 px.
2. The Apple icon: resize the crop with the Lanczos3 kernel to fit inside 140 × 140 px (140 × 123), composite it centered on a solid 180 × 180 px `#fdfaf3` (at 20, 28), remove the alpha channel, and write an RGB PNG at compression level 9.
3. The maskable icon: measure the farthest kept pixel's outer corner from the center of the crop (709.9 px), and resize the crop with Lanczos3 to fit inside a square of 1188 × 200 / 709.9 px, rounded down (334 px, so 334 × 294), which brings that pixel 200 px from the center, inside the 204.8 px radius of the central 80% circle that every mask keeps. Composite it centered on a solid 512 × 512 px `#fdfaf3` (at 89, 109), remove the alpha channel, and write an RGB PNG at compression level 9.

Both are opaque on the light theme's background: iOS fills transparency with black, and a maskable icon fills its whole square.

## The share card's mascot

The die-cut, resized with Lanczos3 to 320 × 320 px, twice the 160 px the site card draws it at (the recipe card draws it at 64 px), and written as an RGBA PNG at compression level 9. The cards draw it on the light theme's background, where its cream edge disappears.

## The email lockup

The header's `Lockup` at 2x, made with `sharp` 0.35.5: the die-cut resized with Lanczos3 to 64 × 64 px, and `wordmarkOutline` 40 px high (291.72 px wide) in `#241c17`, the light theme's foreground, which the header's wordmark takes, 16 px to the die-cut's right. They sit on a solid `#fdfaf3` badge with 24 px of padding, its width rounded up to a whole pixel and the content centered in it: 420 × 112 px, the die-cut at 24, 24 and the outline's top at 36. The outline is rasterized by `sharp` from an SVG the size of the badge, holding the path translated to its place and scaled by 40 / 860. Remove the alpha channel and write an RGB PNG at compression level 9.

An email shows it at 210 × 56 px (its `width` and `height`), with `siteName` as its alt text.

## The share-card fonts

Satori takes only static fonts, so the share cards read two committed Latin subsets rather than the variable fonts `next/font` serves the pages. Both are under the SIL Open Font License 1.1, with their license texts beside them.

- `fraunces-soft-semibold.ttf` is Fraunces as the headings set it, soft at weight 600. The source is Fraunces 1.000 by the Fraunces Project Authors: the variable font `ofl/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf` in the [google/fonts](https://github.com/google/fonts) repository, last changed there in commit `ac502d8` (the TTF's SHA-256 is `177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb`).
- `hanken-grotesk-regular.ttf` is Hanken Grotesk 3.014 by the Hanken Grotesk Project Authors: the static `fonts/ttf/HankenGrotesk-Regular.ttf` on the `master` branch of [marcologous/hanken-grotesk](https://github.com/marcologous/hanken-grotesk), last changed there in commit `74c8098` (the TTF's SHA-256 is `0a5c86e907f6d6cba528c3bfb0516b3f46c9524fa22f32f292109f25dc149b32`).

In a throwaway virtualenv with fontTools 4.66.1, Fraunces is instanced first, then both are subset with the same list:

```sh
fonttools varLib.instancer "Fraunces[SOFT,WONK,opsz,wght].ttf" SOFT=100 wght=600 opsz=72 WONK=0 -o instance.ttf
pyftsubset instance.ttf --unicodes="$LATIN" --layout-features='kern,liga' --no-hinting --output-file=fraunces-soft-semibold.ttf
pyftsubset HankenGrotesk-Regular.ttf --unicodes="$LATIN" --layout-features='kern,liga' --no-hinting --output-file=hanken-grotesk-regular.ttf
```

`LATIN` is `U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+20AC,U+2122,U+215B-215E`: printable ASCII and Latin-1, the typographic quotes and dashes (U+2019 among them, the curly apostrophe the copy uses), and the eighths, which Fraunces lacks. The Hanken Grotesk command reproduces the committed file byte for byte.
