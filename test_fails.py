import requests
import xml.etree.ElementTree as ET

tree = ET.parse('sitemap.xml')
urls = [loc.text for loc in tree.getroot().findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc') if '/project-use-case/' in loc.text]

headers = {'User-Agent': 'Mozilla/5.0'}

fails = 0
for url in urls[:20]:
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        fails += 1
        print(f"Failed: {url} - Status: {r.status_code}")

print(f"Total fails in first 20: {fails}")
