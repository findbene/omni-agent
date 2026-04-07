import requests
from bs4 import BeautifulSoup
import json

url = 'https://www.projectpro.io/projects/data-science-projects'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'}

r = requests.get(url, headers=headers)
print("Status:", r.status_code)
if r.status_code == 200:
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # Check for __NEXT_DATA__
    next_data = soup.find('script', id='__NEXT_DATA__')
    if next_data:
        print("Found __NEXT_DATA__!")
        data = json.loads(next_data.text)
        print("Keys:", data.keys())
    else:
        print("No __NEXT_DATA__ found.")
        
    # Check for other JSON scripts
    for script in soup.find_all('script', type='application/json'):
        print("Found application/json script:", script.get('id', 'no-id'))
        if len(script.text) > 1000:
            print("Likely state injection script.")

    # Just print all script IDs for hints
    print("Script IDs:", [s.get('id') for s in soup.find_all('script') if s.get('id')])
else:
    print("Failed to fetch.")
