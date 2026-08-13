import re
path = r'E:\Github project\Developer-Control-Center\src-tauri\src\policy\tests.rs'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'(make_request\([^;]+Some\([^)]+\))\);',
    r'\1, None);',
    content
)

content = re.sub(
    r'(let req\d = PolicyEvaluationRequest \{\n\s*execution_id: [^\n]+,\n\s*pipeline_id: [^\n]+,)',
    r'\1\n            pipeline_version: None,',
    content
)

content = content.replace('assert!(store.is_approved(&id2));', 'assert_eq!(store.get_approval(&id2).unwrap().status, "REJECTED");')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
