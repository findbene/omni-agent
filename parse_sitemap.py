import xml.etree.ElementTree as ET
import sys

def parse_sitemap(file_path):
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        
        urls = []
        for loc in root.findall('.//ns:loc', namespace):
            if loc.text:
                urls.append(loc.text)
                
        # If no namespace
        if not urls:
            for loc in root.findall('.//loc'):
                if loc.text:
                    urls.append(loc.text)
        
        print(f"Total URLs found: {len(urls)}")
        
        project_urls = [u for u in urls if '/project-use-case/' in u or '/projects/' in u]
        print(f"Total project URLs found: {len(project_urls)}")
        
        print("Sample project URLs:")
        for u in project_urls[:20]:
            print(u)
            
    except Exception as e:
        print(f"Error parsing sitemap: {e}")

if __name__ == '__main__':
    parse_sitemap('sitemap.xml')
