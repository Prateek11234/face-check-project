# Create directories
New-Item -ItemType Directory -Force -Path "face-api\models"

# Function to download file with retry
function Download-FileWithRetry {
    param (
        [string]$Url,
        [string]$OutputPath,
        [int]$MaxRetries = 3
    )
    
    $attempt = 0
    while ($attempt -lt $MaxRetries) {
        try {
            $attempt++
            Write-Host "Downloading $Url (Attempt $attempt of $MaxRetries)"
            Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing
            Write-Host "Successfully downloaded to $OutputPath"
            return $true
        }
        catch {
            Write-Host "Attempt $attempt failed: $_"
            if ($attempt -eq $MaxRetries) {
                Write-Host "Failed to download after $MaxRetries attempts"
                return $false
            }
            Start-Sleep -Seconds 2
        }
    }
}

# Download face-api.js
$faceApiUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/dist/face-api.min.js"
if (!(Download-FileWithRetry -Url $faceApiUrl -OutputPath "face-api\face-api.min.js")) {
    Write-Host "Failed to download face-api.min.js"
    exit 1
}

# Model files to download
$modelFiles = @(
    @{
        name = "tiny_face_detector_model-weights_manifest.json"
        url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json"
    },
    @{
        name = "tiny_face_detector_model-shard1"
        url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1"
    },
    @{
        name = "face_landmark_68_model-weights_manifest.json"
        url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json"
    },
    @{
        name = "face_landmark_68_model-shard1"
        url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1"
    },
    @{
        name = "face_landmark_68_tiny_model-weights_manifest.json"
        url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_tiny_model-weights_manifest.json"
    },
    @{
        name = "face_landmark_68_tiny_model-shard1"
        url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_tiny_model-shard1"
    },
    @{
        name = "face_landmark_68_model-shard2"
        url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard2"
    }
)

# Download each model file
$failedDownloads = 0
foreach ($file in $modelFiles) {
    $outputPath = "face-api\models\$($file.name)"
    if (!(Download-FileWithRetry -Url $file.url -OutputPath $outputPath)) {
        $failedDownloads++
    }
}

if ($failedDownloads -gt 0) {
    Write-Host "Warning: $failedDownloads files failed to download"
} else {
    Write-Host "All files downloaded successfully!"
} 