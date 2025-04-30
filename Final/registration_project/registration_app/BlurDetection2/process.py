import sys
import logging
import pathlib
import cv2
import numpy as np
from .blur_detection import estimate_blur, fix_image_size, pretty_blur_map

def process_image(image_path, threshold=100.0, fix_size=True):
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Failed to read image")
  
    if fix_size:
        image = fix_image_size(image)

    blur_map, score, blurry = estimate_blur(image, threshold=threshold)
    result = {"score": score, "blurry": blurry}
    return result