"""Split the Hook Studio artifact into Next.js pieces, with generic prompts."""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()

# --- sections ---
styles = re.findall(r"<style>(.*?)</style>", s, re.S)
app_css = styles[1]
fonts = re.findall(r'<link rel="stylesheet" href="([^"]+)">', s)
m0, m1 = s.find('<div class="wrap">'), s.find("<script>")
markup = s[m0:m1].strip()
js = s[m1 + len("<script>"): s.rfind("</script>")]

def rep(text, old, new, count=1):
    n = text.count(old)
    if n != count:
        raise SystemExit(f"expected {count} of {old[:60]!r}, found {n}")
    return text.replace(old, new)

# --- markup copy that only made sense inside a Claude chat ---
markup = rep(markup, "The video stays in your browser. When you are done, attach the same file in the chat with the brief.",
             "The video stays in your browser. It is never uploaded.")
markup = rep(markup, "Claude can't write options from this page right now. Copy this request into the chat instead, or type your own below.",
             "Claude can't write options right now. Try again in a moment, or type your own below.")

# --- generic prompts ---
js = rep(js, js[js.find("const HOOKLORE=`"): js.find("`;", js.find("const HOOKLORE=`")) + 2],
 "const HOOKLORE=`What tends to work best for short-form hooks: 1) a reaction line to something visually odd or surprising on screen, like \"Never seen anyone peel an egg like that\". 2) a named, specific payoff with a number or timing, like \"Book this 7 days before you land\". 3) a comparison or versus line, like \"dancer vs never danced a day in her life\". Opening lines of 8 to 14 words usually beat 1 to 3 words. Weakest: flat statements, generic \"rate this /10\" asks and \"who can relate\" lines. Leave an open loop: hint at what happens or what to do without giving the answer. Across the 10, write about 4 reaction lines, 3 named payoffs, 2 comparisons and 1 free choice, each still obeying the length rules below.`;")
js = rep(js, "for an Instagram Trial Reel for Xixi (XixiPlease).", "for an Instagram Reel or TikTok by a content creator.")
js = rep(js, "Hooks she rejected", "Hooks the creator rejected")
js = rep(js, '"Her feedback: "', '"The creator\'s feedback: "')
js = rep(js, "versions for Xixi. Current versions:", "versions for a content creator. Current versions:")
js = rep(js, "Her favourite looks:", "The creator's kept looks:")
js = rep(js, "(F29 is her favourite)", "(F29 is the default kept font)")
js = rep(js, "Her request${", "The creator's request${")
js = rep(js, "Change nothing she did not ask for. If she names a version", "Change nothing the creator did not ask for. If they name a version")
js = rep(js, "captions for Xixi (XixiPlease) Trial Reels.", "captions for a content creator's Reels.")
js = rep(js, "These still need a hand from Claude in the chat.", "Coming soon.")
js = rep(js, "Claude could not write all of these from this page, so", "Claude could not write all of these right now, so")
markup = rep(markup, "how to place your Taobao orders before landing in China", "how to book the helicopter ride for less")
leftover = re.findall(r"Xixi|\bher own\b|\bshe\b|\bHer\b", js + markup)
if leftover:
    raise SystemExit(f"creator-specific text left: {leftover}")

# --- runtime shim: replaces Claude's artifact runtime (claude.use) ---
shim = open(sys.argv[3], encoding="utf-8").read()

open(f"{out}/public/hook-studio.js", "w", encoding="utf-8").write(shim + "\n" + js)
open(f"{out}/app/studio/studio.css", "w", encoding="utf-8").write(app_css.strip() + "\n")
open(f"{out}/app/studio/markup.ts", "w", encoding="utf-8").write(
    "// Generated from the original Hook Studio page. Edit with care: hook-studio.js looks up these ids.\n"
    f"export const STUDIO_MARKUP = {json.dumps(markup)};\n")
open(f"{out}/app/fonts.ts", "w", encoding="utf-8").write(f"export const FONT_SHEETS = {json.dumps(fonts, indent=2)};\n")
print("ok", len(markup), len(js), len(app_css), len(fonts))
