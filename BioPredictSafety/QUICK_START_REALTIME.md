# 🚀 Quick Start Guide - Real-Time Bioactivity Prediction

## What's New?

A brand new **Real-Time Bioactivity Prediction** feature that uses Google Gemini AI to analyze compounds instantly!

## ⚡ Quick Access

### Option 1: Via Browser
1. Open: **http://localhost:5001/realtime-predict**

### Option 2: Via Navbar
1. Click **"Real-Time Prediction"** in the navigation menu (⚡ lightning icon)

## 🎯 Try It Now!

### 1. Enter a Compound
Choose one:
- **Type a name**: `Aspirin`, `Caffeine`, `Imatinib`
- **Paste SMILES**: `CC(=O)Oc1ccccc1C(=O)O`
- **Click an example**: Use the quick example buttons

### 2. Click "Predict Bioactivity"

### 3. Watch the Magic! ✨
- Real-time streaming text appears
- AI analyzes the compound live
- Final structured results display with:
  - 🎯 Activity level (Active/Moderate/Inactive)
  - 🔬 Biological target class
  - 📊 Confidence score (0-100%)
  - 💡 Reasoning explanation

## 📝 Example Compounds to Try

### Compound Names
```
Aspirin
Caffeine
Imatinib
Penicillin
Warfarin
```

### SMILES Notation
```
CC(=O)Oc1ccccc1C(=O)O
CN1C=NC2=C1C(=O)N(C(=O)N2C)C
CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CN3CCN(CC3)C)NC4=NC=CC(=N4)C5=CN=CC=C5
```

## 🎨 What You'll See

### Real-Time Stream
- Dark terminal-style display
- Live text as AI generates response
- Animated cursor showing activity
- Auto-scrolling to latest content

### Structured Results
- **Compound Name** with SMILES
- **Activity Badge** (color-coded):
  - 🟢 Green = Active
  - 🟡 Yellow = Moderately Active
  - 🔴 Red = Inactive
- **Confidence Score** (percentage)
- **Target Class** (biological target)
- **Reasoning** (explanation)

## 🔥 Key Features

✅ **Instant Analysis** - Results start streaming in 1-2 seconds
✅ **Smart Detection** - Automatically detects SMILES vs. compound name
✅ **Real-Time Updates** - Watch AI thinking in real-time
✅ **Beautiful UI** - Modern, responsive design
✅ **Quick Examples** - One-click testing
✅ **Error Handling** - Clear error messages

## 🛠️ Technical Details

**Powered by:**
- Google Gemini API (gemini-1.5-flash)
- Server-Sent Events (SSE) streaming
- React + TypeScript frontend
- Express.js backend

**API Key:** Already configured in `.env`

## 📖 Need More Info?

Check out these detailed docs:
- `REALTIME_PREDICTION.md` - Full technical documentation
- `IMPLEMENTATION_SUMMARY.md` - Complete implementation details

## 🆘 Troubleshooting

### Issue: No streaming appears
**Solution:** Check that server is running on http://localhost:5001

### Issue: Error message appears
**Solution:** Verify the compound input is valid (2-500 characters)

### Issue: Slow response
**Solution:** First request may be slower; subsequent ones are faster

## 💡 Pro Tips

1. **Quick Testing**: Use the example buttons for instant testing
2. **Copy Results**: Select and copy any prediction results
3. **Try Both**: Test both compound names and SMILES notation
4. **Watch Streaming**: Keep an eye on the real-time output for insights
5. **Confidence**: Higher confidence (>80%) means more reliable predictions

## 🎓 Understanding Results

### Activity Levels
- **Active**: Compound shows strong bioactivity
- **Moderately Active**: Some bioactivity detected
- **Inactive**: Little to no bioactivity

### Target Classes
Common targets include:
- GPCR (receptors)
- Kinases (enzymes)
- Ion Channels
- Nuclear Receptors
- COX Enzymes

### Confidence Score
- **80-100%**: High confidence
- **60-79%**: Moderate confidence
- **0-59%**: Low confidence

## 🚀 Start Exploring!

You're all set! Head over to:
**http://localhost:5001/realtime-predict**

And start predicting bioactivity in real-time! 🎉

---

**Questions?** Check the documentation files or inspect the code in:
- Backend: `server/services/bioactivity-prediction.ts`
- Frontend: `client/src/pages/realtime-prediction.tsx`
- API Route: `server/routes.ts` (line 425+)

Happy Predicting! 🧪⚗️🔬
