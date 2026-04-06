from bs4 import BeautifulSoup
import json

with open('sample.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

print("--- Classes containing 'skill', 'tech', 'tool', 'tag' ---")
for el in soup.find_all(class_=lambda x: x and any(w in str(x).lower() for w in ['skill', 'tech', 'tool', 'tag', 'badge'])):
    # if it has text and it's short
    text = el.text.strip()
    if text and len(text) < 30 and len(el.find_all()) == 0:
        print(f"{el.get('class')}: {text}")
