import re
file_path = "/app/src/renderer/App.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# I see the syntax error! In `patch_app_sidebar.py`, I replaced the Right Main Content style, but I missed a closing brace.
# Look at the replacement:
# flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', background: 'transparent', borderRadius: '24px', margin: '12px 12px 12px 0', }

content = content.replace(
    "flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', background: 'transparent', borderRadius: '24px', margin: '12px 12px 12px 0', }",
    "flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column', background: 'transparent', borderRadius: '24px', margin: '12px 12px 12px 0', }}"
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed syntax error in App.tsx")
