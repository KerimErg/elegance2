import base64, json, sys, os, io, urllib.request, concurrent.futures as cf
OUT = sys.argv[1]
STYLE = ("Editorial photograph, shot on 35mm film camera, natural warm window light with soft shadows, "
         "muted earthy palette (warm browns, cream, deep black, touch of brass), shallow depth of field, subtle film grain, "
         "high-end Parisian hair salon aesthetic, realistic skin texture, no text, no logo, no watermark.")
P = {
 "hero-coupe":   ("16:9", "A hairstylist cutting a woman's long brown hair in an elegant dark wood and brass hair salon, light through venetian blinds casting stripes on the wall, woman seen in three-quarter profile on the right side of the frame, calm mood, left third of the image darker and empty for text."),
 "hero-couleur": ("16:9", "Close editorial portrait of a woman with fresh honey balayage hair, warm golden sunlight from a tall window catching the hair, she sits on the right side of the frame in a refined salon, left side dark and empty for text."),
 "hero-barbier": ("16:9", "A barber trimming a man's beard with a straight razor in a dark moody barbershop, leather chair, warm tungsten lamps, man on the right side of the frame, left side dark and empty for text."),
 "studio":       ("16:9", "Wide interior of a luxurious hair salon at golden hour: curved velvet chairs, large round mirrors with brass frames, marble floor, warm pendant lights, tall windows, empty, no people."),
 "salon":        ("16:9", "Interior of an elegant hair salon in an old Strasbourg building at dusk, styling stations with round mirrors, warm lamps glowing, dark green and wood tones, empty, cinematic."),
 "look-balayage":        ("4:3", "Back view of a woman's long wavy hair with a soft honey blonde balayage, glossy, styled in a salon, warm light, centered."),
 "look-balayage-detail": ("9:16", "Vertical close-up of a woman touching her honey balayage waves, profile, warm window light, salon background blurred."),
 "look-degrade":         ("4:3", "Side profile of a man with a fresh low skin fade haircut and a sharp groomed beard, dark barbershop background, warm light."),
 "look-degrade-detail":  ("9:16", "Vertical close-up of a barber's hands shaping a beard line with a straight razor, hot towel on shoulder, dark warm tones."),
 "look-chignon":         ("4:3", "Elegant low bridal chignon with soft loose strands, seen from behind, woman wearing a black evening dress, warm candle-like light."),
 "look-chignon-detail":  ("9:16", "Vertical shot of a hairstylist pinning a woman's elegant updo, hands in frame, warm light, salon mirror reflections."),
 "team-sarah":  ("4:5", "Portrait of a female hair colorist in her thirties, dark clothing, standing in a warm-lit salon, confident gentle smile, waist up."),
 "team-karim":  ("4:5", "Portrait of a male barber in his thirties with a neat beard, black shirt, arms crossed, dark barbershop background, warm light, waist up."),
 "team-lea":    ("4:5", "Portrait of a young female hairstylist with a short bob, black top, holding scissors, warm salon background, waist up."),
 "team-thomas": ("4:5", "Portrait of a male hairstylist in his forties with salt and pepper hair, dark linen shirt, warm salon background, waist up."),
}
URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent"
MODEL = os.environ.get("MODEL", "gemini-2.5-flash-image")
def gen(name):
    ar, prompt = P[name]
    body = {"contents": [{"parts": [{"text": prompt + " " + STYLE}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": ar}}}
    req = urllib.request.Request(URL % MODEL, data=json.dumps(body).encode(),
          headers={"Content-Type": "application/json", "x-goog-api-key": "placeholder"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        return name, f"HTTP {e.code}: {e.read()[:300]!r}"
    for part in r["candidates"][0]["content"]["parts"]:
        if "inlineData" in part:
            raw = base64.b64decode(part["inlineData"]["data"])
            from PIL import Image
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            im.thumbnail((1920, 1920))
            im.save(f"{OUT}/{name}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
            return name, "ok %dx%d" % im.size
    return name, "pas d'image: " + json.dumps(r)[:300]
names = sys.argv[2:] or list(P)
with cf.ThreadPoolExecutor(4) as ex:
    for n, res in ex.map(gen, names): print(n, res, flush=True)
