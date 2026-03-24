with open("src/renderer/components/SwipeReview.tsx", "r") as f:
    text = f.read()

text = text.replace("{current.path.split(/[/\]/).pop()}", "{current.path.split(/[\\\\/]/).pop()}")

with open("src/renderer/components/SwipeReview.tsx", "w") as f:
    f.write(text)
