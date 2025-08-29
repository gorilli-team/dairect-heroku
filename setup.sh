#!/bin/bash

# Hotel Booking Automation - Setup Script
# This script helps you set up the project quickly

set -e

echo "🏨 Hotel Booking Automation - Setup Script"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js (v18+) first."
    echo "Visit: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed."
    exit 1
fi

print_status "npm version: $(npm -v)"

# Install root dependencies
print_info "Installing root dependencies..."
npm install

# Install frontend dependencies
print_info "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install backend dependencies  
print_info "Installing backend dependencies..."
cd backend
npm install

# Install Playwright browsers
print_info "Installing Playwright browsers..."
npx playwright install
cd ..

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_info "Creating .env file from template..."
    cp .env.example .env
    print_warning "Please edit .env file and add your OpenAI API key!"
    print_info "You can get an API key from: https://platform.openai.com/api-keys"
else
    print_warning ".env file already exists. Skipping creation."
fi

# Create logs directory
mkdir -p backend/logs
print_status "Created logs directory"

# Check if OpenAI API key is set
if [ -f .env ]; then
    if grep -q "OPENAI_API_KEY=your_openai_api_key_here" .env; then
        print_warning "Don't forget to set your OpenAI API key in .env file!"
    fi
fi

echo
echo "🎉 Setup completed successfully!"
echo
echo "Next steps:"
echo "1. Edit .env file and add your OpenAI API key"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:5173"
echo
echo "For more information, read README.md"
echo
print_info "Happy automating! 🤖"
