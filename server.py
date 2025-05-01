from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import os
import numpy as np
import torch
from PIL import Image
from transformers import AutoModelForImageSegmentation
from ultralytics import YOLO

from sign import process_signature
from check_plain_final import detect_human_with_non_plain_background_yolo
from face_orientation import detect_frontal_face  # 👈 Added here

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# =================== Load RMBG-1.4 =================== #
print("Loading BRIA RMBG-1.4 model...")
rmbg_model = AutoModelForImageSegmentation.from_pretrained("briaai/RMBG-1.4", trust_remote_code=True)
rmbg_model.eval()
print("BRIA RMBG model loaded successfully.")

# =================== Load YOLOv8 Pose Model =================== #
print("Loading YOLOv8 model...")
yolo_model = YOLO(r"D:\prateek\face check project\yolov8x-pose-p6.pt")
print("YOLO model loaded successfully.")


# =================== Remove Image Background =================== #
def process_image(image_data):
    try:
        if "," in image_data:
            image_data = image_data.split(',')[1]
        image = Image.open(io.BytesIO(base64.b64decode(image_data)))

        if image.mode != 'RGB':
            image = image.convert('RGB')

        max_size = 1024
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            image = image.resize((int(image.size[0]*ratio), int(image.size[1]*ratio)), Image.Resampling.LANCZOS)

        input_image = np.array(image)
        input_image = torch.from_numpy(input_image).permute(2, 0, 1).unsqueeze(0).float() / 255.0

        with torch.no_grad():
            output = rmbg_model(input_image)

        mask = output[0].squeeze().numpy()
        mask = (mask > 0.5).astype(np.uint8) * 255

        rgba = np.concatenate([np.array(image), mask[..., None]], axis=2)
        result = Image.fromarray(rgba)

        buffered = io.BytesIO()
        result.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode(), None

    except Exception as e:
        return None, f"Error processing image: {str(e)}"


@app.route('/remove-background', methods=['POST'])
def remove_background():
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        result, error = process_image(data['image'])
        if error:
            return jsonify({'error': error}), 400

        return jsonify({'image': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =================== Signature Processing =================== #
def save_and_process_signature(image_data):
    try:
        if "," in image_data:
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)

        image_path = os.path.join(UPLOAD_FOLDER, "signature.png")
        with open(image_path, "wb") as f:
            f.write(image_bytes)

        processed_image_path = process_signature(image_path)

        with open(processed_image_path, "rb") as f:
            processed_base64 = base64.b64encode(f.read()).decode("utf-8")

        return {"status": "success", "image": processed_base64}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.route('/process-signature', methods=['POST'])
def process_signature_route():
    try:
        data = request.get_json()
        if 'image' not in data:
            return jsonify({"error": "No image data received"}), 400

        result = save_and_process_signature(data['image'])
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =================== Check Background with YOLO + Laplacian =================== #
@app.route('/check-background', methods=['POST'])
def check_background():
    try:
        file = request.files.get('photo')
        if not file:
            return jsonify({'success': False, 'result': 'No photo uploaded'}), 400

        filename = file.filename or "uploaded_image.jpg"
        image_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(image_path)

        is_non_plain = detect_human_with_non_plain_background_yolo(image_path, yolo_model)
        result_msg = "❌ Non-plain background detected." if is_non_plain else "✅ Plain background detected."

        return jsonify({'success': True, 'result': result_msg})
    except Exception as e:
        return jsonify({'success': False, 'error': f"Server error: {str(e)}"}), 500


# =================== Check Face Orientation =================== #
@app.route('/check-frontal-face', methods=['POST'])
def check_frontal_face():
    try:
        file = request.files.get('photo')
        if not file:
            return jsonify({'success': False, 'result': 'No photo uploaded'}), 400

        filename = file.filename or "uploaded_photo.jpg"
        image_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(image_path)

        result = detect_frontal_face(image_path)
        return jsonify({'success': True, 'result': result})
    except Exception as e:
        return jsonify({'success': False, 'error': f"Error checking face orientation: {str(e)}"}), 500


# =================== Run Server =================== #
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
