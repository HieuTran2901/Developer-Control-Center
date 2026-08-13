import re

path = r'E:\Github project\Developer-Control-Center\src-tauri\src\policy\tests.rs'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix make_request calls with too many arguments
# We look for make_request(..., None); where it shouldn't have None
# Actually, the easiest way to fix it is to first revert the file and do it right, but I don't have git history for tests.rs!

lines = content.split('\n')
new_lines = []
for line in lines:
    if 'let req = make_request(' in line:
        # Check if the line ends with ', None);'
        if line.endswith(', None);'):
            # Count commas in this line to determine how many arguments there are.
            # make_request has 7 arguments: step_id, step_type, action, cmd, args, path, url
            # A call with 7 arguments has at least 6 commas (not counting inside vec![] or strings, but we can just split roughly)
            # Actually, let's just look at the compile error output and fix exactly what it complains about!
            pass
    
    # Simple fix: any make_request that ends with , None); but has 7 commas before it (meaning it has 8 arguments)
    if 'make_request' in line and line.endswith(', None);'):
        # Let's count top-level commas.
        # It's easier to just remove the ', None' if it's the 8th argument.
        # But wait, my script from before did this:
        # content = re.sub(r'(make_request\([^;]+Some\([^)]+\))\);', r'\1, None);', content)
        # So it changed `Some("url"));` to `Some("url"), None);`.
        
        # We can just change all `, None);` to `);` if they follow `Some(...)`? No, if it was missing the 7th argument, it originally ended with `Some(...)` (which was the 6th argument, `path`), so it NEEDED `, None` as the 7th argument!
        
        pass

# Let's use a regex to replace `make_request` correctly.
# If a line has 8 arguments, it means it already had `url` and we appended `, None`.
def fix_line(line):
    if 'let req = make_request(' not in line:
        return line
    
    # How many arguments does this line have?
    # We can split by ',' but beware of vec![]
    # All make_requests in tests.rs are single-line!
    # Format is usually: let req = make_request("step-x", "Type", Action, None, vec![], None, Some("url"));
    # Or: let req = make_request("step-x", "Type", Action, None, vec![], Some("path"));
    # Or: let req = make_request("step-x", "Type", Action, Some("cmd"), vec!["arg".into()], None, None);
    
    # If it ends with , None); let's just count commas outside of brackets/parentheses
    depth = 0
    commas = 0
    for char in line:
        if char in '([{': depth += 1
        elif char in ')]}': depth -= 1
        elif char == ',' and depth == 1: # depth 1 is inside make_request(...)
            commas += 1
            
    if commas > 6:
        # It has more than 7 arguments (since commas = args - 1). It has 8 arguments!
        # So we need to remove the last argument.
        if line.endswith(', None);'):
            return line[:-8] + ');'
    elif commas < 6:
        # It has less than 7 arguments (probably 6). We need to append `, None`!
        if line.endswith(');'):
            return line[:-2] + ', None);'
            
    return line

new_lines = [fix_line(l) for l in lines]

with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print('Fixed argument counts')
