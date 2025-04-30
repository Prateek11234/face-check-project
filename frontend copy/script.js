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
