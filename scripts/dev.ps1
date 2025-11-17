# Development startup script for gifting shop
# Usage: .\scripts\dev.ps1

Write-Host "🚀 Starting Gifting Shop Development Server..." -ForegroundColor Cyan

# Set environment variables
$env:MONGODB_URI = 'mongodb://localhost:27017'
$env:DB_NAME = 'rayd_ent'
$env:ADMIN_EMAIL = 'antonioryarbough@gmail.com'
$env:ADMIN_PASSWORD = 'MyPassword123'
$env:ADMIN_PIN = '5678'
$env:SELLER_USERNAME = 'rayd_seller'
$env:CREDITS_UNIT_USD = '0.10'

# TODO: Fill these in from your accounts (or load from .env if you create one)
# $env:CLOUDINARY_URL = 'cloudinary://API_KEY:API_SECRET@CLOUD_NAME'
# $env:STRIPE_SECRET_KEY = 'sk_test_...'
# $env:STRIPE_WEBHOOK_SECRET = 'whsec_...'

# Check if .env file exists and load it
if (Test-Path ".env") {
    Write-Host "📋 Loading environment from .env file..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$key" -Value $value
        }
    }
}

# Verify MongoDB is running
Write-Host "🔍 Checking MongoDB service..." -ForegroundColor Yellow
$mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
if ($mongoService -and $mongoService.Status -eq 'Running') {
    Write-Host "✓ MongoDB is running" -ForegroundColor Green
} else {
    Write-Host "⚠ MongoDB service not found or not running" -ForegroundColor Red
    Write-Host "  Start it with: Start-Service -Name MongoDB" -ForegroundColor Yellow
}

# Show what's configured
Write-Host ""
Write-Host "📝 Configuration:" -ForegroundColor Cyan
Write-Host "  Database: $env:MONGODB_URI/$env:DB_NAME"
Write-Host "  Admin: $env:ADMIN_EMAIL"
Write-Host "  Seller: $env:SELLER_USERNAME"
Write-Host "  Credit Price: `$$env:CREDITS_UNIT_USD USD"
if ($env:CLOUDINARY_URL) {
    Write-Host "  ✓ Cloudinary configured" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Cloudinary not set (uploads will fail)" -ForegroundColor Yellow
}
if ($env:STRIPE_SECRET_KEY) {
    Write-Host "  ✓ Stripe configured" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Stripe not set (payments will fail)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌐 Starting server on http://localhost:3000..." -ForegroundColor Cyan
Write-Host "   Admin Login: http://localhost:3000/admin-login.html" -ForegroundColor Gray
Write-Host "   Admin Gifts: http://localhost:3000/admin-gifts.html" -ForegroundColor Gray
Write-Host ""

# Start the Node server
node server.js
