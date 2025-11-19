# Real-Time Bioactivity Prediction Feature

## Overview
This feature implements a real-time bioactivity prediction system using Google Gemini API with Server-Sent Events (SSE) for streaming responses. The system accepts either compound names or SMILES notation as input and streams the analysis results live to the frontend.

## Architecture

### Backend (Node.js + Express)

#### 1. Service Layer (`server/services/bioactivity-prediction.ts`)
- **BioactivityPredictionService**: Main service class for handling predictions
  - `isSmilesNotation(input)`: Detects whether input is SMILES or compound name
  - `predictBioactivityStream(compound)`: Generates streaming predictions using Gemini API
  - `extractJSON(text)`: Extracts structured JSON from streamed response
  - `validatePrediction(data)`: Validates prediction results

#### 2. API Endpoint (`server/routes.ts`)
- **POST `/api/predict`**: Main streaming endpoint
  - Accepts JSON: `{ "compound": "string" }`
  - Input can be either:
    - Compound name (e.g., "Aspirin", "Imatinib")
    - SMILES notation (e.g., "CC(=O)Oc1ccccc1C(=O)O")
  - Returns Server-Sent Events (SSE) stream
  - Validates input length (2-500 characters)
  - Sends chunked data as it's generated
  - Returns final structured JSON with:
    - `compound_name`: Name of the compound
    - `smiles`: SMILES notation
    - `activity`: Active/Moderately Active/Inactive
    - `target_class`: Biological target (GPCR, Kinase, etc.)
    - `confidence`: 0-100% confidence score
    - `reasoning`: Explanation of prediction

### Frontend (React + TypeScript)

#### Component (`client/src/pages/realtime-prediction.tsx`)
- **RealtimeBioactivityPrediction**: Main React component
  - Real-time streaming display
  - Auto-scrolling output
  - Structured results display
  - Quick example buttons
  - Error handling

#### Features:
1. **Input Section**
   - Text input for compound name or SMILES
   - Quick example buttons for testing
   - Real-time validation

2. **Results Display**
   - Live streaming text output
   - Structured prediction results with color-coded badges
   - Activity level indicators
   - Confidence score visualization
   - Target class identification

3. **Stream Viewer**
   - Dark-themed console-style output
   - Auto-scrolling
   - Animated cursor during streaming
   - Full response history

## API Flow

### Request
```javascript
POST /api/predict
Content-Type: application/json

{
  "compound": "Aspirin"
}
```

### Response (SSE Stream)
```
data: {"type":"chunk","content":"You are analyzing..."}

data: {"type":"chunk","content":" Aspirin (acetylsalicylic acid)..."}

data: {"type":"complete","prediction":{
  "compound_name":"Aspirin",
  "smiles":"CC(=O)Oc1ccccc1C(=O)O",
  "activity":"Moderately Active",
  "target_class":"COX Enzyme",
  "confidence":85,
  "reasoning":"Aspirin is a known NSAID..."
}}
```

## Security Features

1. **API Key Protection**
   - Gemini API key stored in `.env` file
   - Never exposed to frontend
   - Loaded via `dotenv` on server startup

2. **Input Validation**
   - Length limits (2-500 characters)
   - Type checking (string only)
   - Sanitized before processing

3. **Error Handling**
   - Graceful error messages
   - Stream interruption handling
   - Fallback responses

## Usage

### Access the Feature
1. Start the server: `npm run dev`
2. Navigate to: `http://localhost:5001/realtime-predict`
3. Enter a compound name or SMILES
4. Click "Predict Bioactivity"
5. Watch the real-time analysis stream

### Input Examples

#### Compound Names:
- "Aspirin"
- "Caffeine"
- "Imatinib"
- "Penicillin"

#### SMILES Notation:
- `CC(=O)Oc1ccccc1C(=O)O` (Aspirin)
- `CN1C=NC2=C1C(=O)N(C(=O)N2C)C` (Caffeine)
- `CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CN3CCN(CC3)C)NC4=NC=CC(=N4)C5=CN=CC=C5` (Imatinib)

## Configuration

### Environment Variables
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Gemini Model
- Model: `gemini-1.5-flash`
- Method: `generateContentStream()`
- Fast response times
- High-quality predictions

## Navigation

The feature is accessible via:
- **Navbar**: "Real-Time Prediction" menu item
- **Route**: `/realtime-predict`
- **Icon**: Activity (lightning bolt)

## Technical Details

### Streaming Implementation
1. Backend uses `generateContentStream()` from Gemini API
2. Express sends SSE headers for streaming
3. Frontend reads stream using Fetch API's `ReadableStream`
4. Data is decoded and parsed in real-time
5. UI updates incrementally as chunks arrive

### Error Handling
- Network errors caught and displayed
- Invalid input rejected before API call
- Stream interruption handled gracefully
- User can stop streaming mid-process

### Performance
- Chunked responses start within 1-2 seconds
- Full analysis typically completes in 5-10 seconds
- No blocking of main thread
- Efficient memory usage with streaming

## Future Enhancements

1. **Batch Processing**: Analyze multiple compounds simultaneously
2. **History**: Save and review past predictions
3. **Export**: Download predictions as CSV/JSON
4. **Comparison**: Compare multiple compounds side-by-side
5. **Advanced Filters**: Filter by activity level or target class
6. **Integration**: Connect with existing compound database

## Troubleshooting

### Common Issues

1. **API Key Error**
   - Verify `.env` file exists
   - Check API key is valid
   - Restart server after adding key

2. **Streaming Fails**
   - Check network connectivity
   - Verify Gemini API quota
   - Review browser console for errors

3. **No Results**
   - Ensure input is valid
   - Check server logs for errors
   - Verify Gemini model availability

## Dependencies

- `@google/generative-ai`: ^0.24.1
- Express.js (built-in SSE support)
- React 18+ (for streaming UI)
- TypeScript (type safety)

## Files Modified/Created

### Backend:
- `server/services/bioactivity-prediction.ts` (NEW)
- `server/routes.ts` (MODIFIED - added `/api/predict` endpoint)
- `.env` (MODIFIED - added API key)

### Frontend:
- `client/src/pages/realtime-prediction.tsx` (NEW)
- `client/src/App.tsx` (MODIFIED - added route)
- `client/src/components/navbar.tsx` (MODIFIED - added nav item)

## Testing

### Manual Testing Steps:
1. Open browser to `http://localhost:5001/realtime-predict`
2. Test with compound name: "Aspirin"
3. Verify streaming output appears
4. Check final structured results
5. Test with SMILES: `CC(=O)Oc1ccccc1C(=O)O`
6. Verify different compounds work
7. Test error handling with invalid input

### Expected Results:
- ✓ Stream starts within 1-2 seconds
- ✓ Text appears incrementally
- ✓ Final JSON extracted correctly
- ✓ UI displays structured results
- ✓ Activity badges show correct colors
- ✓ Confidence scores display properly

---

**Built with Google Gemini API for real-time pharmaceutical compound analysis**
