from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image
import torch
from transformers import AutoModelForImageSegmentation
import numpy as np

app = Flask(__name__)
CORS(app)

# Load the model
print("Loading BRIA RMBG-1.4 model...")
model = AutoModelForImageSegmentation.from_pretrained("briaai/RMBG-1.4", trust_remote_code=True)
model.eval()
print("Model loaded successfully")

def process_image(image_data):
    try:
        # Convert base64 to PIL Image
        image = Image.open(io.BytesIO(base64.b64decode(image_data.split(',')[1])))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize image if too large
        max_size = 1024
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Preprocess image
        input_image = np.array(image)
        input_image = torch.from_numpy(input_image).permute(2, 0, 1).unsqueeze(0).float() / 255.0
        
        # Run inference
        with torch.no_grad():
            output = model(input_image)
        
        # Process output
        mask = output[0].squeeze().numpy()
        mask = (mask > 0.5).astype(np.uint8) * 255
        
        # Create transparent background
        rgba = np.concatenate([np.array(image), mask[..., None]], axis=2)
        result = Image.fromarray(rgba)
        
        # Convert to base64
        buffered = io.BytesIO()
        result.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode()
    
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        raise

@app.route('/remove-background', methods=['POST'])
def remove_background():
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        result = process_image(data['image'])
        return jsonify({'image': result})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True) 