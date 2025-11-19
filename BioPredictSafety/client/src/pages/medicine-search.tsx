import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Pill, AlertCircle, Info, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { apiRequest } from "@/lib/queryClient";
import LoadingAnimation, { LoadingOverlay } from "@/components/loading-animation";

interface DrugSearchResult {
  drugbankId: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

interface DrugDetails {
  drugbankId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  
  // Basic Info
  brandNames?: string[];
  genericName?: string;
  manufacturer?: string;
  
  // Chemical Info
  activeIngredients?: string[];
  molecularFormula?: string;
  molecularWeight?: number;
  smiles?: string;
  
  // Pharmacology
  mechanisms: string[];
  categories: string[];
  routes: string[];
  dosageForms: string[];
  
  // Medical Use
  indications: string[];
  purpose?: string[];
  sideEffects?: string[];
  adverseReactions?: string[];
  
  // Safety & Warnings
  warnings?: string[];
  contraindications?: string[];
  boxedWarnings?: string[];
  pregnancyWarnings?: string[];
  overdosageInfo?: string;
  
  // Additional
  dosageAndAdministration?: string[];
  atcCodes: string[];
  fdaApplicationNumber?: string;
  
  // Backwards compatibility
  synonyms: string[];
  toxicity?: string;
  fdaWarnings: string[];
}

export default function MedicineSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDrugId, setSelectedDrugId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const queryClient = useQueryClient();

  // Initialize from URL parameters (for history re-run)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
      setSearchTrigger(q); // Auto-trigger search
    }
  }, []);

  // Setup Speech Recognition lazily
  const initRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setSearchQuery(transcript);
    };
    rec.onend = () => {
      setListening(false);
    };
    recognitionRef.current = rec;
    return rec;
  };

  const startListening = () => {
    const rec = initRecognition();
    if (!rec) return;
    try {
      setListening(true);
      rec.start();
    } catch (e) {
      setListening(false);
    }
  };

  const stopListening = () => {
    const rec = recognitionRef.current;
    if (rec) rec.stop();
    setListening(false);
  };

  useEffect(() => {
    // Cleanup
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const [searchTrigger, setSearchTrigger] = useState("");

  // Search query - only triggers when searchTrigger changes
  const {
    data: searchResults,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
  } = useQuery({
    queryKey: ['/api/medicines/search', searchTrigger],
    queryFn: async () => {
      if (!searchTrigger.trim()) return { results: [] };
      const res = await apiRequest('GET', `/api/medicines/search?q=${encodeURIComponent(searchTrigger)}`);
      const data = await res.json();
      // Invalidate history to refresh immediately
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['history'] }), 500);
      return data;
    },
    enabled: searchTrigger.trim().length > 0,
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSearchTrigger(searchQuery.trim());
    }
  };

  // Drug details query
  const {
    data: drugDetailsData,
    isPending: isDetailsPending,
    isFetching: isDetailsFetching,
  } = useQuery({
    queryKey: ['/api/medicines', selectedDrugId],
    queryFn: async () => {
      if (!selectedDrugId) return null;
      const res = await apiRequest('GET', `/api/medicines/${selectedDrugId}`);
      return res.json();
    },
    enabled: !!selectedDrugId,
  });

  const drugDetails = drugDetailsData?.details as DrugDetails | null;
  const hasTriggeredSearch = searchTrigger.trim().length > 0;
  const hasSelectedDrug = Boolean(selectedDrugId);
  const isSearching = hasTriggeredSearch && (isSearchPending || isSearchFetching);
  const isLoadingDetails = hasSelectedDrug && (isDetailsPending || isDetailsFetching);

  // Build a concise summary once to reuse across formats
  const getSummary = (d: DrugDetails | null) => {
    if (!d) return null;
    return {
      DrugBank_ID: d.drugbankId,
      Name: d.name,
      Generic_Name: d.genericName || null,
      Brand_Names: (d.brandNames || []).join(', '),
      Active_Ingredients: (d.activeIngredients || []).join(', '),
      Routes: (d.routes || []).join(', '),
      Dosage_Forms: (d.dosageForms || []).join(', '),
      Indications: (d.indications || []).slice(0, 3).join('; '),
      Warnings: (d.warnings || []).slice(0, 3).join('; '),
      Contraindications: (d.contraindications || []).slice(0, 3).join('; '),
      SMILES: d.smiles || null,
      Molecular_Formula: d.molecularFormula || null,
      Molecular_Weight: d.molecularWeight ?? null,
    } as Record<string, string | number | null>;
  };

  const safeFileBase = (name?: string) =>
    (name || 'medicine').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const downloadCSV = () => {
    const s = getSummary(drugDetails);
    if (!s) return;
    const headers = Object.keys(s);
    const values = headers.map((k) => {
      const v = s[k];
      const str = v == null ? '' : String(v);
      return '"' + str.replace(/"/g, '""') + '"';
    });
    const csv = headers.join(',') + '\n' + values.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileBase(drugDetails?.name)}_summary.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadExcel = () => {
    const s = getSummary(drugDetails);
    if (!s) return;
    const rows = Object.entries(s).map(([k, v]) => [k, v == null ? '' : String(v)]);
    const tableHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
      <table border="1" cellspacing="0" cellpadding="4">
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr><td>${r[0]}</td><td>${(r[1] as string).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td></tr>`).join('')}
        </tbody>
      </table>
    </body></html>`;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileBase(drugDetails?.name)}_summary.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const s = getSummary(drugDetails);
    if (!s) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;
    doc.setFontSize(18);
    doc.text('Medicine Summary', pageWidth/2, y, { align: 'center' });
    y += 24;
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth/2, y, { align: 'center' });
    autoTable(doc, {
      startY: y + 16,
      head: [["Field", "Value"]],
      body: Object.entries(s).map(([k,v]) => [k.replace(/_/g,' '), v == null ? '' : String(v)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [32,82,149] },
      theme: 'striped',
      margin: { left: 40, right: 40 },
    });
    const filename = `${safeFileBase(drugDetails?.name)}_summary.pdf`;
    doc.save(filename);
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <LoadingOverlay
        isLoading={isSearching}
        phase="searching"
        message="Synthesizing pharmaceutical intelligence…"
      />

      <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Pill className="h-10 w-10 text-primary" />
          Drug Search
        </h1>
        <p className="text-muted-foreground">
          Find drugs and view identifiers, pharmacology, safety and usage insights
        </p>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a medicine (e.g., Paracetamol, Ibuprofen, Metformin)"
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => listening ? stopListening() : startListening()}
                  className={`p-1.5 rounded-md transition-all ${listening ? 'bg-red-500 text-white animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                  title={listening ? 'Stop voice input' : 'Voice search'}
                  aria-label="Voice search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {listening ? (
                      <rect x="9" y="9" width="6" height="6" />
                    ) : (
                      <>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" x2="12" y1="19" y2="22"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Removed OpenFDA info banner per request */}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Results */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            {isSearching ? (
              <LoadingAnimation
                isLoading
                phase="searching"
                className="py-6"
              />
            ) : searchResults?.results && searchResults.results.length > 0 ? (
              <div className="space-y-2">
                {searchResults.results.map((drug: DrugSearchResult) => (
                  <button
                    key={drug.drugbankId}
                    onClick={() => setSelectedDrugId(drug.drugbankId)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedDrugId === drug.drugbankId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <div className="font-medium text-foreground">{drug.name}</div>
                    {drug.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {drug.description}
                      </div>
                    )}
                    <div className="text-xs text-primary mt-1">{drug.drugbankId}</div>
                  </button>
                ))}
              </div>
            ) : searchTrigger ? (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No medicines found for "{searchTrigger}".
                  </AlertDescription>
                </Alert>
                {(() => {
                  const q = searchTrigger.trim().toLowerCase();
                  const synonymHints: Record<string,string> = {
                    paracetamol: 'Try searching "Acetaminophen" (US generic name).',
                    tylenol: 'Try searching "Acetaminophen" (generic name).',
                    panadol: 'Try searching "Acetaminophen" (generic name).'
                  };
                  if (synonymHints[q]) {
                    return (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {synonymHints[q]}
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })()}
                <p className="text-xs text-muted-foreground">
                  Tips: Use US generic names (e.g. Acetaminophen instead of Paracetamol). You can also try brand names.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Enter a medicine name to search
              </p>
            )}
          </CardContent>
        </Card>

        {/* Drug Details */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Medicine Details</CardTitle>
            {drugDetails && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={`Download ${drugDetails.name} summary`}
                    aria-label="Download medicine summary"
                    onMouseEnter={() => setMenuOpen(true)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onMouseLeave={() => setMenuOpen(false)} className="w-40">
                  <DropdownMenuItem onClick={downloadPDF}>Export as PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadExcel}>Export as Excel</DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadCSV}>Export as CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingDetails ? (
              <LoadingAnimation
                isLoading
                phase="predicting"
                className="py-12"
              />
            ) : drugDetails ? (
              <div className="space-y-6">
                {/* 🧾 BASIC INFO */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                    <span>🧾</span> Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Drug Name</label>
                      <p className="text-lg font-bold text-foreground">{drugDetails.name}</p>
                    </div>
                    {drugDetails.genericName && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Generic Name</label>
                        <p className="text-lg font-semibold text-foreground">{drugDetails.genericName}</p>
                      </div>
                    )}
                    {drugDetails.brandNames && drugDetails.brandNames.length > 0 && (
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Brand Names</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {drugDetails.brandNames.map((brand, i) => (
                            <Badge key={i} variant="secondary" className="text-sm">{brand}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {drugDetails.manufacturer && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Manufacturer</label>
                        <p className="text-sm font-medium text-foreground">{drugDetails.manufacturer}</p>
                      </div>
                    )}
                    {drugDetails.fdaApplicationNumber && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">FDA Application #</label>
                        <p className="text-sm font-mono text-foreground">{drugDetails.fdaApplicationNumber}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ⚗️ CHEMICAL INFO */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                    <span>⚗️</span> Chemical Information
                  </h3>
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg space-y-3">
                    {drugDetails.activeIngredients && drugDetails.activeIngredients.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">Active Ingredients</label>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {drugDetails.activeIngredients.map((ing, i) => (
                            <li key={i} className="text-sm text-foreground">{ing}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {drugDetails.molecularFormula && (
                      <div>
                        <label className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">UNII / Identifier</label>
                        <p className="text-sm font-mono text-foreground">{drugDetails.molecularFormula}</p>
                      </div>
                    )}
                    {drugDetails.smiles && (
                      <div>
                        <label className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">SMILES</label>
                        <p className="text-xs font-mono bg-white dark:bg-gray-900 p-2 rounded break-all">{drugDetails.smiles}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 💊 PHARMACOLOGY */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                    <span>💊</span> Pharmacology
                  </h3>
                  <div className="space-y-3">
                    {drugDetails.categories && drugDetails.categories.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Drug Class</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {drugDetails.categories.map((cat, i) => (
                            <Badge key={i} className="bg-green-600 hover:bg-green-700">{cat}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {drugDetails.mechanisms && drugDetails.mechanisms.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Mechanism of Action</label>
                        <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg mt-2 space-y-2">
                          {drugDetails.mechanisms.map((mech, i) => (
                            <p key={i} className="text-sm text-foreground">{mech}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {drugDetails.routes && drugDetails.routes.length > 0 && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Route of Administration</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {drugDetails.routes.map((route, i) => (
                              <Badge key={i} variant="outline">{route}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {drugDetails.dosageForms && drugDetails.dosageForms.length > 0 && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase">Dosage Forms</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {drugDetails.dosageForms.map((form, i) => (
                              <Badge key={i} variant="outline">{form}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 🩺 MEDICAL USE */}
                <div className="border-l-4 border-cyan-500 pl-4">
                  <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                    <span>🩺</span> Medical Use
                  </h3>
                  {drugDetails.indications && drugDetails.indications.length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Indications (Treats)</label>
                      <div className="bg-cyan-50 dark:bg-cyan-950/20 p-4 rounded-lg mt-2 max-h-48 overflow-y-auto">
                        {drugDetails.indications.map((ind, i) => (
                          <p key={i} className="text-sm text-foreground mb-2">{ind}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {drugDetails.dosageAndAdministration && drugDetails.dosageAndAdministration.length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Dosage & Administration</label>
                      <div className="bg-cyan-50 dark:bg-cyan-950/20 p-4 rounded-lg mt-2 max-h-48 overflow-y-auto">
                        {drugDetails.dosageAndAdministration.map((dose, i) => (
                          <p key={i} className="text-sm text-foreground mb-2">{dose}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {drugDetails.adverseReactions && drugDetails.adverseReactions.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Side Effects / Adverse Reactions</label>
                      <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg mt-2 max-h-48 overflow-y-auto">
                        {drugDetails.adverseReactions.map((reaction, i) => (
                          <p key={i} className="text-sm text-foreground mb-2">{reaction}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ⚠️ SAFETY & WARNINGS */}
                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                    <span>⚠️</span> Safety & Warnings
                  </h3>
                  {drugDetails.boxedWarnings && drugDetails.boxedWarnings.length > 0 && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong className="text-base">⚫ BOXED WARNING - Most Serious</strong>
                        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                          {drugDetails.boxedWarnings.map((warn, i) => (
                            <p key={i} className="text-sm">{warn}</p>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  {drugDetails.contraindications && drugDetails.contraindications.length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase">Contraindications</label>
                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg mt-2 max-h-48 overflow-y-auto">
                        {drugDetails.contraindications.map((contra, i) => (
                          <p key={i} className="text-sm text-foreground mb-2">• {contra}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {drugDetails.warnings && drugDetails.warnings.length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase">Warnings & Precautions</label>
                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg mt-2 max-h-48 overflow-y-auto">
                        {drugDetails.warnings.map((warn, i) => (
                          <p key={i} className="text-sm text-foreground mb-2">{warn}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {drugDetails.pregnancyWarnings && drugDetails.pregnancyWarnings.length > 0 && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase">Pregnancy & Special Populations</label>
                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg mt-2 max-h-48 overflow-y-auto">
                        {drugDetails.pregnancyWarnings.map((warn, i) => (
                          <p key={i} className="text-sm text-foreground mb-2">{warn}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {drugDetails.overdosageInfo && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong className="text-base">Overdose Risk</strong>
                        <p className="mt-2 text-sm">{drugDetails.overdosageInfo}</p>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* 📚 REFERENCES */}
                <div className="border-l-4 border-gray-500 pl-4">
                  <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                    <span>📚</span> References & Links
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://www.drugs.com/search.php?searchterm=${encodeURIComponent(drugDetails.name)}`} target="_blank" rel="noopener noreferrer">
                        Drugs.com
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=BasicSearch.process&searchterm=${encodeURIComponent(drugDetails.name)}`} target="_blank" rel="noopener noreferrer">
                        FDA Database
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://go.drugbank.com/unearth/q?query=${encodeURIComponent(drugDetails.name)}&searcher=drugs`} target="_blank" rel="noopener noreferrer">
                        DrugBank
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(drugDetails.name)}`} target="_blank" rel="noopener noreferrer">
                        PubChem
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Select a medicine from the search results to view details
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  );
}
