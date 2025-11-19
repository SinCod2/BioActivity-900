# Medicine Photo Analysis - Quick Start Guide

## What's New? 🎉

BioPredictSafety can now analyze photos of medicine packaging! Upload a picture of your medicine blister, bottle, or box, and get instant AI-powered insights.

## Quick Demo (3 Steps)

### 1. Navigate to the Photo Tab

In the Dashboard (`/analyze`), click the **Photo** tab in the Compound Input section.

### 2. Upload a Medicine Photo

- Click "Choose Photo" or drag-and-drop
- Supported: PNG, JPEG (max 4MB)
- Best results: Clear, well-lit photos showing the label

### 3. Review Results

Within seconds, you'll see:

- **Medicine name and purpose**
- **Active ingredients** (with chemical structure if available)
- **Dosage and usage instructions**
- **Safety warnings and contraindications**
- **Prescription status**
- **Automatic molecular analysis** (if compound identified)

## Example Workflow

```
Upload Photo of Paracetamol 500mg Blister
           ↓
    Gemini AI Analyzes
           ↓
   Extracts Information:
   • Name: Paracetamol
   • Active: Paracetamol 500mg
   • SMILES: CC(=O)Nc1ccc(O)cc1
   • Dosage: 1-2 tablets every 4-6 hours
   • Warnings: Liver damage risk
           ↓
    Verifies via PubChem
           ↓
  Auto-runs Full Analysis:
  • 2D/3D molecular structure
  • pIC50 prediction
  • Lipinski's Rule evaluation
  • Safety assessment
           ↓
    Display Complete Results
```

## What You Get

### Medicine Insights Card

- 📊 **Summary**: AI description of the medicine
- 🧪 **Ingredients**: Active compounds with SMILES
- 🕐 **Usage**: Dosage, timing, route of administration
- 🛡️ **Safety**: Warnings, contraindications, side effects
- 📚 **External Data**: RxNorm RXCUI, FDA warnings (when available)
- ✅ **Confidence Score**: AI's certainty about the analysis

### Molecular Analysis (Auto-Generated)

If the AI identifies an active compound:

- **2D Structure**: Clean molecular diagram from PubChem
- **3D Visualization**: Interactive rotatable model
- **Descriptors**: Molecular weight, LogP, H-bond donors/acceptors
- **Bioactivity**: pIC50 prediction with confidence
- **Drug-likeness**: Lipinski's Rule of Five compliance
- **Safety Profile**: Toxicity predictions (LD50, hepatotoxicity, etc.)

## Important Notes ⚠️

### Medical Disclaimer

This feature is **INFORMATIONAL ONLY** and is **NOT** a substitute for professional medical advice.

- ❌ Do NOT use for diagnosing conditions
- ❌ Do NOT use for prescribing medications
- ❌ Do NOT replace pharmacist/doctor consultations
- ✅ Use for education and research only
- ✅ Always verify with healthcare professionals

### AI Limitations

- May misread blurry or poorly lit labels
- May not recognize all medicines (especially regional brands)
- Chemical structures are best-effort predictions
- External APIs may have incomplete data

### Privacy

- Images are **NOT** stored on our servers
- Analyzed in-memory only
- No permanent record of uploads

## Tips for Best Results

### ✅ Do's

- ✅ Use clear, high-resolution photos
- ✅ Ensure good lighting (no shadows/glare)
- ✅ Capture the entire label
- ✅ Hold camera steady (avoid blur)
- ✅ Clean packaging if dusty/dirty

### ❌ Don'ts

- ❌ Don't upload photos > 4MB (resize first)
- ❌ Don't use heavily edited/filtered images
- ❌ Don't crop out important label information
- ❌ Don't expect perfect results from handwritten labels
- ❌ Don't share photos of expired medicines only

## Technical Details

### APIs Used

1. **Google Gemini 1.5 Flash**: Image analysis and text extraction
2. **RxNorm (NIH)**: Drug name validation and RXCUI lookup
3. **OpenFDA**: Official drug label warnings
4. **PubChem**: Chemical compound verification

### Response Time

Typical analysis takes **4-8 seconds**:

- Gemini AI: 2-4 seconds
- External APIs: 1-2 seconds
- PubChem verification: 1-2 seconds

### Supported Formats

- **Image Types**: PNG, JPEG
- **Max Size**: 4MB (client), 6MB (server)
- **Min Resolution**: 800x600 recommended

## Troubleshooting

### "Low confidence score"

**Problem**: AI is uncertain about the analysis  
**Solution**: Retake photo with better lighting and focus

### "No compound identified"

**Problem**: AI couldn't extract chemical information  
**Solution**: Check the "Identified Compounds" section and manually analyze

### "Image too large"

**Problem**: File exceeds 4MB  
**Solution**: Resize image or reduce quality before upload

### "Fallback response shown"

**Problem**: Generic paracetamol example displayed  
**Solution**:

- Verify `GEMINI_API_KEY` is set in `.env`
- Ensure photo shows actual medicine packaging
- Check image format is PNG or JPEG

## Configuration

### Required Environment Variable

```bash
# .env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your free API key at: [Google AI Studio](https://makersuite.google.com/app/apikey)

### Optional Setup

No additional API keys needed! RxNorm, OpenFDA, and PubChem are all free public APIs.

## Testing the Feature

### Test Cases

Try these common medicines:

1. **Paracetamol/Tylenol** (Acetaminophen)
2. **Aspirin** (Acetylsalicylic Acid)
3. **Ibuprofen** (Advil, Motrin)
4. **Vitamin C** (Ascorbic Acid)

### Expected Results

For a clear photo of Paracetamol 500mg:

- ✅ Name identified correctly
- ✅ SMILES extracted: `CC(=O)Nc1ccc(O)cc1`
- ✅ Dosage: "1-2 tablets every 4-6 hours"
- ✅ Prescription status: "Over-the-counter"
- ✅ Auto-verification succeeds
- ✅ Full molecular analysis displayed

## Documentation

For more details, see:

- **Full Feature Docs**: `MEDICINE_PHOTO_ANALYSIS.md`
- **Gemini Setup**: `GEMINI_3D_README.md`
- **Architecture**: `ARCHITECTURE.md`

## Feedback & Support

Encountered issues? Have suggestions?

- Check console logs for detailed errors
- Review the troubleshooting guides
- Ensure your Gemini API key is valid and has quota remaining

---

**Ready to try it?** Head to `/analyze` and click the **Photo** tab! 📸💊
