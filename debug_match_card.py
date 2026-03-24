with open("src/renderer/components/MatchResultCard.tsx", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("export function")
if idx == -1:
    print("Could not find export function in MatchResultCard.tsx")
else:
    print(text[idx-50:idx+200])
