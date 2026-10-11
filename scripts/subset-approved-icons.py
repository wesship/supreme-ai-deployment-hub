"""Regenerate the approved icon subset with fonttools[woff] 4.61.1.

Run: python scripts/subset-approved-icons.py
The full source font remains available; CSS determines the included glyphs.
"""
import hashlib
import json
import re
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.woff2 import WOFF2FlavorData

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/approved-home/remixicon.woff2"
OUTPUT = ROOT / "public/approved-home/remixicon-approved.woff2"
MANIFEST = ROOT / "config/approved-icons-manifest.json"
css = (ROOT / "src/styles/approved-icons.css").read_text()
codes = sorted({int(value, 16) for value in re.findall(r'content:"\\([0-9a-fA-F]+)"', css)})
assert codes, "No approved icon codepoints found"

original = TTFont(SOURCE, recalcTimestamp=False)
font = TTFont(SOURCE, recalcTimestamp=False, recalcBBoxes=False)
assert set(codes).issubset(original.getBestCmap()), "CSS references missing source glyphs"
options = subset.Options()
options.glyph_names = True
options.hinting = True
options.notdef_outline = True
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.recalc_bounds = False
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=codes)
subsetter.subset(font)
font.flavor = "woff2"
# Preserve the source font's stored bearings/bounds. Recalculating its unusual
# icon bounds or applying the WOFF2 glyf transform shifts some glyphs sideways.
font.flavorData = WOFF2FlavorData(transformedTables=set())
font.save(OUTPUT)

# Verify the serialized result, including contours and layout metrics. Subsetting
# removes unused glyphs; it must not redraw or resize any approved icon.
result = TTFont(OUTPUT, recalcTimestamp=False)
old_glyphs, new_glyphs = original.getGlyphSet(), result.getGlyphSet()
for code in codes:
    old_name, new_name = original.getBestCmap()[code], result.getBestCmap()[code]
    old_pen, new_pen = RecordingPen(), RecordingPen()
    old_glyphs[old_name].draw(old_pen)
    new_glyphs[new_name].draw(new_pen)
    assert old_pen.value == new_pen.value, f"Outline changed for U+{code:04X}"
    assert original["hmtx"][old_name] == result["hmtx"][new_name], f"Metrics changed for U+{code:04X}"
for table, attributes in {"head": ["unitsPerEm"], "hhea": ["ascent", "descent", "lineGap"], "OS/2": ["sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent", "usWinDescent"]}.items():
    for attribute in attributes:
        assert getattr(original[table], attribute) == getattr(result[table], attribute), f"Font metric changed: {table}.{attribute}"
MANIFEST.write_text(json.dumps({
    "source": str(SOURCE.relative_to(ROOT)),
    "output": str(OUTPUT.relative_to(ROOT)),
    "unicodes": [f"{code:04x}" for code in codes],
    "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
}, indent=2) + "\n")
print(f"Verified {len(codes)} unchanged icons: {SOURCE.stat().st_size:,} → {OUTPUT.stat().st_size:,} bytes")
