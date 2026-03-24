import re

def count_tags(text):
    open_tags = len(re.findall(r'<div', text))
    close_tags = len(re.findall(r'</div', text))
    print(f"<div> count: {open_tags}, </div> count: {close_tags}")
    return open_tags - close_tags

with open("src/renderer/components/SwipeReview.tsx", "r", encoding='utf-8') as f:
    text = f.read()

# Isolate the main return block
start_idx = text.rfind('return (')
main_jsx = text[start_idx:]

diff = count_tags(main_jsx)
print("Difference:", diff)
