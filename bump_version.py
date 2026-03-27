import json

files = ['package.json']
for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if 'version' in data:
            old_version = data['version']
            parts = old_version.split('.')
            parts[-1] = str(int(parts[-1]) + 1)
            new_version = '.'.join(parts)
            data['version'] = new_version

            with open(file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            print(f"Bumped version in {file} from {old_version} to {new_version}")
    except Exception as e:
        print(f"Error processing {file}: {e}")

