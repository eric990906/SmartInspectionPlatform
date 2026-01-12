import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
from PIL import Image
import io
import requests
import base64
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuration ---
API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAFHkjmu2y1WDX7UwOo2CfFk77RwhxD2k4")

def get_valid_model():
    print("[INFO] Auto-detecting available Gemini models...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            models = response.json().get('models', [])
            # Prioritize Flash models
            for m in models:
                name = m['name'].replace('models/', '')
                if 'flash' in name.lower() and 'generateContent' in m.get('supportedGenerationMethods', []):
                    return name
            # Fallback to Pro
            for m in models:
                name = m['name'].replace('models/', '')
                if 'pro' in name.lower() and 'generateContent' in m.get('supportedGenerationMethods', []):
                    return name
    except Exception as e:
        print(f"[WARN] Model detection failed: {e}")
    
    return "gemini-1.5-flash" # Default fallback

MODEL_NAME = get_valid_model()
print(f"[INFO] Selected AI Model: {MODEL_NAME}")

@app.get("/")
def read_root():
    return {"status": "AI Server (Raw HTTP) Running"}

@app.post("/analyze")
async def analyze_defect(
    image: UploadFile = File(...),
    bim_info: str = Form(...),
    user_input: str = Form(...)  
):
    print(f"Analyzing with raw HTTP request to {MODEL_NAME}...")
    
    try:
        # 1. Process Image
        img_content = await image.read()
        pil_image = Image.open(io.BytesIO(img_content))
        pil_image.save("backend/debug_received_image.jpg")
        
        # Convert to Base64 (Web-Safe)
        encoded_image = base64.b64encode(img_content).decode("utf-8")

        # 2. Construct Prompt
        bim_data = json.loads(bim_info)
        context_text = f"Context: Element={bim_data.get('category')}, Note={user_input}"
        system_text = "Classify defect type (CRACK, LEAKAGE...) and extract metrics from Note. Return JSON: {defectType, metrics}."

        # 3. Call API via REST (No SDK)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={API_KEY}"
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": system_text + "\n" + context_text},
                    {"inline_data": {
                        "mime_type": "image/jpeg",
                        "data": encoded_image
                    }}
                ]
            }]
        }
        
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        
        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")

        # 4. Parse Response
        result = response.json()
        raw_text = result['candidates'][0]['content']['parts'][0]['text']
        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean_json)

        return {
            "defectType": parsed.get("defectType", "UNKNOWN"),
            "metrics": parsed.get("metrics", {}),
            "raw_response": clean_json
        }

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        with open("backend/api_v2_error.log", "w") as f:
            f.write(traceback.format_exc())
            
        return {
            "defectType": "ERROR", 
            "metrics": {},
            "error": str(e)
        }

if __name__ == "__main__":
    print("[INFO] CUSTOM SERVER STARTING (RAW HTTP MODE)...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
