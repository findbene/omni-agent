import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import json
import concurrent.futures

def fetch_project(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Title
        h1 = soup.find('h1')
        title = h1.text.strip().replace('\n', ' ') if h1 else (soup.title.text.replace('\n', ' ') if soup.title else 'Unknown Title')
        
        # Description
        meta = soup.find('meta', attrs={'name': 'description'})
        desc = meta['content'].replace('\n', ' ') if meta else 'No description available.'
        
        # Skills (heuristic)
        skills = []
        for header in soup.find_all(['h2', 'h3']):
            text = header.text.lower()
            if 'tech stack' in text or 'tool' in text or 'technologies' in text:
                sib = header.find_next_sibling()
                if sib:
                    for tag in sib.find_all('li'):
                        s = tag.text.strip().replace('\n', ' ')
                        if s and len(s) < 50:
                            skills.append(s)
        
        return {
            'url': url,
            'title': title,
            'description': desc,
            'skills': ', '.join(skills) if skills else 'See description'
        }
    except Exception as e:
        return None

def main():
    print("Parsing sitemap...")
    tree = ET.parse('sitemap.xml')
    urls = [loc.text for loc in tree.getroot().findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc') if '/project-use-case/' in loc.text]
    
    # Remove duplicates
    urls = list(set(urls))
    print(f"Found {len(urls)} project URLs. Starting extraction...")
    
    results = []
    
    # Use ThreadPoolExecutor for concurrent requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_project, url): url for url in urls}
        count = 0
        for future in concurrent.futures.as_completed(futures):
            count += 1
            if count % 25 == 0:
                print(f"Processed {count}/{len(urls)}")
            res = future.result()
            if res:
                results.append(res)
                
    print(f"Successfully extracted {len(results)} projects.")
    
    # Sort results
    results.sort(key=lambda x: x['title'])
    
    # Save to JSON
    with open('projectpro_projects.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
        
    print("Saved results to projectpro_projects.json")

if __name__ == '__main__':
    main()
