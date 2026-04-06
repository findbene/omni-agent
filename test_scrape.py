from bs4 import BeautifulSoup
import json

with open('sample.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

scripts = soup.find_all('script', type='application/ld+json')
for s in scripts:
    try:
        data = json.loads(s.string)
        print(json.dumps(data, indent=2)[:500])
        print("...")
    except Exception as e:
        pass
