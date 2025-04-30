from django.urls import path
from . import views

urlpatterns = [
    path('', views.register_photo_signature, name='register_photo_signature'),  # Updated this line
    path('register_photo_signature/', views.register_photo_signature, name='register_photo_signature'),
    path('process_signature/', views.process_signature_view, name='process_signature_view'),
    path('check/photo/', views.check_photo, name='check_photo'),  # New URL pattern for check_photo
    path('check_brightness/', views.check_brightness, name='check_brightness'),  # New endpoint for brightness detection
    path('check_background/', views.check_background, name='check_background'),
    path('check_front_face/', views.check_front_face, name='check_front_face'),  # New endpoint for front-face detection
    path('check_deepfake/', views.check_deepfake, name='check_deepfake'),  # New endpoint for deepfake detection
    path('complete_registration/', views.complete_registration, name='complete_registration'),
]