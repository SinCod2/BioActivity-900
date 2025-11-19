# Medicine Photo Analysis Feature

## Overview

The Medicine Photo Analysis feature allows users to upload photographs of medicine packaging (blisters, bottles, or boxes) and receive AI-powered insights about the medication, including ingredients, dosage, usage instructions, and safety information.

## How It Works

### 1. Image Upload & Processing

- User uploads a PNG or JPEG image (max 4MB)
- Image is validated client-side for size and format
- Converted to Base64 encoding
- Sent to backend via `POST /api/compounds/analyze-image`

### 2. Gemini AI Analysis

- Backend sends image to **Google Gemini 1.5 Flash** (multimodal model)
- AI extracts:
  - Medicine name and brand
  - Active ingredients (with SMILES when possible)
  - Inactive ingredients
  - Formulation type (tablet, capsule, liquid, etc.)
  - Therapeutic purpose
  - Dosage and timing recommendations
  - Route of administration
  - Safety warnings, contraindications, side effects
  - Prescription status
  - Confidence score and label readability

### 3. External API Enrichment

After Gemini analysis, the system queries external APIs:

#### RxNorm API (NLM)

- **Purpose**: Validate drug names and get standard identifiers
- **Endpoint**: `https://rxnav.nlm.nih.gov/REST/rxcui?name={drugName}`
- **Returns**: RXCUI code (RxNorm Concept Unique Identifier)
- **Example**: Paracetamol → RXCUI: 161

#### OpenFDA Drug Label API

- **Purpose**: Fetch official FDA-approved drug label information
- **Endpoint**: `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"{brand}"`
- **Returns**: Official warnings, indications, adverse reactions
- **Example**: Crocin → FDA warnings about liver toxicity

#### PubChem API

- **Purpose**: Verify chemical compound data
- **Used for**: Converting compound names to SMILES notation
- **Enables**: Automatic molecular analysis pipeline

### 4. Auto-Verification & Analysis

If Gemini identifies a likely active compound:

1. System extracts best candidate (prioritizes entries with SMILES)
2. Sends to PubChem for verification
3. If verified, automatically runs full molecular analysis:
   - Molecular descriptors calculation
   - pIC50 prediction (bioactivity)
   - Lipinski's Rule of Five evaluation
   - Safety assessment (toxicity endpoints)
   - 2D/3D structure visualization

### 5. Display Results

Results are shown in two sections:

- **Medicine Insights Card**: All extracted medicine information
- **Molecular Analysis Panel**: Standard compound analysis (if verified)

## User Interface

### Photo Upload Tab

Located in the Compound Input card:

```
┌─────────────────────────────────────┐
│ SMILES | Draw | Upload | 📸 Photo  │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │      Upload Medicine Photo   │   │
│  │         [Choose Photo]       │   │
│  │    Max 4MB • PNG/JPEG only   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ℹ️ Your photo is analyzed via     │
│     Gemini AI. Auto-verification    │
│     attempts to identify compounds. │
└─────────────────────────────────────┘
```

### Medicine Insights Display

Shows comprehensive medication information:

```
┌────────────────────────────────────────────┐
│ 💊 Medicine Photo Analysis                │
│ [Prescription Required] [85% confidence]   │
├────────────────────────────────────────────┤
│ ⚠️ INFORMATIONAL ONLY - NOT MEDICAL ADVICE │
├────────────────────────────────────────────┤
│ 📊 Summary                                 │
│ [AI-generated description of the medicine] │
│                                            │
│ 🧪 Active Ingredients                     │
│ • Paracetamol 500mg                       │
│   SMILES: CC(=O)Nc1ccc(O)cc1              │
│                                            │
│ 🕐 Usage Guidelines                        │
│ Dosage: 1-2 tablets every 4-6 hours       │
│ Timing: Do not exceed 8 tablets/day       │
│ Route: Oral                                │
│                                            │
│ 🛡️ Safety Information                     │
│ ⚠️ Overdose can cause liver damage        │
│ ❌ Severe hepatic impairment               │
│ Side effects: Nausea, rash                │
│                                            │
│ 📚 External References                    │
│ RxNorm: RXCUI 161 (Paracetamol)           │
│ OpenFDA: 2 additional warnings            │
└────────────────────────────────────────────┘
```

## API Response Structure

### Successful Response with Verification

```json
{
  "medicineInsights": {
    "summary": "Paracetamol 500mg is an analgesic and antipyretic...",
    "usageGuidelines": {
      "dosage": "1-2 tablets every 4-6 hours",
      "timing": "Max 8 tablets in 24 hours",
      "route": "Oral",
      "instructions": "Take with water, avoid alcohol"
    },
    "ingredients": {
      "active": [
        {
          "name": "Paracetamol",
          "strength": "500mg",
          "smiles": "CC(=O)Nc1ccc(O)cc1"
        }
      ],
      "inactive": ["Starch", "Magnesium stearate"],
      "formulation": "Film-coated tablet"
    },
    "safety": {
      "prescriptionStatus": "Over-the-counter",
      "warnings": ["Liver damage risk with overdose"],
      "contraindications": ["Severe hepatic impairment"],
      "sideEffects": ["Nausea", "Rash"]
    },
    "confidence": {
      "score": 0.85,
      "labelReadable": true,
      "rationale": "Label text clearly visible and parsed successfully"
    },
    "compoundCandidates": [
      {
        "name": "Paracetamol",
        "smiles": "CC(=O)Nc1ccc(O)cc1",
        "confidence": 0.9,
        "rationale": "Primary active ingredient"
      }
    ],
    "rxNorm": {
      "rxcui": "161",
      "name": "Paracetamol"
    },
    "openFDALabel": {
      "brand": "Tylenol",
      "warnings": ["Liver warning: This product contains acetaminophen..."]
    }
  },
  "compound": { "id": "...", "smiles": "...", "name": "..." },
  "prediction": { "pic50": 6.2, "confidence": 0.82, ... },
  "lipinskiRules": { "passed": 5, "total": 5, ... },
  "structure": { "images": { "image2d": "...", ... } }
}
```

### Response Without Verification (Insights Only)

```json
{
  "medicineInsights": {
    "summary": "...",
    "usageGuidelines": { ... },
    "ingredients": { ... },
    "safety": { ... },
    "confidence": { ... },
    "compoundCandidates": []
  }
}
```

## Error Handling

### Client-Side Validation

- **File too large**: Shows toast error "Image too large (X.XX MB). Max 4MB."
- **Invalid format**: "Unsupported image type. Use PNG or JPEG."
- **Read error**: "Failed to read image"

### Server-Side Errors

- **Missing image data**: HTTP 400 "Image data is required"
- **MIME type invalid**: HTTP 400 "Unsupported image MIME type"
- **Image exceeds 6MB**: HTTP 400 "Image too large (server limit 6 MB)"
- **Gemini API failure**: Returns fallback paracetamol example
- **No API key**: Returns fallback gracefully

### Fallback Behavior

When Gemini cannot analyze the image:

- Returns generic paracetamol example
- Confidence score: ~35%
- `labelReadable: false`
- Rationale: "Fallback used"

## Security & Privacy

### Data Handling

- Images are NOT stored on the server
- Base64 encoding happens client-side
- Gemini API receives image for analysis only
- No permanent storage of user-uploaded photos

### API Key Security

- `GEMINI_API_KEY` stored in `.env` (not committed to git)
- Server-side only (never exposed to client)
- Falls back gracefully if missing

### Rate Limiting

- Gemini Free Tier: 60 requests/minute
- RxNorm: No documented rate limit (public NIH API)
- OpenFDA: 1,000 requests/minute (no API key required)

## Medical & Legal Disclaimers

### Prominent Warnings

Every medicine insights display includes:

- **Blue alert banner**: "⚠️ INFORMATIONAL ONLY - NOT MEDICAL ADVICE"
- Clear statement: "Always consult a healthcare provider before using any medication"
- Reminder that AI can make errors

### Intended Use

- **Educational purposes only**
- **Research and information gathering**
- **NOT** for:
  - Diagnosing medical conditions
  - Prescribing medications
  - Replacing pharmacist/doctor consultation
  - Clinical decision-making

### Accuracy Considerations

- AI may misread labels or make incorrect inferences
- External API data may be incomplete
- Chemical structures are best-effort guesses
- Always verify with official sources

## Configuration

### Environment Variables

```bash
# .env file
GEMINI_API_KEY=your_gemini_api_key_here
```

### Optional API Keys

- RxNorm: No key required (public API)
- OpenFDA: No key required (public API)
- PubChem: No key required (public API)

## Testing

### Test Images

Recommended test cases:

1. **Clear blister pack**: Paracetamol/Tylenol, Aspirin
2. **Medicine bottle**: Prescription or OTC with visible label
3. **Medicine box**: Full packaging with ingredient list
4. **Poor quality**: Blurry, small text (test low confidence)
5. **Non-medicine**: Random object (test fallback)

### Validation Checklist

- ✅ File size validation (4MB limit)
- ✅ MIME type validation (PNG/JPEG only)
- ✅ Base64 encoding works
- ✅ Gemini API call successful
- ✅ RxNorm lookup (when applicable)
- ✅ OpenFDA lookup (when applicable)
- ✅ PubChem verification (when SMILES available)
- ✅ Auto-verification pipeline
- ✅ Fallback handling
- ✅ Error messages display correctly
- ✅ Medical disclaimers always visible

## Performance

### Typical Response Times

- Image upload + encoding: < 500ms
- Gemini analysis: 2-4 seconds
- RxNorm lookup: 200-500ms
- OpenFDA lookup: 500ms-1s
- PubChem verification: 1-2 seconds
- **Total**: 4-8 seconds for full analysis

### Optimization Opportunities

- Cache Gemini results by image hash
- Pre-fetch common medicines
- Batch external API calls
- Progressive UI updates (show Gemini results before external APIs)

## Future Enhancements

- [ ] Multi-language label support
- [ ] Batch photo analysis (multiple medicines)
- [ ] OCR confidence visualization (highlight extracted text)
- [ ] Comparison with user-entered information
- [ ] Medicine interaction checker
- [ ] Expiry date detection
- [ ] Barcode/QR code scanning for exact product lookup
- [ ] Integration with pharmacy databases
- [ ] PDF package insert upload and analysis

## Support & Troubleshooting

For common issues, see the troubleshooting section in `GEMINI_3D_README.md`.

For bugs or feature requests, please open an issue with:

- Sample image (if shareable)
- Expected vs actual output
- Console error logs
- Browser and OS information
