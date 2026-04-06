from bs4 import BeautifulSoup

with open('sample.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f, 'html.parser')

print("--- Topics ---")
for h2 in soup.find_all('h2'):
    if 'topic' in h2.text.lower() or 'skill' in h2.text.lower():
        print(f"Header: {h2.text}")
        # Next sibling is usually a div or ul
        sib = h2.find_next_sibling()
        if sib:
            print("Sibling text:", sib.text.strip())
            # Usually topics are tags
            for span in sib.find_all(['span', 'a', 'li']):
                print(" - Tag:", span.text.strip())
