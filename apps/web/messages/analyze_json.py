import json

def analyze_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Root keys in {filepath}:")
    for key in data.keys():
        print(f"- {key}")
    
    # Check if 'team' is inside 'Landing' or 'Common'
    if 'Landing' in data and 'team' in data['Landing']:
        print("Found 'team' inside 'Landing'")
    if 'Common' in data and 'team' in data['Common']:
        print("Found 'team' inside 'Common'")
    if 'team' in data:
        print("Found 'team' at root")

analyze_json('d:/tampalets/saas-one/apps/web/messages/en.json')
analyze_json('d:/tampalets/saas-one/apps/web/messages/ar.json')
