import re

with open("src/renderer/components/SwipeReview.tsx", "r", encoding='utf-8') as f:
    text = f.read()

start_idx = text.rfind('return (')
main_jsx = text[start_idx:]

for tag in ['h1', 'span', 'button', 'img']:
    open_tags = len(re.findall(rf'<{tag}\b', main_jsx))
    close_tags = len(re.findall(rf'</{tag}>', main_jsx))
    if tag == 'img': close_tags = open_tags # img is self closing typically, or not closed
    print(f"<{tag}> count: {open_tags}, </{tag}> count: {close_tags}")
