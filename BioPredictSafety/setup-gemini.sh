#!/bin/bash

# Gemini API Setup Script

echo "🚀 BioPredictSafety - Gemini AI 3D Visualization Setup"
echo "======================================================"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "✅ .env file already exists"
    echo ""
    read -p "Do you want to update your Gemini API key? (y/n): " update_key
    if [ "$update_key" != "y" ]; then
        echo "Setup cancelled."
        exit 0
    fi
else
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
fi

# Get API key from user
echo "📖 Instructions:"
echo "1. Visit: https://makersuite.google.com/app/apikey"
echo "2. Sign in with your Google account"
echo "3. Click 'Create API Key'"
echo "4. Copy the generated key"
echo ""

read -p "Enter your Gemini API Key (or press Enter to skip): " api_key

if [ -z "$api_key" ]; then
    echo ""
    echo "⚠️  No API key entered. You'll need to manually edit .env file."
    echo "   Run: nano .env"
    echo "   And add: GEMINI_API_KEY=your_key_here"
else
    # Update .env file
    if grep -q "GEMINI_API_KEY=" .env; then
        # Replace existing key
        sed -i '' "s/GEMINI_API_KEY=.*/GEMINI_API_KEY=$api_key/" .env
    else
        # Add new key
        echo "GEMINI_API_KEY=$api_key" >> .env
    fi
    echo ""
    echo "✅ API key saved to .env file"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Start the server: npm run dev"
echo "3. Open http://localhost:5000"
echo ""
echo "📚 For more information, see GEMINI_3D_README.md"
