import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
from PIL import Image
import io
import io
from google import genai
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
# TODO: User must set this in .env or replacing it here
API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAFHkjmu2y1WDX7UwOo2CfFk77RwhxD2k4")
# genai.configure() is NOT needed for new Client-based SDK

# Select Model
MODEL_NAME = "gemini-1.5-flash-001" 

@app.get("/")
def read_root():
    return {"status": f"AI Server Running (Model: {MODEL_NAME})"}

@app.post("/analyze")
async def analyze_defect(
    image: UploadFile = File(...),
    bim_info: str = Form(...),
    user_input: str = Form(...)  
):
    print(f"Analyzing with {MODEL_NAME}...")
    
    try:
        # 1. Process Image
        img_content = await image.read()
        print(f"[DEBUG] Received Image: {len(img_content)} bytes")
        pil_image = Image.open(io.BytesIO(img_content))
        print(f"[DEBUG] Image Format: {pil_image.format}, Size: {pil_image.size}")
        
        # SAVE IMAGE FOR VERIFICATION
        pil_image.save("backend/debug_received_image.jpg")
        print("[DEBUG] Saved image to backend/debug_received_image.jpg")

        # 2. Construct Prompt
        bim_data = json.loads(bim_info)
        context = f"""
        Context (BIM Data):
        - Element ID: {bim_data.get('element_id', 'Unknown')}
        - Category: {bim_data.get('category', 'Unknown')}
        - Material: {bim_data.get('static_info', {}).get('material', 'Unknown')}
        
        User Note: "{user_input}"
        """
        
        system_instruction = """
        You are an expert civil engineer AI. 
        
        **Task 1 (Visual Classification):**
        Analyze the **IMAGE** and BIM context to classify the defect type (CRACK, LEAKAGE, PEELING, EFFLORESCENCE, etc.).
        
        **Task 2 (Text Parsing):**
        Analyze the **USER NOTE** to extract metrics matching the classified type.
        *   **CRITICAL RULE:** Extract metrics **ONLY** from the User Note.
        *   **If the note is empty or has no numbers:** Return `null` or `0` for metrics. **DO NOT** estimate dimensions from the image.
        
        Return ONLY valid JSON with this structure:
        {
            "defectType": "CRACK", 
            "metrics": { "width": 0.0, "length": 0.0 }
        }
        """

        # 3. Generate Content (New SDK)
        # Initialize Client
        client = genai.Client(api_key=API_KEY)
        
        # Prepare content parts
        # For new SDK, we need to be specific about parts
        # Prompt + Context
        text_part = system_instruction + "\n" + context
        
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                text_part,
                pil_image
            ]
        )
        
        # 4. Parse Response
        raw_text = response.text
        # Clean up code blocks if present
        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        parsed_result = json.loads(clean_json)
        
        return {
            "defectType": parsed_result.get("defectType", "UNKNOWN"),
            "metrics": parsed_result.get("metrics", {}),
            "raw_response": clean_json
        }

    except Exception as e:
        error_msg = f"Error calling {MODEL_NAME}: {e}"
        print(error_msg)
        import traceback
        with open("backend/api_error.log", "w") as f:
            f.write(traceback.format_exc())
            
        # Fallback for demo if API fails
        return {
            "defectType": "ERROR", 
            "metrics": {},
            "error": str(e)
        }

if __name__ == "__main__":
    try:
        print("[INFO] Starting Server...")
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except Exception as e:
        import traceback
        with open("backend/error.log", "w") as f:
            f.write(traceback.format_exc())
        print("CRITICAL ERROR:", e)
