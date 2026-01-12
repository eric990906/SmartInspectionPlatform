import requests
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAFHkjmu2y1WDX7UwOo2CfFk77RwhxD2k4")

print(f"Testing API Key: {API_KEY[:5]}...{API_KEY[-5:]}")

# Test List Models (GET)
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"

try:
    print(f"Checking models with key ending in ...{API_KEY[-5:]}")
    response = requests.get(url)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Available Models:")
        for m in data.get('models', []):
            if 'generateContent' in m.get('supportedGenerationMethods', []):
                print(f"- {m['name']}")
    else:
        print("Response Body:")
        print(response.text)

except Exception as e:
    print(f"Error: {e}")
