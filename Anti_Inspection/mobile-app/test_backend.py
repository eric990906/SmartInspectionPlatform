import requests

url = "http://localhost:8000/analyze"
image_path = "public/crack_sample.jpg"  # Executing from mobile-app root

print(f"Testing connection to {url}...")

try:
    # 1. Load Image
    with open(image_path, "rb") as img:
        files = {"image": img}
        data = {
            "user_input": "0.3/500",
            "bim_info": '{"element_id": "TEST-1", "category": "Column"}'
        }
        
        # 2. Send Request
        print("Sending request...")
        response = requests.post(url, files=files, data=data)
        
        # 3. Print Result
        print(f"Status Code: {response.status_code}")
        print("Response Body:")
        print(response.text)

except FileNotFoundError:
    print(f"Error: Could not find test image at {image_path}")
except requests.exceptions.ConnectionError:
    print("Error: Could not connect to server. Is it running on port 8000?")
except Exception as e:
    print(f"An error occurred: {e}")
