import os

path = r'E:\Github project\Developer-Control-Center\src-tauri\src\policy\tests.rs'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('// ==========================================')
start_idx = content.find('// Phase 7: Comprehensive Test Matrix', start_idx)

if start_idx != -1:
    # Find the line start of the Phase 7 comment
    cut_idx = content.rfind('\n', 0, start_idx)
    if cut_idx != -1:
        # cut out everything from the Phase 7 comment, and add a single closing brace
        content = content[:cut_idx] + "\n}\n"

        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Reverted dummy tests")
    else:
        print("Could not find start of line")
else:
    print("Could not find Phase 7 comment")
