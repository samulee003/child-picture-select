import re

def clean_jsx(text):
    # Remove strings
    text = re.sub(r"'[^']*'", "''", text)
    text = re.sub(r'"[^"]*"', '""', text)
    text = re.sub(r'`[^`]*`', '``', text)
    # Remove comments
    text = re.sub(r'//.*', '', text)
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    return text

with open("src/renderer/components/SwipeReview.tsx", "r", encoding='utf-8') as f:
    lines = f.readlines()

content = clean_jsx("".join(lines))
stack = []
for i, line in enumerate(content.split('\n')):
    for j, char in enumerate(line):
        if char in '{':
            stack.append(('{', i+1, j))
        elif char in '}':
            if stack and stack[-1][0] == '{':
                stack.pop()
            else:
                print(f"Error: unmatched }} at line {i+1}")
                exit(1)

if stack:
    print(f"Unmatched {{: {stack[-5:]}")
