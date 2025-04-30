import os
import tempfile
from datetime import datetime
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .forms import RegistrationForm, PhotoSignatureForm
from .models import Student
from django.conf import settings
from .sign import process_signature
from .BlurDetection2.process import process_image
from PIL import Image, ImageStat
import math
import numpy as np
import cv2
from ultralytics import YOLO
from .front_facing_final import process_image as process_front_face_image
from .Deepfakes.imageModel import get_voted_prediction


def get_unique_filename(filename):
    name, ext = os.path.splitext(filename)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_filename = f"{name}_{timestamp}{ext}"
    return unique_filename

def get_latest_file(directory):
    files = [os.path.join(directory, f) for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
    if not files:
        return None
    latest_file = max(files, key=os.path.getctime)
    return latest_file

def register(request):
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            request.session['form_data'] = form.cleaned_data
            return redirect('register_photo_signature')
    else:
        form = RegistrationForm()
    return render(request, 'register.html', {'form': form})

def register_photo_signature(request):
    if request.method == 'POST':
        form = PhotoSignatureForm(request.POST, request.FILES)
        if form.is_valid():
            form_data = request.session.get('form_data')
            if form_data:
                form_data.update(form.cleaned_data)

                # Save the student data without photo and signature first
                student = Student(**form_data)
                student.save()

                # Handle the photo image
                photo = request.FILES['photo']
                unique_photo_name = get_unique_filename(photo.name)
                photo_path = os.path.join(settings.MEDIA_ROOT, 'photos', unique_photo_name)
                os.makedirs(os.path.dirname(photo_path), exist_ok=True)
                with open(photo_path, 'wb+') as destination:
                    for chunk in photo.chunks():
                        destination.write(chunk)

                # Handle the signature image
                signature = request.FILES['signature']
                unique_signature_name = get_unique_filename(signature.name)
                signature_path = os.path.join(settings.MEDIA_ROOT, 'signatures', unique_signature_name)
                os.makedirs(os.path.dirname(signature_path), exist_ok=True)
                with open(signature_path, 'wb+') as destination:
                    for chunk in signature.chunks():
                        destination.write(chunk)

                # Process the signature image
                processed_signature_path = process_signature(signature_path)

                return redirect('success', student_id=student.id)
            else:
                return render(request, 'register_photo_signature.html', {'form': form, 'error': 'Session expired. Please start the registration process again.'})
    else:
        form = PhotoSignatureForm()
    return render(request, 'register_photo_signature.html', {'form': form})

@csrf_exempt
def process_signature_view(request):
    if request.method == 'POST':
        signature = request.FILES.get('signature')
        if signature:
            unique_signature_name = get_unique_filename(signature.name)
            signature_path = os.path.join(settings.MEDIA_ROOT, 'signatures', unique_signature_name)
            os.makedirs(os.path.dirname(signature_path), exist_ok=True)
            with open(signature_path, 'wb+') as destination:
                for chunk in signature.chunks():
                    destination.write(chunk)

            processed_signature_path = process_signature(signature_path)

            processed_signature_url = os.path.join(settings.MEDIA_URL, 'signatures',
                                                   os.path.basename(processed_signature_path))
            return JsonResponse({'success': True, 'processed_signature_url': processed_signature_url})
        else:
            return JsonResponse({'success': False, 'error': 'No signature file uploaded.'})
    return JsonResponse({'success': False, 'error': 'Invalid request method.'})

@csrf_exempt
def check_photo(request):
    if request.method == 'POST' and 'photo' in request.FILES:
        photo = request.FILES['photo']

        # Use a temporary file to save the uploaded photo
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            for chunk in photo.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name

        try:
            result = process_image(temp_path)

            # Save the uploaded photo to the media folder
            unique_photo_name = get_unique_filename(photo.name)
            photo_path = os.path.join(settings.MEDIA_ROOT, 'photos', unique_photo_name)
            os.makedirs(os.path.dirname(photo_path), exist_ok=True)
            with open(photo_path, 'wb+') as destination:
                for chunk in photo.chunks():
                    destination.write(chunk)

            return JsonResponse(result)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)
        finally:
            os.remove(temp_path)

    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
def check_front_face(request):
    if request.method == 'POST' and 'photo' in request.FILES:
        photo = request.FILES['photo']
        photo_path = os.path.join('/tmp', photo.name)

        # Create the directory if it doesn't exist
        os.makedirs(os.path.dirname(photo_path), exist_ok=True)

        with open(photo_path, 'wb+') as destination:
            for chunk in photo.chunks():
                destination.write(chunk)

        try:
            result = process_front_face_image(photo_path)
            return JsonResponse(result)
        except Exception as e:
            return JsonResponse({'error': str(e)})

    return JsonResponse({'error': 'Invalid request'})

def success(request, student_id):
    student = Student.objects.get(id=student_id)
    return render(request, 'success.html', {'student': student})

def complete_registration(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        dob = request.POST.get('dob')
        age = request.POST.get('age')
        enrollment_number = request.POST.get('enrollment_number')

        # Check for unique enrollment number
        if Student.objects.filter(enrollment_number=enrollment_number).exists():
            return render(request, 'complete_registration.html', {'message': 'Enrollment number already exists!'})

        student = Student(name=name, dob=dob, age=age, enrollment_number=enrollment_number)
        student.save()

        # Get the latest photo and signature files
        latest_photo_path = get_latest_file(os.path.join(settings.MEDIA_ROOT, 'photos'))
        latest_signature_path = get_latest_file(os.path.join(settings.MEDIA_ROOT, 'signatures'))

        if latest_photo_path:
            student.photo = 'photos/' + os.path.basename(latest_photo_path)

        if latest_signature_path:
            student.signature = 'signatures/' + os.path.basename(latest_signature_path)

        student.save()

        return render(request, 'complete_registration.html', {'message': 'Registration completed successfully!'})

    return render(request, 'complete_registration.html')

def calculate_brightness(image_path):
    image = Image.open(image_path)
    image = image.resize((1280, 720), Image.ANTIALIAS)

    # Creating bins for 10 levels between 0 to 255
    levels = np.linspace(0, 255, num=10)

    # Get average pixel level for each layer
    image_stats = ImageStat.Stat(image)
    red_channel_mean, green_channel_mean, blue_channel_mean = image_stats.mean

    # The three constants (.299, .587, and .114) represent the different degrees to which each of the primary (RGB)
    # colors affects human perception of the overall brightness of a color. Notice that they sum to 1.

    image_bright_value = math.sqrt(0.299 * (red_channel_mean ** 2)
                                   + 0.587 * (green_channel_mean ** 2)
                                   + 0.114 * (blue_channel_mean ** 2))

    image_bright_level = np.digitize(image_bright_value, levels, right=True)

    return int(image_bright_level)

def check_brightness(request):
    if request.method == 'POST' and request.FILES.get('photo'):
        photo = request.FILES['photo']
        photo_path = os.path.join('/tmp', photo.name)

        # Create the directory if it doesn't exist
        os.makedirs(os.path.dirname(photo_path), exist_ok=True)

        with open(photo_path, 'wb+') as destination:
            for chunk in photo.chunks():
                destination.write(chunk)

        try:
            brightness_level = calculate_brightness(photo_path)
            return JsonResponse({'brightness': brightness_level})
        except Exception as e:
            return JsonResponse({'error': str(e)})

    return JsonResponse({'error': 'Invalid request'})

def detect_human_with_non_plain_background_yolo(image_path, laplacian_threshold=50):
    """Detects non-plain backgrounds using YOLOv8 and Laplacian variance."""
    try:
        model = YOLO(r"C:\Users\Amity\PycharmProjects\face_check\yolov8x-pose-p6.pt")  # Load YOLO pose model.
        img = cv2.imread(image_path)
        if img is None:
            return {'error': f"Error: Could not load image from {image_path}"}

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
            return {'error': "No human detected."}

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var > laplacian_threshold:
            return {'non_plain_background': True}
        else:
            return {'non_plain_background': False}

    except Exception as e:
        return {'error': str(e)}

def check_background(request):
    if request.method == 'POST' and request.FILES.get('photo'):
        photo = request.FILES['photo']
        photo_path = os.path.join('/tmp', photo.name)

        # Create the directory if it doesn't exist
        os.makedirs(os.path.dirname(photo_path), exist_ok=True)

        with open(photo_path, 'wb+') as destination:
            for chunk in photo.chunks():
                destination.write(chunk)

        try:
            background_check = detect_human_with_non_plain_background_yolo(photo_path)
            return JsonResponse(background_check)
        except Exception as e:
            return JsonResponse({'error': str(e)})

    return JsonResponse({'error': 'Invalid request'})

@csrf_exempt
def check_deepfake(request):
    if request.method == 'POST' and 'photo' in request.FILES:
        photo = request.FILES['photo']
        photo_path = os.path.join('/tmp', photo.name)

        # Create the directory if it doesn't exist
        os.makedirs(os.path.dirname(photo_path), exist_ok=True)

        with open(photo_path, 'wb+') as destination:
            for chunk in photo.chunks():
                destination.write(chunk)

        try:
            output, predicted_class, score_real, score_fake = get_voted_prediction(photo_path)
            return JsonResponse({'message': output, 'predicted_class': predicted_class, 'score_real': score_real, 'score_fake': score_fake})
        except Exception as e:
            return JsonResponse({'error': str(e)})

    return JsonResponse({'error': 'Invalid request'})