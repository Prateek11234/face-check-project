from facenet_pytorch import MTCNN
from PIL import Image
import numpy as np
import torch
import json

device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
mtcnn = MTCNN(image_size=160, margin=0, min_face_size=20, thresholds=[0.6, 0.7, 0.7], factor=0.709, post_process=True, device=device)

def npAngle(a, b, c):
    ba = a - b
    bc = c - b
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(cosine_angle)
    return np.degrees(angle)

def predFacePose(image):
    bbox_, prob_, landmarks_ = mtcnn.detect(image, landmarks=True)
    angle_R_List = []
    angle_L_List = []
    predLabelList = []

    for bbox, landmarks, prob in zip(bbox_, landmarks_, prob_):
        if bbox is not None and prob > 0.9:
            angR = npAngle(landmarks[0], landmarks[1], landmarks[2])
            angL = npAngle(landmarks[1], landmarks[0], landmarks[2])
            angle_R_List.append(angR)
            angle_L_List.append(angL)
            if ((int(angR) in range(35, 57)) and (int(angL) in range(35, 58))):
                predLabel = 'Frontal'
                predLabelList.append(predLabel)
            else:
                if angR < angL:
                    predLabel = 'Left Profile'
                else:
                    predLabel = 'Right Profile'
                predLabelList.append(predLabel)
        else:
            predLabelList.append('No face detected')
    return {'front_face': 'Frontal' in predLabelList}

def process_image(image_path):
    try:
        image = Image.open(image_path)
        if image.mode != "RGB":
            image = image.convert('RGB')
        result = predFacePose(image)
        return result
    except Exception as e:
        return {'error': str(e)}