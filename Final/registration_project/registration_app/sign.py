import cv2
from PIL import Image
import os

def process_signature(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)

    # Define a threshold
    thresh = 110

    # Threshold the image
    img = cv2.threshold(img, thresh, 255, cv2.THRESH_BINARY)[1]

    # Convert numpy array to PIL Image
    img = Image.fromarray(img)
    img = img.convert("RGBA")

    pixdata = img.load()

    width, height = img.size
    for y in range(height):
        for x in range(width):
            if pixdata[x, y] == (255, 255, 255, 255):   # Make white background transparent
                pixdata[x, y] = (255, 255, 255, 0)

    # Save the processed image
    processed_image_path = os.path.splitext(image_path)[0] + "_processed.png"
    img.save(processed_image_path, "PNG")

    return processed_image_path