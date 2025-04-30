# registration_app/models.py
from django.db import models

class Student(models.Model):
    name = models.CharField(max_length=100)
    age = models.IntegerField()
    dob = models.DateField()
    enrollment_number = models.CharField(max_length=20, unique=True)
    photo = models.ImageField(upload_to='photos/')
    signature = models.ImageField(upload_to='signatures/')

    def __str__(self):
        return self.name