# Gemini AI 3D Molecular Visualization Setup

## Overview

This project now uses Google's Gemini AI API to generate enhanced 3D molecular structures from SMILES notation.

## Setup Instructions

### 1. Get Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment

1. Create a `.env` file in the project root:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

```bash
npm run dev
```

## Features

### AI-Enhanced 3D Visualization

- **Gemini API Integration**: Uses Google's Gemini 1.5 Flash model to generate optimal 3D coordinates
- **Intelligent Bond Angles**: AI calculates accurate tetrahedral, trigonal, and linear geometries
- **Ring Planarity**: Proper handling of aromatic systems
- **Natural Conformations**: AI suggests energetically favorable 3D arrangements

### Medicine Photo Analysis (NEW)

- **Image Recognition**: Upload photos of medicine blisters, bottles, or boxes
- **Gemini Vision AI**: Analyzes images to extract medicine information
- **Comprehensive Insights**: Returns:
  - Medicine name, brand, and formulation
  - Active and inactive ingredients with SMILES (when available)
  - Therapeutic purpose and conditions treated
  - Dosage, timing, and route of administration
  - Safety guidance (prescription status, warnings, contraindications, side effects)
  - Confidence score and label readability assessment
- **External API Integration**:
  - **RxNorm API**: Validates drug names and retrieves RXCUI codes
  - **OpenFDA Drug Label API**: Fetches official FDA warnings and brand information
  - **PubChem API**: Verifies chemical compound data
- **Auto-Verification**: If active compound is identified, automatically runs full molecular analysis
- **Medical Disclaimer**: Clear UI warnings that this is informational only, not medical advice
- **Size Limits**: 4MB client-side, 6MB server-side; PNG/JPEG only

### Fallback Mechanism

If the Gemini API is unavailable or fails:

- Automatically falls back to local force-directed algorithm
- Ensures uninterrupted functionality
- No user intervention required

### API Endpoints

#### Generate 3D Structure

```
POST /api/gemini/generate-3d
Body: { "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "name": "Caffeine" }
```

#### Get Molecular Insights

```
POST /api/gemini/insights
Body: { "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "name": "Caffeine" }
```

#### Analyze Medicine Photo

```
POST /api/compounds/analyze-image
Body: { "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANS..." }
Response: {
  "medicineInsights": {
    "summary": "Medicine description",
    "usageGuidelines": { "dosage": "...", "timing": "...", "route": "...", "instructions": "..." },
    "ingredients": { "active": [...], "inactive": [...], "formulation": "..." },
    "safety": { "prescriptionStatus": "...", "warnings": [...], "contraindications": [...], "sideEffects": [...] },
    "confidence": { "score": 0.85, "labelReadable": true, "rationale": "..." },
    "compoundCandidates": [{ "name": "...", "smiles": "...", "confidence": 0.9 }],
    "rxNorm": { "rxcui": "...", "name": "..." },
    "openFDALabel": { "brand": "...", "warnings": [...] }
  },
  "compound": { ... },  // If auto-verified
  "prediction": { ... },  // If auto-verified
  "lipinskiRules": { ... },  // If auto-verified
  "structure": { ... }  // If auto-verified
}
```

## Usage

### Molecular Structure Analysis

1. Enter a SMILES notation in the compound input field
2. The system will:

   - Send the SMILES to Gemini API
   - Receive AI-generated 3D coordinates
   - Render the enhanced 3D structure
   - Display "✨ AI-Enhanced" badge if successful

3. Features:
   - **Drag to Rotate**: Click and drag to rotate the molecule
   - **Reset**: Click the reset button to return to original view
   - **Download**: Export as PNG image
   - **Fullscreen**: View in larger modal

### Medicine Photo Analysis

1. Click the **"Photo"** tab in the Compound Input section
2. Upload a clear photo of a medicine:
   - **Blister pack** (foil/plastic packaging with pills)
   - **Medicine bottle** (prescription or OTC)
   - **Medicine box** (with visible label)
3. Requirements:
   - Format: PNG or JPEG
   - Size: Maximum 4MB
   - Quality: Clear, readable text on label
4. The system will:
   - Upload and encode the image as Base64
   - Send to Gemini Vision AI for analysis
   - Extract medicine information (name, ingredients, dosage, warnings)
   - Query external APIs (RxNorm, OpenFDA, PubChem) for verification
   - If active compound is identified, automatically run full molecular analysis
5. Review the results:
   - **Medicine Insights Card**: Summary, ingredients, usage guidelines, safety information
   - **Molecular Analysis**: If compound was auto-verified, shows 2D/3D structure, predictions, safety assessment
   - **Confidence Score**: Indicates reliability of the AI analysis
   - **Medical Disclaimer**: Always displayed - this is informational only

**Important Notes:**

- This feature is for **informational and educational purposes only**
- **NOT** a substitute for professional medical advice
- Always consult a healthcare provider before using any medication
- Gemini AI may make errors or misread labels
- Verify all information with a pharmacist or doctor

## Examples

### Molecular Structure Analysis

#### Caffeine

```
SMILES: CN1C=NC2=C1C(=O)N(C(=O)N2C)C
```

#### Benzene

```
SMILES: c1ccccc1
```

#### Aspirin

```
SMILES: CC(=O)OC1=CC=CC=C1C(=O)O
```

### Medicine Photo Analysis Examples

#### Example 1: Paracetamol/Acetaminophen Tablet

- **Photo**: Blister pack showing "Paracetamol 500mg"
- **Expected Output**:
  - Name: Paracetamol (Acetaminophen)
  - Active Ingredient: Paracetamol 500mg (SMILES: CC(=O)Nc1ccc(O)cc1)
  - Dosage: 1-2 tablets every 4-6 hours, max 8 tablets/day
  - Route: Oral
  - Prescription Status: Over-the-counter
  - Warnings: Liver damage risk with overdose, avoid alcohol

#### Example 2: Aspirin

- **Photo**: Medicine bottle labeled "Aspirin 75mg"
- **Expected Output**:
  - Name: Aspirin (Acetylsalicylic Acid)
  - Active Ingredient: Aspirin 75mg (SMILES: CC(=O)OC1=CC=CC=C1C(=O)O)
  - Purpose: Blood thinner, pain relief
  - Dosage: 75mg once daily
  - Contraindications: Active bleeding, stomach ulcers
  - Side Effects: Stomach upset, increased bleeding risk

#### Example 3: Prescription Medication

- **Photo**: Prescription bottle with visible label
- **Expected Output**:
  - Prescription Status: Prescription required
  - Warnings: "Do not share this medication", "Complete full course"
  - External References: RxNorm RXCUI, FDA warnings if available

## Troubleshooting

### API Key Not Working

- Verify the key is correct in `.env`
- Restart the dev server after changing `.env`
- Check API quota limits in Google AI Studio

### Medicine Photo Analysis Issues

#### Low Confidence Score

- **Cause**: Poor image quality, unclear label text, or unusual packaging
- **Solution**:
  - Retake photo with better lighting
  - Ensure label is in focus and fully visible
  - Try different angle or closer shot
  - Clean any glare or reflections from packaging

#### No Compound Auto-Verification

- **Cause**: Gemini couldn't extract SMILES or compound name not in PubChem
- **Solution**:
  - Manually review the "Identified Compounds" section
  - Copy the compound name or SMILES from the insights
  - Paste into the SMILES tab and run manual analysis

#### "Image too large" Error

- **Cause**: Image file exceeds 4MB client-side limit
- **Solution**:
  - Resize image before upload
  - Reduce image quality/resolution
  - Convert to JPEG (typically smaller than PNG)

#### External API Failures (RxNorm, OpenFDA)

- **Cause**: Network issues, API rate limits, or medicine not in database
- **Impact**: Missing RXCUI or FDA warnings (Gemini insights still available)
- **Solution**: These are optional enrichments; basic analysis will still work

#### Fallback Response Shown

- **Cause**: Gemini couldn't parse the image or API key missing
- **Indicator**: Confidence score ~35%, generic paracetamol example shown
- **Solution**:
  - Verify GEMINI_API_KEY is set
  - Check image contains actual medicine packaging (not random photos)
  - Ensure image format is PNG or JPEG

### Fallback to Local Generation

If you see structures without "AI-Enhanced" badge:

- Check console for error messages
- Verify internet connection
- Check Gemini API status

### Rate Limiting

Gemini API has rate limits:

- Free tier: 60 requests per minute
- Structures are generated once per compound
- Results can be cached client-side

## Architecture

```
Client (React)
  ↓ SMILES Input
  ↓ POST /api/gemini/generate-3d
Server (Express)
  ↓ Call Gemini API
  ↓ Parse AI Response
  ↓ Return Enhanced Coordinates
Client
  ↓ Render 3D Structure
  ↓ Apply Rotation/Interaction
```

## Benefits of AI Generation

1. **Accuracy**: Better bond angles and spatial arrangements
2. **Chemical Knowledge**: Understands molecular geometry rules
3. **Optimization**: Energetically favorable conformations
4. **Insights**: Additional chemical insights available via `/insights` endpoint

## Cost Considerations

- Gemini 1.5 Flash is optimized for speed and cost
- Free tier available with generous limits
- Production: Consider caching results to minimize API calls

## Future Enhancements

- [ ] Cache Gemini results in database
- [ ] Show molecular insights in UI
- [ ] Support for multiple conformers
- [ ] Energy minimization visualization
- [ ] Comparison view (AI vs local generation)

## Support

For issues or questions:

1. Check the console for error messages
2. Verify API key configuration
3. Test with simple molecules first (e.g., water: O, methane: C)
