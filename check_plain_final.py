# check_plain_final.py
import cv2
import numpy as np

def detect_human_with_non_plain_background_yolo(image_path, model, laplacian_threshold=50):
    """Detects non-plain backgrounds using YOLOv8 and Laplacian variance."""
    try:
        img = cv2.imread(image_path)
        if img is None:
            print(f"Error: Could not load image from {image_path}")
            return False

        results = model.predict(img)
        person_detected = False

        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    if result.names[int(box.cls[0])] == "person":
                        person_detected = True
                        break
                if person_detected:
                    break

        if not person_detected:
            print("No human detected.")
            return False

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        print(f"Laplacian variance: {laplacian_var}")

        return laplacian_var > laplacian_threshold

    except Exception as e:
        print(f"Error: {e}")
        return False
