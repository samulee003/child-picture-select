import re

for file_path in ["/app/src/renderer/components/WelcomeState.tsx", "/app/src/renderer/App.tsx"]:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove the import line
    content = re.sub(r"import logoImg from '\.\.?/public/logo\.png';\n", "", content)

    # Replace the src attribute back to string
    content = content.replace("src={logoImg}", 'src="/logo.png"')
    content = content.replace('src="logo.png"', 'src="/logo.png"')

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Reverted logoImg imports and updated src path.")
