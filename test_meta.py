import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

tree = ET.parse('sitemap.xml')
urls = [loc.text for loc in tree.getroot().findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc') if '/project-use-case/' in loc.text]

headers = {'User-Agent': 'Mozilla/5.0'}

for url in urls[5:10]:
    r = requests.get(url, headers=headers)
    soup = BeautifulSoup(r.text, 'html.parser')
    h1 = soup.find('h1')
    title = h1.text.strip() if h1 else (soup.title.text if soup.title else 'No Title')
    meta = soup.find('meta', attrs={'name': 'description'})
    desc = meta['content'] if meta else 'No Description'
    
    print(f"URL: {url}")
    print(f"Title: {title}")
    print(f"Desc: {desc}\n")
