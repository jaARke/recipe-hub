# Evaluation case sources

These are the inputs of the import evaluation set: public-domain or CC0 recipe scans, two federal recipe pages, and three synthetic pages built from the sample recipes. Each case's `expected.json` is its ground truth as an `ExtractedRecipe`. Everything was retrieved and its rights checked at the source on 2026-10-12.

## Scans

Each scan was re-encoded the way the recipe form encodes a member's scan (see Re-encoding below). Rights are quoted as each catalog's API returned them; the next section says what they mean.

| Case | Item | Source | Rights | Description |
| --- | --- | --- | --- | --- |
| canned-corn | "Canned Corn" item of ephemera, National Postal Museum 2009.2033.1.5.1, 1900s to 1950s | https://postalmuseum.si.edu/object/npm_2009.2033.1.5.1, image `NPM-2009_2033_1_5_1a` (https://ids.si.edu/ids/deliveryService?id=NPM-2009_2033_1_5_1a); the back, a postmark only, is left out | `"metadata_usage": {"access": "CC0"}`, and `"usage": {"access": "CC0"}` on the image (https://api.si.edu/openaccess/api/v1.0/content/edanmdm:npm_2009.2033.1.5.1) | Handwritten, cursive, ink on a tan card. 1 page, clean. |
| tomato-mince-meat | "Tomato Mince Meat" item of ephemera, National Postal Museum 2009.2033.1.175.9, 1900s to 1950s | https://postalmuseum.si.edu/object/npm_2009.2033.1.175.9, images `NPM-2009_2033_1_175_9_a` and `_b` (https://ids.si.edu/ids/deliveryService?id=NPM-2009_2033_1_175_9_a) | `"metadata_usage": {"access": "CC0"}`, and `"usage": {"access": "CC0"}` on both images (https://api.si.edu/openaccess/api/v1.0/content/edanmdm:npm_2009.2033.1.175.9) | Handwritten, cursive, faint pencil on blue-lined note paper. 2 pages: the recipe, then a note and the yield on the back. Ditto marks. |
| oatmeal-drop-cookies | "Oatmeal Drop Cookies Mrs. Schindler" item of ephemera, National Postal Museum 2009.2033.1.208.6 | https://postalmuseum.si.edu/object/npm_2009.2033.1.208.6, image `NPM-2009_2033_1_208_6_a`; the back, blank but for a dealer stamp, is left out | `"metadata_usage": {"access": "CC0"}`, and `"usage": {"access": "CC0"}` on the image (https://api.si.edu/openaccess/api/v1.0/content/edanmdm:npm_2009.2033.1.208.6) | Handwritten, cursive, ink on a browned card with an ink blot. 1 page. The ingredients run into one prose paragraph, and the source is in the title. |
| frosted-cream-cake | "Frosted Cream Cake" item of ephemera, National Postal Museum 2009.2033.1.63.2, 1900s to 1950s | https://postalmuseum.si.edu/object/npm_2009.2033.1.63.2, image `NPM-2009_2033_1_63_2_a`; the blank back is left out | `"metadata_usage": {"access": "CC0"}`, and `"usage": {"access": "CC0"}` on the image, in the Smithsonian Open Access metadata file https://smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan/npm/63.txt (the API's demo key was rate-limited) | Handwritten, cursive, faint pencil on lined paper with stains and a pin hole. 1 page. Ditto marks, a "Frosting" section, and an unfinished last line. |
| columbia-drop-cakes | Recipe for Columbia Drop Cakes, Bess W. Truman Papers, Subject Files, Recipes 1935 to 1945, Harry S. Truman Library, NARA 139308671 | https://catalog.archives.gov/id/139308671, images https://catalog.archives.gov/medialz/presidential-libraries/truman/hst-bwt/5700953/75815431-06-01.jpg and `-06-02.jpg` | `"useRestriction": {"status": "Unrestricted"}` (https://catalog.archives.gov/proxy/records/search?naId=139308671) | Handwritten, cursive, pencil on "United States Senate MEMORANDUM" letterhead, grayscale scan. 2 pages; the back's writing shows through the front. Source in a corner, ditto marks, yield at the end. |
| anise-cakes | Anise Cakes, images 2 and 3 of 16 in "Cookie Recipes From Bess W. Truman's Bridge Club", Bess W. Truman Papers, Subject Files, Recipes 1945 to 1953, NARA 139308757 | https://catalog.archives.gov/id/139308757, images https://catalog.archives.gov/medialz/presidential-libraries/truman/hst-bwt/5700953/75815433-04-02.jpg and `-04-03.jpg` | `"useRestriction": {"status": "Unrestricted"}` (https://catalog.archives.gov/proxy/records/search?naId=139308757) | Handwritten, cursive, ink on two cards, grayscale scan. 2 pages, the recipe continuing on the second card. Yield in parentheses under the title, a library stamp. |
| hot-fudge-sauce | Hot Fudge Sauce, image 16 of 16 in the same item, NARA 139308757 | https://catalog.archives.gov/id/139308757, image https://catalog.archives.gov/medialz/presidential-libraries/truman/hst-bwt/5700953/75815433-04-16.jpg | `"useRestriction": {"status": "Unrestricted"}` (https://catalog.archives.gov/proxy/records/search?naId=139308757) | Handwritten, mostly unjoined print-script, ink on paper, grayscale scan. 1 page. Fractions drawn between lines, a ditto mark, a library stamp, and a personal note at the foot. |
| pedernales-river-chili | Recipe Card for Pedernales River Chili, Lyndon B. Johnson Museum Collection, Gifts from the General Public, LBJ Library 1973.10802.1, NARA 6802684 | https://catalog.archives.gov/id/6802684, image https://catalog.archives.gov/medialive/84/8026/6802684/content/arcmedia/presidential-libraries/johnson/gallery/ChiliCard_a.jpg | `"useRestriction": {"status": "Unrestricted"}` (https://catalog.archives.gov/proxy/records/search?naId=6802684) | Printed in brown ink on a cream card under a drawing of the LBJ Ranch, from a low-resolution scan. 1 page. Two-column ingredients, an attribution line, and a second recipe, "Noche Specials", below. |
| chocolate-brownies | Chocolate Brownies Recipe, Records of the White House Correspondence Office, Samples of White House Handouts, Ronald Reagan Library, NARA 6731130 | https://catalog.archives.gov/id/6731130, image https://catalog.archives.gov/medialive/30/7311/6731130/content/arcmedia/presidential-libraries/reagan/gallery/Brownies_a.jpg | `"useRestriction": {"status": "Unrestricted"}` (https://catalog.archives.gov/proxy/records/search?naId=6731130) | Printed in blue on a white card with a White House vignette, a script title, and a printed signature. 1 page, clean. Two-column ingredients, the yield inside the last paragraph. |
| graham-rolls | Photograph of Graham Rolls and Recipe, Records of the U.S. Food Administration, Photographs of Food Conservation Activities, 4-G-30-21, NARA 34929584 | https://catalog.archives.gov/id/34929584, image 2 of 2, https://catalog.archives.gov/medialive/84/9295/34929584/content/stillpix/004-g/4-G-30-21_002.jpg; image 1, a photograph of the rolls, is left out | `"useRestriction": {"status": "Unrestricted"}` (https://catalog.archives.gov/proxy/records/search?naId=34929584) | Typewritten card, photographed in grayscale with a slight skew, 1917 to 1919. 1 page, clean. Weights in ounces and pounds, the yield beside the title. |
| one-crust-apple-pie | "One Crust Apple Pie" item of ephemera, National Postal Museum 2009.2033.1.171.2, credited in print to "Gentlewoman," December, 1917 | https://postalmuseum.si.edu/object/npm_2009.2033.1.171.2, image `NPM-2009_2033_1_171_2_a`; the back, advertisements, is left out | `"metadata_usage": {"access": "CC0"}`, and `"usage": {"access": "CC0"}` on the image, in https://smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan/npm/4c.txt; also published in the US before 1931 | Printed newspaper clipping, torn and browned. 1 page. Small type, with an adjacent "Shepherd's Pie" recipe, advertisements, and an illustration around it. |

## Pages

| Case | Page | Retrieved from | Rights | Description |
| --- | --- | --- | --- | --- |
| chicken-creole | https://www.nhlbi.nih.gov/health/heart-healthy-living/healthy-foods/healthy-eating-recipes/20-minute-chicken-creole | The live page, 56,721 bytes, SHA-256 `1cb39b78b4c3d1e0955d3ad3098d0be0dc2ead73a81ae443d35c87751a39b928`, saved unchanged except CRLF line endings converted to LF | NHLBI: "Unless noted otherwise, information posted on the NHLBI website within the nhlbi.nih.gov domain is in the public domain." and "Generally, copyrighted materials will include a copyright statement." (https://www.nhlbi.nih.gov/about/contact/trademark-branding-and-logo). The page carries no copyright statement. | A federal recipe page with no JSON-LD, microdata, or RDFa. Prep, cook, yield, source, and a tip appear only in the HTML, beside a nutrition panel. Scripts and analytics kept. |
| 5-a-day-salad | https://www.myplate.gov/recipes/5-day-salad | The Wayback Machine capture https://web.archive.org/web/20260109215209id_/https://www.myplate.gov/recipes/5-day-salad (the original bytes; myplate.gov failed TLS from this machine), 64,803 bytes, SHA-256 `dd175c9c8ad6cb45ac036385280e088ed9190995a749442f7f5a0789230df76e`, saved unchanged except CRLF line endings converted to LF and the two Akamai mPulse beacon scripts removed, since the capture's beacon configuration carried the crawler's IP address | A federal work: the page credits "US Department of Health and Human Services Centers for Disease Control and Prevention (CDC) 5 A Day for Better Health Program", published by USDA's MyPlate Kitchen, which asks: "Direct use of recipes, formatting, artwork, or compilation thereof from the MyPlate Kitchen are required to include proper attribution and do not serve as an endorsement by USDA of products or publications." (http://web.archive.org/web/20250201213334/https://www.myplate.gov/about-us). This row is that attribution. | A federal recipe page whose JSON-LD `@graph` Recipe has only the name, yield, description, author, image, nutrition, and rating, so ingredients and steps come from the HTML. Ratings and nutrition as noise. Scripts and analytics kept. |
| sunday-pot-roast | https://sunday-suppers.example/sunday-pot-roast/ | Written by hand from `sampleSundayPotRoast` | Synthetic, from the repository's own sample recipes | A blog post with a WP Recipe Maker card in the shape version 10.8.5 emits: the Recipe inside Yoast's `@graph`, `HowToSection` instruction groups, a flat `recipeIngredient` whose group headings appear only in the HTML, ingredient strings joined as amount, unit, and name (so a missing unit leaves two spaces), minutes-only durations (`PT200M`), `recipeYield` as an array, and notes only in the HTML. |
| peach-cobbler | https://orchard-table.example/peach-cobbler-with-biscuit-topping/ | Written by hand from `samplePeachCobbler` | Synthetic, from the repository's own sample recipes | A blog post with a Tasty Recipes card and no JSON-LD: `h4` ingredient group headings, scaled amounts in `data-amount` spans, and scale, print, and pin buttons as noise. |
| lemon-garlic-roast-chicken | https://weeknight-kitchen.example/recipes/lemon-garlic-roast-chicken | Written by hand from `sampleLemonGarlicRoastChicken` | Synthetic, from the repository's own sample recipes | A plain article whose JSON-LD is valid but odd: a top-level array, `@type` as an array, `recipeIngredient` and `recipeInstructions` as `ItemList`s, `recipeYield` as an array, the author as a string, hours in durations (`PT1H15M`), and HTML entities in strings. The notes appear only in the HTML. |

## Rights statements

- **NARA use restriction:** the National Archives defines the status `Unrestricted` as "Use if there are no copyright, donor, or other use restrictions on the archival materials." (https://www.archives.gov/research/catalog/lcdrg/authority-lists/use-restriction-status). Access is also `Unrestricted` on every record here.
- **Smithsonian Open Access:** `CC0` in a record's `metadata_usage` and an image's `usage` marks the Smithsonian's CC0 release (https://www.si.edu/openaccess). The Smithsonian's own pages refuse automated requests, so the statement is quoted from the API and the Open Access metadata files instead. CC0 covers copyright only.

## Expected drafts

Ground truth follows these rules:

- Text keeps the words, spelling, capitals, and abbreviations as written ("teas", "tbls", "c."), tidied only as the import prompt asks: titles in sentence case, where names keep their capitals ("Pedernales River chili"), amounts in numerals ("2 cups oatmeal" for "Two cups oatmeal"), and steps as sentences ("Cook until done and seal while hot."). Ditto marks are expanded to the words above them, as written ("1 level tablespoons nutmeg").
- Letterheads, archive stamps, postmarks, captions, closings ("With Best Wishes,"), page-turn marks ("over"), and field labels ("Tip:", "Recipe Source:", "note") are left out. A signature or "favorite recipe of" line is the source.
- Two-column ingredient lists are read down the left column, then the right. When an item holds more than one recipe, only the most prominent is kept.
- Handwritten and printed fractions are vulgar fractions ("1½"), as in the sample recipes; ASCII fractions stay only where the source is ASCII text. Em dashes in printed text are written as hyphens.
- Commas, periods, and dashes that only end an ingredient line are dropped; steps keep their punctuation. Steps keep the method text, including the ingredients named inside a method sentence; a sentence that only lists ingredients goes to the ingredient list alone.
- Minutes appear only where the original labels a prep, cook, or total time, never from a step ("Boil 20 min."). A yield appears only where stated, with its amount in a form the yield field reads, so "between 10 & 12" is "10 to 12" and "about 96" is "96".
- Notes are one paragraph, as the recipe page shows them. `reviewNotes` is empty.
- No word was illegible enough to need an `[illegible]` marker.

Where volunteer transcriptions exist (NARA catalog contributions), they were the starting point, and every line was checked against the image:

| Case | Transcription | Departures and judgment calls |
| --- | --- | --- |
| canned-corn | None | "Water enough", the last line, is an ingredient. |
| tomato-mince-meat | None | "15 or 20 min" (the 5's top stroke is detached, so it could be read as 13). The opening sentences name the tomatoes and apples inside the method, so they stay whole as steps and the ingredient list takes "1 pk green tomatoes" and "1 pk apples". Dittos repeat "level tablespoons" and "cups" as written, plurals included. The back's note is the notes, its yield sentence the yield, and "Grind everything." the last step. |
| oatmeal-drop-cookies | None | Source from the title. The opening sentence only lists ingredients, so the step starts at "Mix all together dry". |
| frosted-cream-cake | None | The card has no method, so there are no steps. The unfinished "butter -" is "butter". |
| columbia-drop-cakes | VolunteerA2LYoung, both pages | Kept "Beat in one at a time; 2 eggs" as written (the transcription has "Beat in 2 eggs, 1 at a time"), "soft." and "teas." with their periods, and "oven" (transcribed "over"); dropped "(sic)". The yield "Makes 30 - 2 in cookies" is 30 of "2 in cookies". |
| anise-cakes | arkmomof5, both cards | "1½ to 2 cup flour" as written (transcribed "cups"); "Sift." and "Add." keep their periods; the editorial "(underlined)" and "(degree symbol)" are dropped and the degree sign written. The yield "(about 50 one and a half inch cakes)" is 50 of "one and a half inch cakes". |
| hot-fudge-sauce | jessicah706 | "(15-oz)" as written (transcribed "(15 oz)"), "time" in lower case, and the stamp note dropped. The stacked fractions are read as ½ for the sugar line and ¼ for the salt line. The closing request is the notes. |
| pedernales-river-chili | ell136 and smithal | Both transcriptions drop "Salt to taste", "of" in "2 cups of hot water", and "a" in "Bring to a boil". The source is the name in the "favorite recipe of" line. "Noche Specials" is left out as the second recipe. |
| chocolate-brownies | sradoll1964 and EmmaRose | Column order follows sradoll1964; EmmaRose reads across the rows. "Makes about 96 brownies." is the yield and is left out of the step. The printed signature is the source. |
| graham-rolls | LBanka | The transcription merges "2 lbs. Graham Flour" and "1 Lb. Rye flour" into "2 lbs. Rye flour". "Nutter" is kept: the card's own typo. |
| one-crust-apple-pie | None | The apple pie is the most prominent of the two recipes: it comes first, and the catalog names the item for it. "(Save the wheat pie.)" is the description and the newspaper credit the source. The drop cap "SIFT" is "Sift"; "Peal" and the unmatched parenthesis are as printed. |
| chicken-creole | Not applicable | "Delicious served over rice." is the notes. Serving size and nutrition are left out. |
| 5-a-day-salad | Not applicable | Each ingredient's parenthetical note joins its line. The notes' two paragraphs are joined, and the "Learn more about" links left out. The source's line break and non-breaking space are single spaces. |
| sunday-pot-roast, peach-cobbler, lemon-garlic-roast-chicken | Not applicable | Equal to the sample recipe, field for field. |

## Coverage tags

`cases.json` tags each case: `handwritten` or `printed` (typeset, typed, or newsprint); `cursive` or `print-script` for the hand; `faint`; `stained`; `multi-page`; `two-column`; `ditto` (ditto marks to expand); `prose` (ingredients inside sentences); `distractors` (letterhead, stamps, illustrations, adjacent recipes, or advertisements); `json-ld`, `partial-json-ld`, or `no-json-ld`; and `synthetic`.

## Re-encoding

Scans are re-encoded the way `src/components/recipe-form/photo-processing.ts` encodes a member's scan: orientation applied, converted to sRGB from any embedded profile (the National Postal Museum images are Adobe RGB, the graham rolls card an Epson gray profile), transparency over white, scaled to at most 3072 px on the long edge and never enlarged, JPEG quality 90 with 4:2:0 chroma, and no metadata. Only the chili, brownie, and graham rolls images were large enough to scale. Pillow's Lanczos filter stands in for the browser's high-quality resize, and Huffman optimization, which is lossless, keeps the files small. Run with Python 3.12 and Pillow 12.3.0, as `python -I encode.py <original> <case>/page-<n>.jpg`:

```python
import io
import math
import sys

from PIL import Image, ImageCms, ImageOps

LONG_EDGE = 3072
QUALITY = 90

source, output = sys.argv[1], sys.argv[2]
with Image.open(source) as original:
    icc = original.info.get("icc_profile")
    image = ImageOps.exif_transpose(original)
if icc:
    image = ImageCms.profileToProfile(
        image,
        ImageCms.ImageCmsProfile(io.BytesIO(icc)),
        ImageCms.createProfile("sRGB"),
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
        outputMode="RGB",
    )
if image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info:
    rgba = image.convert("RGBA")
    image = Image.new("RGB", rgba.size, "white")
    image.paste(rgba, mask=rgba.getchannel("A"))
image = image.convert("RGB")
scale = min(1, LONG_EDGE / max(image.size))
# Math.round, as normalizedPhotoSize uses, rounds halves up.
size = (max(1, math.floor(image.width * scale + 0.5)), max(1, math.floor(image.height * scale + 0.5)))
if size != image.size:
    image = image.resize(size, Image.Resampling.LANCZOS)
image.save(output, "JPEG", quality=QUALITY, subsampling="4:2:0", optimize=True)
```

Every output holds only the JFIF header, quantization and Huffman tables, the frame, and the scan: no EXIF, XMP, IPTC, ICC profile, or comment.

## Copies

The design reference's stand-in scans, `src/components/design-reference/stand-in-scans/anise-cakes-page-1.jpg` and `anise-cakes-page-2.jpg`, are the anise-cakes pages scaled with sharp 0.35.5 to at most 1600 px on the long edge and never enlarged, then saved as JPEG at quality 82 with mozjpeg, so `/design`'s import review shows real pages without sign-in.
