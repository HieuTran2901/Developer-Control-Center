import os

# Fix planner.rs
planner_path = r'E:\Github project\Developer-Control-Center\src-tauri\src\ai\planner.rs'
with open(planner_path, 'r', encoding='utf-8') as f:
    planner_content = f.read()

planner_content = planner_content.replace('validate_pipeline_semantics(&def)', 'crate::pipeline::domain::validate_pipeline_semantics(&def)')

with open(planner_path, 'w', encoding='utf-8') as f:
    f.write(planner_content)

# Fix renderer tests
renderer_path = r'E:\Github project\Developer-Control-Center\src-tauri\src\pipeline\renderer\tests.rs'
with open(renderer_path, 'r', encoding='utf-8') as f:
    renderer_content = f.read()

renderer_content = renderer_content.replace('GitlabCiRenderer', 'GitLabCiRenderer')

with open(renderer_path, 'w', encoding='utf-8') as f:
    f.write(renderer_content)

print("Fixed planner and renderer tests")
