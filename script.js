// Initialize variables
let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let capturedImage = null;
let statusDiv = document.getElementById('status');
let captureButton = document.getElementById('capture');
let checkStatusButton = document.getElementById('checkStatus');
let browseButton = document.getElementById('browse');
let cropButton = document.getElementById('crop');
let rotateButton = document.getElementById('rotate');
let checkBgButton = document.getElementById('checkBg');
let fileInput = document.getElementById('fileInput');

// Add browse button click handler
browseButton.addEventListener('click', () => {
    fileInput.click();
});

let backgroundMessage = null;
let faceStatusMessage = null;

function updateCombinedStatus() {
    const lines = [];
    if (backgroundMessage) lines.push(`<p><strong>Background Check:</strong> ${backgroundMessage}</p>`);
    if (faceStatusMessage) lines.push(faceStatusMessage);
    statusDiv.innerHTML = lines.join('');
}


// Function to check if face is vertical and get rotation angle
function getFaceRotationAngle(landmarks) {
    // Get the nose and chin points
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    // Calculate the angle between nose and chin
    const nosePoint = nose[6]; // Bottom of nose
    const chinPoint = jaw[8];  // Bottom of chin

    // Calculate the vertical line angle
    const angle = Math.atan2(chinPoint.y - nosePoint.y, chinPoint.x - nosePoint.x) * (180 / Math.PI);

    // Normalize angle to be between -90 and 90 degrees
    let normalizedAngle = angle > 90 ? angle - 180 : angle;

    // If the face is upside down (chin above nose), add 180 degrees
    if (chinPoint.y < nosePoint.y) {
        normalizedAngle += 180;
    }

    return normalizedAngle;
}

// Function to rotate image
function rotateImage(image, angle) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Calculate new canvas size to fit rotated image
    const radians = angle * Math.PI / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const newWidth = image.width * cos + image.height * sin;
    const newHeight = image.width * sin + image.height * cos;

    // Set canvas size
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Translate to center
    context.translate(newWidth / 2, newHeight / 2);
    context.rotate(radians);

    // Draw image
    context.drawImage(image, -image.width / 2, -image.height / 2);

    return canvas;
}

// Add crop button click handler
cropButton.addEventListener('click', async () => {
    if (!capturedImage) {
        statusDiv.innerHTML = "Please load an image first!";
        return;
    }

    try {
        statusDiv.innerHTML = "Detecting and cropping face...";
        console.log("Starting face detection for cropping...");

        const image = new Image();
        const imageLoadPromise = new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = (err) => reject(new Error('Failed to load image: ' + err));
        });

        image.src = capturedImage;
        await imageLoadPromise;
        console.log("Image loaded successfully for cropping");

        // Detect face in the image with more detailed options
        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 512,
            scoreThreshold: 0.1
        });

        console.log("Detecting faces with options:", options);
        const detections = await faceapi.detectAllFaces(image, options)
            .withFaceLandmarks();

        console.log("Face detection result:", detections);

        if (!detections || detections.length === 0) {
            statusDiv.innerHTML = `
                No face detected in the image.<br>
                Please ensure:<br>
                1. Your face is clearly visible<br>
                2. The lighting is good<br>
                3. You're not too far from the camera
            `;
            return;
        }

        // Get the first face detection
        const face = detections[0];
        const box = face.detection.box;

        console.log("Face detected with confidence:", face.detection.score);

        // Calculate face dimensions with extra padding for hair
        const faceWidth = box.width;
        const faceHeight = box.height;

        // Add more padding at the top for hair (60% of face height)
        const topPadding = faceHeight * 0.6;
        // Add standard padding for other sides (25% of face dimensions)
        const sidePadding = faceWidth * 0.25;
        const bottomPadding = faceHeight * 0.25;

        // Calculate crop coordinates with safety checks
        const x = Math.max(0, box.x - sidePadding);
        const y = Math.max(0, box.y - topPadding);
        const width = Math.min(image.width - x, faceWidth + (sidePadding * 2));
        const height = Math.min(image.height - y, faceHeight + topPadding + bottomPadding);

        // Ensure we don't exceed image boundaries
        const finalX = Math.max(0, x);
        const finalY = Math.max(0, y);
        const finalWidth = Math.min(image.width - finalX, width);
        const finalHeight = Math.min(image.height - finalY, height);

        console.log("Crop dimensions:", {
            x: finalX,
            y: finalY,
            width: finalWidth,
            height: finalHeight
        });

        // Create canvas for cropped face
        const context = canvas.getContext('2d');
        canvas.width = finalWidth;
        canvas.height = finalHeight;

        // Draw the cropped face
        context.drawImage(
            image,
            finalX, finalY, finalWidth, finalHeight,  // source rectangle (face with padding)
            0, 0, finalWidth, finalHeight   // destination rectangle
        );

        // Apply brightness and contrast adjustments
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Brightness increase by 5% and contrast adjustment
        const brightnessFactor = 1.05; // 5% increase
        const contrastFactor = 1.2;    // 20% increase in contrast

        for (let i = 0; i < data.length; i += 4) {
            // Apply brightness
            data[i] = Math.min(255, data[i] * brightnessFactor);     // Red
            data[i + 1] = Math.min(255, data[i + 1] * brightnessFactor); // Green
            data[i + 2] = Math.min(255, data[i + 2] * brightnessFactor); // Blue

            // Apply contrast
            const factor = (259 * (contrastFactor + 255)) / (255 * (259 - contrastFactor));
            data[i] = factor * (data[i] - 128) + 128;     // Red
            data[i + 1] = factor * (data[i + 1] - 128) + 128; // Green
            data[i + 2] = factor * (data[i + 2] - 128) + 128; // Blue
        }

        // Put the modified image data back
        context.putImageData(imageData, 0, 0);

        // Save the cropped and enhanced image
        capturedImage = canvas.toDataURL('image/png');
        statusDiv.innerHTML = "Face cropped successfully with enhanced brightness and contrast!";
        console.log("Face cropping completed successfully");

    } catch (err) {
        console.error("Error cropping face:", err);
        statusDiv.innerHTML = `
            Error cropping face: ${err.message}<br>
            Please try:<br>
            1. Using a clearer image<br>
            2. Ensuring your face is well-lit<br>
            3. Making sure your face is clearly visible
        `;
    }
});

// Check if browser supports camera
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({
        video: {
            width: 640,
            height: 480,
            facingMode: "user" // Use front camera
        }
    })
    .then(function(stream) {
        video.srcObject = stream;
        video.play();
        statusDiv.innerHTML = "Camera access granted. You can now capture photos.";
    })
    .catch(function(err) {
        console.error("Error accessing camera:", err);
        statusDiv.innerHTML = `
            Error accessing camera: ${err.message}<br>
            Please ensure:<br>
            1. Your camera is connected<br>
            2. Camera permissions are granted<br>
            3. No other application is using the camera
        `;
    });
} else {
    statusDiv.innerHTML = "Your browser doesn't support camera access. Please try a different browser.";
}

// Load face-api.js models
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/face-api/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/face-api/models')
]).then(() => {
    console.log("Models loaded successfully");
    statusDiv.innerHTML = "Face detection models loaded successfully!";
}).catch(err => {
    console.error("Error loading models:", err);
    statusDiv.innerHTML = `
        Error loading face detection models: ${err.message}<br>
        Please check if all model files are present in the face-api/models directory.<br>
        Required files:<br>
        - tiny_face_detector_model-weights_manifest.json<br>
        - tiny_face_detector_model-shard1<br>
        - face_landmark_68_model-weights_manifest.json<br>
        - face_landmark_68_model-shard1<br>
        - face_landmark_68_tiny_model-weights_manifest.json<br>
        - face_landmark_68_tiny_model-shard1
    `;
});

// Capture image from camera
captureButton.addEventListener('click', () => {
    try {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        capturedImage = canvas.toDataURL('image/png');
        statusDiv.innerHTML = "Image captured successfully!";
        console.log("Image captured with dimensions:", canvas.width, "x", canvas.height);
    } catch (err) {
        console.error("Error capturing image:", err);
        statusDiv.innerHTML = `
            Error capturing image: ${err.message}<br>
            Please ensure the camera is working properly.
        `;
    }
});

// Handle file selection
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        if (!file.type.match('image.*')) {
            statusDiv.innerHTML = "Please select an image file (JPEG, PNG, etc.)";
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const context = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                context.drawImage(img, 0, 0);
                capturedImage = canvas.toDataURL('image/png');
                statusDiv.innerHTML = "Image loaded successfully!";
                console.log("Image loaded with dimensions:", img.width, "x", img.height);
            };
            img.onerror = (err) => {
                console.error("Error loading image:", err);
                statusDiv.innerHTML = "Error loading image. Please try another file.";
            };
            img.src = e.target.result;
        };
        reader.onerror = (err) => {
            console.error("Error reading file:", err);
            statusDiv.innerHTML = "Error reading file. Please try another file.";
        };
        reader.readAsDataURL(file);
    }
});

// Calculate image brightness
function calculateImageBrightness(image) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let brightness = 0;

    for (let i = 0; i < data.length; i += 4) {
        brightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    }

    return brightness / (data.length / 4);
}

// Get brightness status
function getBrightnessStatus(brightness) {
    if (brightness < 0.2) return "Too Dark";
    if (brightness < 0.4) return "Dark";
    if (brightness < 0.6) return "Moderate";
    if (brightness < 0.8) return "Bright";
    return "Too Bright";
}

// Calculate eye openness
function calculateEyeOpenness(eye) {
    const eyeHeight = Math.abs(eye[1].y - eye[5].y);
    const eyeWidth = Math.abs(eye[0].x - eye[3].x);
    return eyeHeight / eyeWidth;
}

// Check face status
checkStatusButton.addEventListener('click', async () => {
    if (!capturedImage) {
        statusDiv.innerHTML = "Please capture an image first!";
        return;
    }

    try {
        statusDiv.innerHTML = "Processing image...";
        console.log("Starting face detection...");

        const image = new Image();
        const imageLoadPromise = new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = (err) => reject(new Error('Failed to load image: ' + err));
        });

        image.src = capturedImage;
        console.log("Image source set, waiting for load...");

        await imageLoadPromise;
        console.log("Image loaded successfully");

        const brightness = calculateImageBrightness(image);
        const brightnessStatus = getBrightnessStatus(brightness);

        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 512,
            scoreThreshold: 0.1
        });

        console.log("Detecting faces with options:", options);
        const detections = await faceapi.detectAllFaces(image, options)
            .withFaceLandmarks();
        console.log("Face detection result:", detections);

        if (!detections || detections.length === 0) {
            console.log("No faces detected");
            faceStatusMessage = `
                <p><strong>Face Detection Status:</strong></p>
                <p>❌ No face detected in the image!</p>
                <p>Image Brightness: ${brightnessStatus} (${Math.round(brightness * 100)}%)</p>
                <p>Please ensure your face is clearly visible and try again.</p>
            `;
            updateCombinedStatus();
            return;
        }

        console.log("Faces detected:", detections.length);

        const face = detections[0];
        const landmarks = face.landmarks;

        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        const leftEyeOpenness = calculateEyeOpenness(leftEye);
        const rightEyeOpenness = calculateEyeOpenness(rightEye);

        const leftEyeStatus = leftEyeOpenness > 0.2 ? "Open" : "Closed";
        const rightEyeStatus = rightEyeOpenness > 0.2 ? "Open" : "Closed";

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        faceapi.draw.drawDetections(canvas, detections);
        faceapi.draw.drawFaceLandmarks(canvas, detections);

        let statusText = `
            <p><strong>Face Detection Status:</strong></p>
            <p>Faces detected: ${detections.length}</p>
            <p>Confidence: ${Math.round(face.detection.score * 100)}%</p>
            <p>Image Brightness: ${brightnessStatus} (${Math.round(brightness * 100)}%)</p>
            <p>Left Eye: ${leftEyeStatus} (${Math.round(leftEyeOpenness * 100)}%)</p>
            <p>Right Eye: ${rightEyeStatus} (${Math.round(rightEyeOpenness * 100)}%)</p>
        `;

        faceStatusMessage = statusText;
        updateCombinedStatus();

        console.log("Face detection completed successfully");

    } catch (err) {
        console.error("Face detection error:", err);
        console.error("Error stack:", err.stack);
        let errorMessage = "Error during face detection. ";

        if (err.message) {
            errorMessage += err.message;
        } else {
            errorMessage += "Unknown error occurred.";
        }

        errorMessage += "<br>Please try:<br>";
        errorMessage += "1. Ensure your face is clearly visible<br>";
        errorMessage += "2. Check that the lighting is good<br>";
        errorMessage += "3. Try moving closer to the camera";

        faceStatusMessage = errorMessage;
        updateCombinedStatus();

    }
});

// Function to check if face is likely vertical
function isFaceVertical(landmarks) {
    // Get the nose and chin points
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    // Calculate the angle between nose and chin
    const nosePoint = nose[6]; // Bottom of nose
    const chinPoint = jaw[8];  // Bottom of chin

    // Calculate the vertical line angle
    const angle = Math.atan2(chinPoint.y - nosePoint.y, chinPoint.x - nosePoint.x) * (180 / Math.PI);

    // Face is considered likely vertical if angle is within ±20 degrees of vertical
    return Math.abs(angle) < 20;
}

// Function to check if background is solid color
function isBackgroundSolid(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Sample points around the edges of the image
    const edgePoints = [];
    const sampleSize = 20; // Increased sample size for better accuracy

    // Sample top edge (more points at top since it's often the background)
    for (let i = 0; i < sampleSize; i++) {
        const x = Math.floor((width * i) / sampleSize);
        edgePoints.push({x, y: 0});
        edgePoints.push({x, y: 1}); // Second row for better accuracy
    }

    // Sample bottom edge
    for (let i = 0; i < sampleSize; i++) {
        const x = Math.floor((width * i) / sampleSize);
        edgePoints.push({x, y: height - 1});
        edgePoints.push({x, y: height - 2}); // Second row from bottom
    }

    // Sample left edge
    for (let i = 0; i < sampleSize; i++) {
        const y = Math.floor((height * i) / sampleSize);
        edgePoints.push({x: 0, y});
        edgePoints.push({x: 1, y}); // Second column
    }

    // Sample right edge
    for (let i = 0; i < sampleSize; i++) {
        const y = Math.floor((height * i) / sampleSize);
        edgePoints.push({x: width - 1, y});
        edgePoints.push({x: width - 2, y}); // Second column from right
    }

    // Get color values for edge points
    const edgeColors = edgePoints.map(point => {
        const index = (point.y * width + point.x) * 4;
        return {
            r: data[index],
            g: data[index + 1],
            b: data[index + 2]
        };
    });

    // Calculate average color
    const avgColor = edgeColors.reduce((acc, color) => {
        acc.r += color.r;
        acc.g += color.g;
        acc.b += color.b;
        return acc;
    }, {r: 0, g: 0, b: 0});

    avgColor.r = Math.round(avgColor.r / edgeColors.length);
    avgColor.g = Math.round(avgColor.g / edgeColors.length);
    avgColor.b = Math.round(avgColor.b / edgeColors.length);

    // Calculate color variance
    const variance = edgeColors.reduce((acc, color) => {
        acc.r += Math.pow(color.r - avgColor.r, 2);
        acc.g += Math.pow(color.g - avgColor.g, 2);
        acc.b += Math.pow(color.b - avgColor.b, 2);
        return acc;
    }, {r: 0, g: 0, b: 0});

    variance.r = Math.sqrt(variance.r / edgeColors.length);
    variance.g = Math.sqrt(variance.g / edgeColors.length);
    variance.b = Math.sqrt(variance.b / edgeColors.length);

    // Check if the background is likely solid
    // A solid background should have low variance in all color channels
    const maxVariance = 20; // Maximum allowed variance for a solid color
    const isSolid = variance.r < maxVariance &&
                   variance.g < maxVariance &&
                   variance.b < maxVariance;

    // Calculate color similarity percentage
    const similarity = Math.max(0, 100 - (Math.max(variance.r, variance.g, variance.b) * 2));

    return {
        isSolid,
        color: `rgb(${avgColor.r}, ${avgColor.g}, ${avgColor.b})`,
        similarity: Math.round(similarity)
    };
}

// Add rotate button click handler
rotateButton.addEventListener('click', async () => {
    if (!capturedImage) {
        statusDiv.innerHTML = "Please load an image first!";
        return;
    }

    try {
        statusDiv.innerHTML = "Detecting face and rotating to proper orientation...";
        console.log("Starting face detection and rotation...");

        const image = new Image();
        const imageLoadPromise = new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = (err) => reject(new Error('Failed to load image: ' + err));
        });

        image.src = capturedImage;
        await imageLoadPromise;
        console.log("Image loaded successfully");

        // Detect face in the image
        const detections = await faceapi.detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

        if (!detections || detections.length === 0) {
            statusDiv.innerHTML = "No face detected in the image. Please try another photo.";
            return;
        }

        console.log("Face detected, calculating rotation angle...");
        // Get the first face detection
        const face = detections[0];
        const landmarks = face.landmarks;

        // Check face rotation and rotate if needed
        const rotationAngle = getFaceRotationAngle(landmarks);
        console.log("Rotation angle calculated:", rotationAngle);

        // Calculate the angle needed to make the face vertical with hair at top
        if(rotationAngle > 0){
            targetAngle = (90 - rotationAngle);
        }else{
            targetAngle = -(90 + rotationAngle);
        }

        // Rotate the image
        console.log("Rotating image by", targetAngle, "degrees");
        const rotatedImage = rotateImage(image, targetAngle);

        // Update the canvas with the rotated image
        const context = canvas.getContext('2d');
        canvas.width = rotatedImage.width;
        canvas.height = rotatedImage.height;
        context.drawImage(rotatedImage, 0, 0);

        // Save the rotated image
        capturedImage = canvas.toDataURL('image/png');
        statusDiv.innerHTML = `Image rotated by${Math.round(rotationAngle)} ${Math.round(targetAngle)} degrees to align face properly!`;
        console.log("Rotation completed successfully");

    } catch (err) {
        console.error("Error rotating image:", err);
        statusDiv.innerHTML = "Error rotating image. Please try again.";
    }
});

document.getElementById("checkBg").addEventListener("click", function () {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    const statusDiv = document.getElementById("status");
    if (!file) {
        statusDiv.innerText = "Please select a photo first.";
        return;
    }

    const formData = new FormData();
    formData.append("photo", file);

    fetch("http://localhost:5000/check-background", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        backgroundMessage = data.success ? data.result : "❌ " + (data.error || "Unknown error");
        updateCombinedStatus();

    })
    .catch(error => {
        console.error("Error:", error);
        statusDiv.innerText = "Error checking background.";
    });
});



document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const takePhotoButton = document.getElementById('take_photo');
    const photoPreview = document.getElementById('photo_preview');
    let stream;

    takePhotoButton.addEventListener('click', async () => {
        if (!stream) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = stream;
                video.style.display = 'block';
                takePhotoButton.textContent = 'Capture Photo';
            } catch (err) {
                alert('Unable to access camera. Please allow camera permissions.');
            }
        } else {
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, 200, 150);
            photoPreview.src = canvas.toDataURL('image/png');
            photoPreview.style.display = 'block';
            stream.getTracks().forEach(track => track.stop());
            video.style.display = 'none';
            takePhotoButton.textContent = 'Take Photo';
            stream = null;
        }
    });

    // Signature drawing functionality
    const signatureCanvas = document.getElementById('signature_canvas');
    const signatureCtx = signatureCanvas.getContext('2d');
    const drawSignatureButton = document.getElementById('draw_signature');
    const clearSignatureButton = document.getElementById('clear_signature');
    const saveSignatureButton = document.getElementById('save_signature');
    const signaturePreview = document.getElementById('signature_preview');
    let drawing = false;

    drawSignatureButton.addEventListener('click', () => {
        signatureCanvas.style.display = 'block';
        clearSignatureButton.style.display = 'inline-block';
        saveSignatureButton.style.display = 'inline-block';
    });

    signatureCanvas.addEventListener('mousedown', (e) => {
        drawing = true;
        signatureCtx.beginPath();
        signatureCtx.moveTo(e.offsetX, e.offsetY);
    });

    signatureCanvas.addEventListener('mousemove', (e) => {
        if (drawing) {
            signatureCtx.lineWidth = 2;
            signatureCtx.lineCap = 'round';
            signatureCtx.strokeStyle = '#000';
            signatureCtx.lineTo(e.offsetX, e.offsetY);
            signatureCtx.stroke();
        }
    });

    signatureCanvas.addEventListener('mouseup', () => {
        drawing = false;
    });

    signatureCanvas.addEventListener('mouseleave', () => {
        drawing = false;
    });

    clearSignatureButton.addEventListener('click', () => {
        signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    });

    saveSignatureButton.addEventListener('click', () => {
        const imageData = signatureCanvas.toDataURL('image/png');
        signaturePreview.src = imageData;
        signaturePreview.style.display = 'block';
    });
});

document.getElementById('id_signature').addEventListener('change', function(event) {
    const file = event.target.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = async function(event) {
            const imageData = event.target.result; // Full Base64 string

            // Show the uploaded signature preview
            document.getElementById("signature_preview").src = imageData;
            document.getElementById("signature_preview").style.display = "block";

            // Send the signature to the backend for processing
            const response = await fetch("http://127.0.0.1:5000/process-signature", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ image: imageData })
            });

            const result = await response.json();

            if (result.status === "success") {
                // Show the processed signature with background removed
                document.getElementById("processed_signature").src = `data:image/png;base64,${result.image}`;
                document.getElementById("processed_signature").style.display = "block";
            } else {
                alert("Error: " + result.message);
            }
        };

        reader.readAsDataURL(file);
    }
});

function checkFrontalFace(file, callback) {
    const formData = new FormData();
    formData.append("photo", file);

    fetch("http://localhost:5000/check-frontal-face", {
        method: "POST",
        body: formData,
    })
    .then((res) => res.json())
    .then((data) => {
        if (data.success) {
            callback(data.result);
        } else {
            callback("❌ Could not determine face orientation.");
        }
    })
    .catch((err) => {
        console.error("Frontal check error:", err);
        callback("❌ Error checking face orientation.");
    });
}


document.getElementById("processPhoto").addEventListener("click", async () => {
    const statusDiv = document.getElementById("status");
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        statusDiv.innerHTML = "<p>Please upload or capture a photo first.</p>";
        return;
    }

    statusDiv.innerHTML = "🚀 Processing photo...";

    // Simulate clicking the Rotate button
    if (rotateButton && typeof rotateButton.click === "function") {
        await rotateButton.click();
    }

    // Simulate clicking the Crop button
    if (cropButton && typeof cropButton.click === "function") {
        await cropButton.click();
    }

    // Simulate clicking the Check Background button
    if (checkBgButton && typeof checkBgButton.click === "function") {
        await checkBgButton.click();
    }

    // Simulate clicking the Check Status button
    if (checkStatusButton && typeof checkStatusButton.click === "function") {
        await checkStatusButton.click();
    }

    // Now check for face orientation and append the result
    checkFrontalFace(file, (result) => {
        const frontalResultHTML = `<p><strong>Face Orientation:</strong> ${result}</p>`;
        statusDiv.innerHTML += frontalResultHTML;
        console.log("✅ All photo processes completed via Process Photo button.");
    });
});

