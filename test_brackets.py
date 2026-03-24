def check_brackets(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    lines = content.split('\n')
    for i, line in enumerate(lines):
        for char in line:
            if char in '{[(':
                stack.append((char, i+1))
            elif char in '}])':
                if not stack:
                    print(f"Error: Unmatched {char} at line {i+1}")
                    return False
                top, _ = stack.pop()
                if (top == '{' and char != '}') or \
                   (top == '[' and char != ']') or \
                   (top == '(' and char != ')'):
                    print(f"Error: Mismatched {top} and {char} at line {i+1}")
                    return False

    if stack:
        print(f"Error: Unmatched opening brackets: {stack}")
        return False

    print("All brackets match!")
    return True

check_brackets('src/renderer/components/SwipeReview.tsx')
