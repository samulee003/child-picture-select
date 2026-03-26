import re

for file_path in ["/app/src/renderer/components/AIAnalysisPanel.tsx", "/app/src/renderer/components/FaceAnalysisPreview.tsx"]:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # The error "An object literal cannot have multiple properties with the same name"
    # comes from my regex replacements not removing the original keys, but rather just injecting the string.
    # e.g., if I did `color: '#595c5e', fontWeight: 600,` but the original had `fontWeight: 700` already,
    # or I replaced `background: '...'` with `background: '...', boxShadow: '...', borderRadius: '...'`
    # and the original object also had a `borderRadius` key.

    # Let's fix the duplicates. The easiest way is to use a regex that matches the block and removes duplicates,
    # or just use a custom python function to parse and deduplicate properties in style={{...}} blocks.

    import ast

    def deduplicate_style_str(style_str):
        # Extremely naive: split by comma, extract key, keep last occurrence
        pairs = [p.strip() for p in style_str.split(',') if p.strip()]
        props = {}
        order = []
        for pair in pairs:
            if ':' not in pair:
                continue
            key = pair.split(':')[0].strip()
            if key not in props:
                order.append(key)
            props[key] = pair
        return ', '.join([props[k] for k in order])

    # Actually, finding the duplicates might be easier manually by inspecting the lines.
