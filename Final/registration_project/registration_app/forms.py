from django import forms
from .models import Student

class RegistrationForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ['name', 'age', 'dob', 'enrollment_number']
        widgets = {
            'dob': forms.DateInput(attrs={'type': 'date'}),
        }

class PhotoSignatureForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ['photo', 'signature']