from facenet_pytorch import MTCNN
from PIL import Image
import numpy as np
import torch
import os

# Set device and load model

device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
print(f'Running on device: {device}')

mtcnn = MTCNN(image_size=160, margin=0, min_face_size=20,
              thresholds=[0.6, 0.7, 0.7], factor=0.709,
              post_process=True, device=device)

def np_angle(a, b, c):
    ba = a - b
    bc = c - b
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    return np.degrees(np.arccos(cosine_angle))

def detect_frontal_face(image_path):
    try:
        image = Image.open(image_path)
        if image.mode != 'RGB':
            image = image.convert('RGB')

        _, _, landmarks = mtcnn.detect(image, landmarks=True)

        if landmarks is None or len(landmarks) == 0:
            return 'Face is not frontal: No face detected'

        for landmark in landmarks:
            left_eye, right_eye, nose = landmark[0], landmark[1], landmark[2]
            angle_r = np_angle(left_eye, right_eye, nose)
            angle_l = np_angle(right_eye, left_eye, nose)

            if 35 <= angle_r <= 56 and 35 <= angle_l <= 57:
                return 'Face is frontal'
            else:
                return f"Face is not frontal: angles -> left: {round(angle_l, 2)}, right: {round(angle_r, 2)}"

        return 'Face is not frontal: No valid face angles'

    except Exception as e:
        return f"Face is not frontal: Error - {str(e)}"

