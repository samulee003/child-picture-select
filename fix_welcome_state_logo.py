import re

file_path = "/app/src/renderer/components/WelcomeState.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add import statement for logo if it doesn't exist
if "import logoImg from" not in content:
    # We found /app/src/renderer/public/logo.png earlier
    import_stmt = "import logoImg from '../public/logo.png';\n"
    content = content.replace("import { theme } from '../styles/theme';", "import { theme } from '../styles/theme';\n" + import_stmt)

# Replace src="logo.png" with src={logoImg}
content = content.replace('src="logo.png"', 'src={logoImg}')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated WelcomeState.tsx logo path.")
