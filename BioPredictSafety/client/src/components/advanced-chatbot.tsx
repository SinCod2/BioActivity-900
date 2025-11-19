import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Send, 
  X, 
  Minimize2, 
  Maximize2,
  Mic,
  MicOff,
  Bot,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  typing?: boolean;
  images?: {
    image2d?: string;
    image3d?: string;
  };
}

interface AdvancedChatbotProps {
  className?: string;
}

const quickReplies = [
  { text: "Predict compound", action: "predict" },
  { text: "Open Bioactivity Prediction", action: "open-bioactivity" },
  { text: "Search medicine", action: "med-search" },
  { text: "Open Medicine Search", action: "open-medicine" },
  { text: "Safety guidelines", action: "safety" },
];

export default function AdvancedChatbot({ className }: AdvancedChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI assistant for bioactivity prediction. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [pendingIntent, setPendingIntent] = useState<null | 'predict' | 'med-search'>(null);
  const [lastSearch, setLastSearch] = useState<{ query: string; results: any[] } | null>(null);
  const [, setLocation] = useLocation();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const isProbablySmiles = (text: string) => {
    const t = text.trim();
    if (!t) return false;
    if (t.includes(' ')) return false;
    return /[\[\]@=#+()0-9a-zA-Z/\\.:-]/.test(t) && /[CNOFPSIclBr]/i.test(t);
  };

  const explainFromResult = (result: any) => {
    if (!result) return "No prior analysis found. Please provide a compound name or SMILES.";
    const { compound, prediction } = result;
    const desc = prediction?.descriptors || {};
    const safety = prediction?.safetyAssessment || {};
    const p = prediction?.pic50;
    const conf = prediction?.confidence;
    const bioClass = p >= 7 ? 'Active' : p >= 5.5 ? 'Moderately Active' : 'Inactive';
    const drivers: string[] = [];
    if (typeof desc.logP === 'number') {
      if (desc.logP > 4) drivers.push('high logP suggests strong hydrophobic interactions');
      if (desc.logP < 1) drivers.push('low logP suggests weaker membrane permeability');
    }
    if (typeof desc.tpsa === 'number') {
      if (desc.tpsa > 90) drivers.push('high TPSA may lower passive absorption');
      if (desc.tpsa < 40) drivers.push('low TPSA favors membrane permeability');
    }
    if ((desc.hbdCount ?? 0) + (desc.hbaCount ?? 0) > 8) drivers.push('many H-bond features impact binding/solubility');

    const toxNotes: string[] = [];
    const s = safety as any;
    if (s?.hepatotoxicity?.risk && s.hepatotoxicity.risk !== 'LOW') toxNotes.push('hepatotoxicity vigilance');
    if (s?.cardiotoxicity?.risk && s.cardiotoxicity.risk !== 'LOW') toxNotes.push('potential cardiotoxicity/hERG liability');
    if (s?.mutagenicity?.risk && s.mutagenicity.risk !== 'LOW') toxNotes.push('mutagenicity alerts warrant caution');

    return `${compound?.name || 'Compound'} is predicted ${bioClass} (pIC50 ${Number(p).toFixed(2)}, confidence ${Math.round(Number(conf)*100)}%). ` +
           `${drivers.length ? `Key drivers: ${drivers.join('; ')}. ` : ''}` +
           `${toxNotes.length ? `Safety flags: ${toxNotes.join('; ')}. ` : ''}` +
           `Consider optimizing logP/TPSA and rotatable bonds to tune potency and ADME.`;
  };

  const admetFromDescriptors = (d: any) => {
    return {
      absorption: d?.tpsa < 90 && d?.logP < 5 ? 'favorable' : 'moderate',
      distribution: d?.logP >= 3 ? 'high tissue distribution likely' : 'balanced',
      metabolism: d?.logP >= 3 ? 'likely metabolic clearance via CYPs' : 'moderate',
      excretion: d?.molecularWeight < 500 ? 'primarily renal/hepatic' : 'reduced clearance',
    };
  };

  const buildJsonBlock = (result: any, inputType: 'smiles'|'name'|'drawn_structure') => {
    const { compound, prediction, structure } = result || {};
    const descriptors = prediction?.descriptors || {};
    const json = {
      compound_name: compound?.name || null,
      smiles: compound?.smiles || null,
      input_type: inputType,
      "2d_image_path": structure?.images?.image2d || null,
      "3d_structure_path": structure?.images?.image3d || null,
      predictions: {
        pIC50: prediction?.pic50 ?? null,
        bioactivity_class: prediction?.pic50 >= 7 ? 'Active' : prediction?.pic50 >= 5.5 ? 'Moderately Active' : 'Inactive',
        confidence: prediction?.confidence ?? null,
        toxicity: {
          overall: (prediction?.safetyAssessment as any)?.overallRisk ?? null,
          score: (prediction?.safetyAssessment as any)?.overallScore ?? null,
          hepatotoxicity: (prediction?.safetyAssessment as any)?.hepatotoxicity ?? null,
          cardiotoxicity: (prediction?.safetyAssessment as any)?.cardiotoxicity ?? null,
          mutagenicity: (prediction?.safetyAssessment as any)?.mutagenicity ?? null,
          hergInhibition: (prediction?.safetyAssessment as any)?.hergInhibition ?? null,
        },
        admet: admetFromDescriptors(descriptors),
      },
      descriptors,
    };
    return '```json\n' + JSON.stringify(json, null, 2) + '\n```';
  };

  const analyzeWithBackend = async (raw: string) => {
    const body: any = {};
    let inputType: 'smiles'|'name' = 'name';
    if (isProbablySmiles(raw)) { body.smiles = raw.trim(); inputType = 'smiles'; }
    else { body.name = raw.trim(); inputType = 'name'; }

    const res = await fetch('/api/compounds/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({ message: 'Failed to analyze' }));
      throw new Error(msg?.message || 'Analysis failed');
    }
    const data = await res.json();
    setLastResult(data);
    const header = `Analysis complete for ${data?.compound?.name || data?.compound?.smiles}. I generated 2D and 3D images and computed descriptors.`;
    const explanation = explainFromResult(data);
    const images = {
      image2d: data?.structure?.images?.image2d,
      image3d: data?.structure?.images?.image3d,
    };
    const text = `${header}\n\n${explanation}\n\nI also generated 2D and 3D images. To view them in detail, open the Bioactivity Prediction section.`;
    return { text, images };
  };

  const exportLastAs = async (format: 'csv'|'json') => {
    if (!lastResult?.compound?.id) throw new Error('No analysis to export. Please analyze a compound first.');
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, compoundIds: [lastResult.compound.id] }),
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'csv' ? 'predictions.csv' : 'predictions.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return `Report exported as ${format.toUpperCase()}. Check your downloads.`;
  };

  const exportLastAsPdf = async () => {
    if (!lastResult?.compound) throw new Error('No analysis to export. Please analyze a compound first.');
    const { compound, prediction, lipinskiRules, structure } = lastResult;
    const d: any = prediction?.descriptors || {};
    const admet = {
      absorption: d?.tpsa < 90 && d?.logP < 5 ? 'favorable' : 'moderate',
      distribution: d?.logP >= 3 ? 'high tissue distribution likely' : 'balanced',
      metabolism: d?.logP >= 3 ? 'likely metabolic clearance via CYPs' : 'moderate',
      excretion: d?.molecularWeight < 500 ? 'primarily renal/hepatic' : 'reduced clearance',
    };
    const bioClass = prediction?.pic50 >= 7 ? 'Active' : prediction?.pic50 >= 5.5 ? 'Moderately Active' : 'Inactive';
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;
    doc.setFontSize(18); doc.text('Bioactivity Prediction Report', pageWidth/2, y, { align: 'center' });
    y += 26; doc.setFontSize(11); doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth/2, y, { align: 'center' });
    y += 24; doc.setFontSize(13); doc.text('Compound Summary', 40, y); y += 12; doc.setFontSize(11);
    doc.text([`Name: ${compound.name || '-'}`, `SMILES: ${compound.smiles}`], 40, y); y += 30;
    const imgY = y; const imgWidth = 200; const imgHeight = 150;
    try { if (structure?.images?.image2d) doc.addImage(structure.images.image2d, 'PNG', 40, imgY, imgWidth, imgHeight); } catch {}
    try { if (structure?.images?.image3d) doc.addImage(structure.images.image3d, 'PNG', 40+imgWidth+20, imgY, imgWidth, imgHeight); } catch {}
    y = imgY + imgHeight + 20;
    // @ts-ignore
    doc.autoTable({ startY: y, head: [["Metric","Value"]], body: [["pIC50", String(prediction?.pic50 ?? '-')],["Bioactivity Class", bioClass],["Confidence", prediction?.confidence!=null?`${Math.round(prediction.confidence*100)}%`:'-']], styles:{fontSize:10}, headStyles:{fillColor:[32,82,149]}, theme:'striped', margin:{left:40,right:40}});
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 16;
    // @ts-ignore
    doc.autoTable({ startY: y, head: [["Descriptor","Value"]], body: [["LogP", String(d?.logP ?? '-')],["Molecular Weight", String(d?.molecularWeight ?? '-')],["TPSA", String(d?.tpsa ?? '-')],["Rotatable Bonds", String(d?.rotatableBonds ?? '-')],["HBD", String(d?.hbdCount ?? '-')],["HBA", String(d?.hbaCount ?? '-')],["Rings", String(d?.ringCount ?? '-')]], styles:{fontSize:10}, headStyles:{fillColor:[32,82,149]}, theme:'striped', margin:{left:40,right:40}});
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 16;
    const s: any = prediction?.safetyAssessment || {};
    // @ts-ignore
    doc.autoTable({ startY: y, head: [["Safety Endpoint","Risk","Probability"]], body: [["Overall", String(s?.overallRisk ?? '-'), String(s?.overallScore ?? '-')],["Hepatotoxicity", String(s?.hepatotoxicity?.risk ?? '-'), s?.hepatotoxicity?.probability!=null?String(s.hepatotoxicity.probability):'-'],["Cardiotoxicity", String(s?.cardiotoxicity?.risk ?? '-'), s?.cardiotoxicity?.probability!=null?String(s.cardiotoxicity.probability):'-'],["Mutagenicity", String(s?.mutagenicity?.risk ?? '-'), s?.mutagenicity?.probability!=null?String(s.mutagenicity.probability):'-'],["hERG Inhibition", String(s?.hergInhibition?.risk ?? '-'), s?.hergInhibition?.probability!=null?String(s.hergInhibition.probability):'-']], styles:{fontSize:10}, headStyles:{fillColor:[32,82,149]}, theme:'striped', margin:{left:40,right:40}});
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 16;
    const lipSummary = lastResult?.lipinskiRules ? `${lastResult.lipinskiRules.passed}/${lastResult.lipinskiRules.total} rules passed` : '-';
    doc.setFontSize(12); doc.text(`Lipinski Rules: ${lipSummary}`, 40, y); y += 20; doc.text('ADMET Summary:', 40, y); y += 14; doc.setFontSize(10);
    doc.text([`Absorption: ${admet.absorption}`, `Distribution: ${admet.distribution}`, `Metabolism: ${admet.metabolism}`, `Excretion: ${admet.excretion}`], 40, y);
    doc.save(`${compound.name || compound.smiles || 'prediction'}.pdf`);
    return 'Exported PDF report. Check your downloads.';
  };

  // Medicine search (concise summary)
  const searchMedicines = async (query: string) => {
    const q = query.trim();
    if (!q) throw new Error('Please provide a medicine name to search.');
    const res = await fetch(`/api/medicines/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('Search failed.');
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    setLastSearch({ query: q, results });
    if (!results.length) return { text: `No medicines found for "${q}".` };
    const top = results.slice(0, 3);
    const lines = top.map((r: any, i: number) => `${i + 1}. ${r.name} (${r.drugbankId})${r.description ? ` — ${String(r.description).slice(0, 90)}…` : ''}`);
    const text = `Top matches for "${q}":\n${lines.join('\n')}\n\nOpen Medicine Search for full details.`;
    return { text };
  };

  const safetyGuidelines = () => (
    "General safety guidance: Avoid reactive electrophiles; monitor nitro/aromatic amines for mutagenicity; review halogenated aromatics for off-target reactivity; ensure hERG screening where logP>3 or cationic centers suggest channel binding risk."
  );

  const generateBotResponse = async (userMessage: string): Promise<{ text: string; images?: { image2d?: string; image3d?: string } }> => {
    const lowerMessage = userMessage.toLowerCase();
    const trimmed = userMessage.trim();

    // Helper: check if text looks like a potential drug / compound name phrase
    const looksLikeNamePhrase = (txt: string) => {
      const t = txt.trim();
      if (!t) return false;
      if (/\?|\b(help|how|explain|thank|export|safety|predict|analyze|search)\b/i.test(t)) return false; // avoid obvious non-name intents
      // Allow letters, numbers, spaces, hyphens and parentheses
      if (!/^[A-Za-z0-9][A-Za-z0-9 \-()]{2,}$/.test(t)) return false;
      // Must contain at least one letter sequence typical of drugs (heuristic)
      if (!/(ine|one|ol|ide|vir|mab|pam|azole|dine|mycin|pril|artan|statin|xaban|afil|caine)$/i.test(t.split(/\s+/).pop() || '')) {
        // If not ending with a typical suffix, still allow single tokens <= 15 chars (could be e.g. caffeine)
        if (!/^\w{2,15}$/i.test(t.replace(/\s+/g,''))) return false;
      }
      return true;
    };

    // Phrase-based intent: "predict compound" variants
    if (/\b(predict|analyze) (a )?compound\b/i.test(lowerMessage) || /\bcompound prediction\b/i.test(lowerMessage)) {
      // If user also supplied a name after the phrase (e.g., "predict compound caffeine")
      const after = trimmed.replace(/^(?:(?:(predict|analyze)\s+(a\s+)?compound)|(compound\s+prediction))\s*/i,'').trim();
      if (after.length) {
        return analyzeWithBackend(after);
      }
      setPendingIntent('predict');
      return { text: "Sure — provide a compound name or SMILES to analyze." };
    }

    // Phrase-based intent: "search medicine" or "drug search" variants
    if (/\b(search|find) (a )?(medicine|drug)\b/i.test(lowerMessage) || /\b(medicine|drug) search\b/i.test(lowerMessage)) {
      const after = trimmed.replace(/^(?:(search|find)\s+(a\s+)?(medicine|drug)|((medicine|drug)\s+search))\s*/i,'').trim();
      if (after.length) {
        return await searchMedicines(after);
      }
      setPendingIntent('med-search');
      return { text: "What medicine or drug name should I search?" };
    }
    
    // Direct predict/analyze flow
    if (lowerMessage.startsWith('predict ') || lowerMessage.startsWith('analyze ')) {
      const rest = userMessage.replace(/^\s*(predict|analyze)\s+/i, '').trim();
      if (!rest) return { text: 'Please provide a compound name or SMILES after "predict" (e.g., predict caffeine or predict CCO).' };
      return analyzeWithBackend(rest);
    }

    // Direct medicine search flow
    if (lowerMessage.startsWith('search ')) {
      const rest = userMessage.replace(/^\s*search\s+/i, '').trim();
      if (!rest) return { text: 'Please provide a medicine name after "search" (e.g., search ibuprofen).' };
      return await searchMedicines(rest);
    }

    // If message looks like SMILES or a single chemical name, attempt analysis
    if (isProbablySmiles(userMessage) || (!userMessage.includes(' ') && userMessage.length >= 2)) {
      // Refined single-token handling: prefer medicine search for plain alphabetical names
      if (!userMessage.includes(' ') && /^[A-Za-z][A-Za-z0-9-]{2,}$/.test(userMessage) && !isProbablySmiles(userMessage)) {
        try {
          const searchReply = await searchMedicines(userMessage);
          if (!/No medicines found/i.test(searchReply.text)) {
            return searchReply as any;
          }
          // If no medicines found, fallback to compound analysis
        } catch {}
      }
      try { return await analyzeWithBackend(userMessage); } catch (e: any) { /* fallthrough to help */ }
    }

    // If multi-word phrase that looks like a medicine/compound name, try medicine search first then analysis fallback
    if (userMessage.split(/\s+/).length > 1 && looksLikeNamePhrase(userMessage)) {
      try {
        const searchReply = await searchMedicines(userMessage);
        // If search returned top matches (contains "Top matches") or no medicines found, return it; otherwise fallback
        if (/Top matches|No medicines found/i.test(searchReply.text)) {
          // If no results, attempt analysis as compound name
          if (/No medicines found/i.test(searchReply.text)) {
            try { return await analyzeWithBackend(userMessage); } catch {}
          }
          return searchReply as any;
        }
      } catch {}
      // Fallback to analysis
      try { return await analyzeWithBackend(userMessage); } catch {}
    }

    if (lowerMessage.includes('explain')) {
      return { text: explainFromResult(lastResult) };
    }

    if (lowerMessage.includes('export')) {
      if (lowerMessage.includes('pdf')) {
        try { await exportLastAsPdf(); return { text: 'Exported PDF report. Do you also want JSON or CSV?' }; } catch (e: any) { return { text: e?.message || 'PDF export failed. Please analyze a compound first.' }; }
      }
      try {
        await exportLastAs('json');
        return { text: 'Export started: JSON. Do you also want CSV?' };
      } catch (e: any) {
        return { text: e?.message || 'Export failed. Please analyze a compound first.' };
      }
    }

    if (lowerMessage.includes('safety')) {
      return { text: safetyGuidelines() };
    }

    // Context-aware responses
    if (lowerMessage.includes('predict') || lowerMessage.includes('analyze')) {
      return { text: "Use the 'Predict compound' button, then type a compound name or SMILES. I’ll fetch SMILES, generate 2D/3D, compute descriptors, pIC50, safety, and ADMET." };
    }
    
    if (lowerMessage.includes('pic50') || lowerMessage.includes('bioactivity')) {
      return { text: "pIC50 is a measure of compound potency. Higher values (>6) indicate stronger bioactivity. It's calculated as -log10(IC50), where IC50 is the half-maximal inhibitory concentration." };
    }
    
    if (lowerMessage.includes('safety') || lowerMessage.includes('toxicity')) {
      return { text: "The Safety Assessment analyzes potential toxicity endpoints including hepatotoxicity, cardiotoxicity, mutagenicity, and hERG inhibition. Each endpoint shows probability and risk level." };
    }
    
    if (lowerMessage.includes('lipinski') || lowerMessage.includes('drug-like')) {
      return { text: "Lipinski's Rule of Five predicts drug-likeness based on molecular weight (<500 Da), LogP (<5), H-bond donors (≤5), and H-bond acceptors (≤10). Compounds passing all criteria are more likely to be orally bioavailable." };
    }
    
    if (lowerMessage.includes('export') || lowerMessage.includes('download')) {
      return { text: "You can export your analysis results in three formats: CSV for data analysis, Excel for detailed multi-sheet reports, or PDF for professional presentations. All formats include complete bioactivity, safety, and molecular descriptor data." };
    }
    
    if (lowerMessage.includes('3d') || lowerMessage.includes('structure') || lowerMessage.includes('visualization')) {
      return { text: "The 3D molecular visualization shows the compound's spatial structure. You can drag to rotate, use the reset button to center, or enable AI geometry for more accurate structures. Download the visualization as PNG for presentations." };
    }
    
    if (lowerMessage.includes('smiles')) {
      return { text: "SMILES (Simplified Molecular Input Line Entry System) is a notation for describing molecular structure. For example, 'CCO' represents ethanol, 'c1ccccc1' is benzene. Enter SMILES in the compound input field to analyze." };
    }
    
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return { text: "I can help you with:\n• Understanding prediction metrics (pIC50, confidence)\n• Interpreting safety assessments\n• Explaining molecular descriptors\n• Guiding through analysis steps\n• Exporting results\n\nWhat would you like to know?" };
    }
    
    if (lowerMessage.includes('thank')) {
      return { text: "You're welcome! Feel free to ask if you need any help with compound analysis or understanding the results. 😊" };
    }
    
    // Default response
    return { text: "I'm ready to analyze compounds or help with medicine search. Click 'Predict compound' or 'Search medicine'." };
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Generate response (with typing delay)
    try {
      const reply = pendingIntent === 'predict'
        ? await analyzeWithBackend(userMessage.text)
        : pendingIntent === 'med-search'
          ? await searchMedicines(userMessage.text)
          : await generateBotResponse(userMessage.text);
      const delay = 500 + Math.random() * 500;
      setTimeout(() => {
        const botResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: (reply as any).text ?? String(reply),
          sender: 'bot',
          timestamp: new Date(),
          images: (reply as any).images,
        };
        setMessages(prev => [...prev, botResponse]);
        setIsTyping(false);
      }, delay);
    } catch (e: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: e?.message || 'Something went wrong while processing your request.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
      setIsTyping(false);
    } finally {
      if (pendingIntent) setPendingIntent(null);
    }
  };

  const handleQuickReply = (reply: { text: string; action: string }) => {
    if (reply.action === 'predict') {
      // Enter prompt mode: ask user for the compound name or SMILES
      setPendingIntent('predict');
      const botPrompt: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sure — what compound name or SMILES should I analyze?",
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botPrompt]);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    if (reply.action === 'open-bioactivity') {
      const input = lastResult?.compound?.smiles || lastResult?.compound?.name || '';
      if (input) {
        setLocation(`/analyze?input=${encodeURIComponent(input)}`);
      } else {
        setLocation(`/analyze`);
      }
      return;
    }

    if (reply.action === 'med-search') {
      setPendingIntent('med-search');
      const botPrompt: Message = {
        id: (Date.now() + 1).toString(),
        text: "What medicine should I search?",
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botPrompt]);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    if (reply.action === 'open-medicine') {
      const q = lastSearch?.query || '';
      if (q) setLocation(`/medicine-search?q=${encodeURIComponent(q)}`);
      else setLocation('/medicine-search');
      return;
    }

    // For other actions, send as typed command
    const text = reply.text.toLowerCase();
    if (reply.action === 'explain') {
      setInputValue('explain this result');
    } else if (reply.action === 'export-pdf') {
      setInputValue('export pdf');
    } else if (reply.action === 'safety') {
      setInputValue('safety guidelines');
    } else {
      setInputValue(text);
    }
    setTimeout(() => handleSendMessage(), 50);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      // Show error if speech recognition is not supported
      alert("Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      // Stop listening
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Start listening
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setIsListening(false);
      }
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Floating chat button when closed
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform z-50",
          "bg-primary hover:bg-primary/90",
          className
        )}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card 
      className={cn(
        // Responsive sizing: full width on small screens, compact on desktop
        "fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 shadow-2xl z-50 transition-all duration-300",
        isMinimized ? "h-14 sm:h-16" : "h-[80vh] sm:h-[600px]",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b bg-primary/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="relative">
            <Bot className="h-5 w-5 text-primary" />
            {isTyping && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            )}
          </div>
          AI Assistant
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 flex flex-col h-[calc(100%-4rem)]">
          {/* Messages area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.sender === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full",
                    message.sender === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}>
                    {message.sender === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  
                  <div className={cn(
                    "flex flex-col gap-1 max-w-[80%]",
                    message.sender === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "rounded-2xl px-4 py-2 shadow-sm",
                      message.sender === 'user'
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm"
                    )}>
                      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                      {message.images && (message.images.image2d || message.images.image3d) && (
                        <div className="mt-2 grid grid-cols-2 gap-2 w-full">
                          {message.images.image2d && (
                            <img
                              src={message.images.image2d}
                              alt="2D structure"
                              className="rounded-md bg-background/50 object-contain h-24 w-full"
                            />
                          )}
                          {message.images.image3d && (
                            <img
                              src={message.images.image3d}
                              alt="3D structure"
                              className="rounded-md bg-background/50 object-contain h-24 w-full"
                            />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground px-2">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick replies */}
          <div className="px-4 py-2 border-t bg-muted/30">
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => handleQuickReply(reply)}
                >
                  {reply.text}
                </Badge>
              ))}
            </div>
          </div>

          {/* Input area */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  pendingIntent === 'predict'
                    ? "Enter compound name or SMILES..."
                    : pendingIntent === 'med-search'
                      ? "Enter medicine name to search..."
                      : "Ask me anything..."
                }
                className="flex-1"
                disabled={isTyping}
              />
              <Button
                size="icon"
                variant={isListening ? "destructive" : "outline"}
                onClick={toggleVoiceInput}
                title={isListening ? "Stop voice input" : "Start voice input"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
