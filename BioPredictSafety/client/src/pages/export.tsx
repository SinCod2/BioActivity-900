import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  FileType, 
  AlertCircle, 
  FlaskConical, 
  ArrowRight,
  CheckCircle,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { AnalysisResult } from "@/types/molecular";
import { Badge } from "@/components/ui/badge";
import { getMolecularName } from "@/lib/molecular-utils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ExportPage() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedAnalysis = sessionStorage.getItem('currentAnalysis');
    if (storedAnalysis) {
      try {
        setCurrentAnalysis(JSON.parse(storedAnalysis));
      } catch (error) {
        console.error('Error parsing stored analysis:', error);
        toast({
          title: "Error loading data",
          description: "Failed to load analysis data from storage",
          variant: "destructive"
        });
      }
    }
    setIsLoading(false);
  }, [toast]);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!currentAnalysis) return;
    
    setExportingFormat(format);
    
    try {
      // Prepare export data
      const timestamp = new Date().toISOString();
      const fileName = `biopredict-${currentAnalysis.compound.name?.replace(/\s+/g, '_') || 'compound'}-${Date.now()}`;

      if (format === 'csv') {
        await downloadCSV(currentAnalysis, fileName, timestamp);
      } else if (format === 'excel') {
        await downloadExcel(currentAnalysis, fileName, timestamp);
      } else if (format === 'pdf') {
        await downloadPDF(currentAnalysis, fileName, timestamp);
      }
      
      toast({
        title: "Export successful!",
        description: `Your ${format.toUpperCase()} file has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An error occurred during export",
        variant: "destructive"
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const downloadCSV = async (data: AnalysisResult, fileName: string, timestamp: string) => {
    const rows = [
      ['BioPredict Safety Analysis Report'],
      ['Generated:', new Date(timestamp).toLocaleString()],
      [''],
      ['=== COMPOUND INFORMATION ==='],
      ['Property', 'Value'],
      ['Compound ID', data.compound.id || 'N/A'],
      ['Name', data.compound.name || getMolecularName(data.compound.smiles)],
      ['SMILES Notation', data.compound.smiles || 'N/A'],
      ['Molecular Formula', data.prediction.descriptors.molecularFormula || 'N/A'],
      ['Molecular Weight (g/mol)', data.prediction.descriptors.molecularWeight ? data.prediction.descriptors.molecularWeight.toFixed(2) : 'N/A'],
      [''],
      ['=== BIOACTIVITY PREDICTION ==='],
      ['Metric', 'Value'],
      ['pIC50', data.prediction.pic50 ? data.prediction.pic50.toFixed(3) : 'N/A'],
      ['Activity Score', data.prediction.pic50 ? data.prediction.pic50.toFixed(2) : 'N/A'],
      ['Confidence Level', data.prediction.confidence ? `${(data.prediction.confidence * 100).toFixed(1)}%` : 'N/A'],
      [''],
      ['=== SAFETY ASSESSMENT ==='],
      ['Metric', 'Value'],
      ['Overall Safety Score', data.prediction.safetyAssessment.overallScore ? `${data.prediction.safetyAssessment.overallScore.toFixed(1)}/10` : 'N/A'],
      ['Overall Risk Level', data.prediction.safetyAssessment.overallRisk || 'N/A'],
      [''],
      ['Toxicity Endpoints:'],
      ['Endpoint', 'Probability', 'Risk Level'],
      ['Hepatotoxicity', data.prediction.safetyAssessment.hepatotoxicity?.probability ? `${(data.prediction.safetyAssessment.hepatotoxicity.probability * 100).toFixed(1)}%` : 'N/A', data.prediction.safetyAssessment.hepatotoxicity?.risk || 'N/A'],
      ['Cardiotoxicity', data.prediction.safetyAssessment.cardiotoxicity?.probability ? `${(data.prediction.safetyAssessment.cardiotoxicity.probability * 100).toFixed(1)}%` : 'N/A', data.prediction.safetyAssessment.cardiotoxicity?.risk || 'N/A'],
      ['Mutagenicity', data.prediction.safetyAssessment.mutagenicity?.probability ? `${(data.prediction.safetyAssessment.mutagenicity.probability * 100).toFixed(1)}%` : 'N/A', data.prediction.safetyAssessment.mutagenicity?.risk || 'N/A'],
      ['hERG Inhibition', data.prediction.safetyAssessment.hergInhibition?.probability ? `${(data.prediction.safetyAssessment.hergInhibition.probability * 100).toFixed(1)}%` : 'N/A', data.prediction.safetyAssessment.hergInhibition?.risk || 'N/A'],
      [''],
      ['=== MOLECULAR DESCRIPTORS ==='],
      ['Descriptor', 'Value'],
      ['LogP (Lipophilicity)', data.prediction.descriptors.logP ? data.prediction.descriptors.logP.toFixed(2) : 'N/A'],
      ['Hydrogen Bond Donors', data.prediction.descriptors.hBondDonors?.toString() || 'N/A'],
      ['Hydrogen Bond Acceptors', data.prediction.descriptors.hBondAcceptors?.toString() || 'N/A'],
      ['Rotatable Bonds', data.prediction.descriptors.rotatableBonds?.toString() || 'N/A'],
      ['Polar Surface Area (Å²)', data.prediction.descriptors.polarSurfaceArea ? data.prediction.descriptors.polarSurfaceArea.toFixed(2) : 'N/A'],
      [''],
      ['=== LIPINSKI RULES (Drug-likeness) ==='],
      ['Criteria', 'Status'],
      ...data.lipinskiRules.rules.map(rule => [
        rule.name || 'N/A',
        `${rule.passed ? '✓ PASS' : '✗ FAIL'}: ${rule.value !== undefined ? rule.value : 'N/A'} (limit: ${rule.limit !== undefined ? rule.limit : 'N/A'})`
      ]),
      ['Overall Assessment', `${data.lipinskiRules.passed || 0}/${data.lipinskiRules.total || 0} rules passed`],
      ['Drug-like', data.lipinskiRules.passed === data.lipinskiRules.total ? 'Yes' : 'No'],
    ];

    // Convert to CSV with proper escaping
    const csvContent = '\uFEFF' + rows.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        // Escape cells containing commas, quotes, or newlines
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${fileName}.csv`);
  };

  const downloadExcel = async (data: AnalysisResult, fileName: string, timestamp: string) => {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['BioPredict Safety Analysis Report'],
      ['Generated:', new Date(timestamp).toLocaleString()],
      [''],
      ['Compound Information'],
      ['Property', 'Value'],
      ['Compound ID', data.compound.id],
      ['Name', data.compound.name || getMolecularName(data.compound.smiles)],
      ['SMILES', data.compound.smiles],
      ['Molecular Formula', data.prediction.descriptors.molecularFormula],
      ['Molecular Weight (g/mol)', data.prediction.descriptors.molecularWeight],
      [''],
      ['Bioactivity Prediction'],
      ['Metric', 'Value'],
      ['pIC50', data.prediction.pic50],
      ['Confidence', data.prediction.confidence],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Safety Assessment
    const safetyData = [
      ['Safety Assessment'],
      [''],
      ['Overall Metrics'],
      ['Metric', 'Value'],
      ['Overall Score', data.prediction.safetyAssessment.overallScore],
      ['Overall Risk', data.prediction.safetyAssessment.overallRisk],
      [''],
      ['Toxicity Endpoints'],
      ['Endpoint', 'Probability', 'Risk Level'],
      ['Hepatotoxicity', data.prediction.safetyAssessment.hepatotoxicity.probability, data.prediction.safetyAssessment.hepatotoxicity.risk],
      ['Cardiotoxicity', data.prediction.safetyAssessment.cardiotoxicity.probability, data.prediction.safetyAssessment.cardiotoxicity.risk],
      ['Mutagenicity', data.prediction.safetyAssessment.mutagenicity.probability, data.prediction.safetyAssessment.mutagenicity.risk],
      ['hERG Inhibition', data.prediction.safetyAssessment.hergInhibition.probability, data.prediction.safetyAssessment.hergInhibition.risk],
    ];
    const wsSafety = XLSX.utils.aoa_to_sheet(safetyData);
    XLSX.utils.book_append_sheet(wb, wsSafety, 'Safety Assessment');

    // Sheet 3: Molecular Descriptors
    const descriptorsData = [
      ['Molecular Descriptors'],
      [''],
      ['Descriptor', 'Value'],
      ['Molecular Formula', data.prediction.descriptors.molecularFormula],
      ['Molecular Weight (g/mol)', data.prediction.descriptors.molecularWeight],
      ['LogP', data.prediction.descriptors.logP],
      ['H-Bond Donors', data.prediction.descriptors.hBondDonors],
      ['H-Bond Acceptors', data.prediction.descriptors.hBondAcceptors],
      ['Rotatable Bonds', data.prediction.descriptors.rotatableBonds],
      ['Polar Surface Area (Å²)', data.prediction.descriptors.polarSurfaceArea],
    ];
    const wsDescriptors = XLSX.utils.aoa_to_sheet(descriptorsData);
    XLSX.utils.book_append_sheet(wb, wsDescriptors, 'Descriptors');

    // Sheet 4: Lipinski Rules
    const lipinskiData = [
      ['Lipinski Rules of Five (Drug-likeness)'],
      [''],
      ['Rule', 'Value', 'Limit', 'Operator', 'Status'],
      ...data.lipinskiRules.rules.map(rule => [
        rule.name,
        rule.value,
        rule.limit,
        rule.operator,
        rule.passed ? 'PASS' : 'FAIL'
      ]),
      [''],
      ['Overall', '', '', '', `${data.lipinskiRules.passed}/${data.lipinskiRules.total} rules passed`],
    ];
    const wsLipinski = XLSX.utils.aoa_to_sheet(lipinskiData);
    XLSX.utils.book_append_sheet(wb, wsLipinski, 'Lipinski Rules');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerDownload(blob, `${fileName}.xlsx`);
  };

  const downloadPDF = async (data: AnalysisResult, fileName: string, timestamp: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Helper function to check page break
    const checkPageBreak = (requiredSpace: number = 10) => {
      if (yPos + requiredSpace > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246); // Primary blue
    doc.text('BioPredict Safety Analysis Report', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date(timestamp).toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 15;

    // Compound Information Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Compound Information', 14, yPos);
    yPos += 8;

    const compoundData = [
      ['Compound ID', data.compound.id || 'N/A'],
      ['Name', data.compound.name || getMolecularName(data.compound.smiles)],
      ['SMILES', data.compound.smiles || 'N/A'],
      ['Molecular Formula', data.prediction.descriptors.molecularFormula || 'N/A'],
      ['Molecular Weight', data.prediction.descriptors.molecularWeight ? `${data.prediction.descriptors.molecularWeight.toFixed(2)} g/mol` : 'N/A'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Property', 'Value']],
      body: compoundData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    checkPageBreak(60);

    // Bioactivity Prediction Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Bioactivity Prediction', 14, yPos);
    yPos += 8;

    const bioactivityData = [
      ['pIC50 Value', data.prediction.pic50 ? data.prediction.pic50.toFixed(3) : 'N/A'],
      ['Confidence Level', data.prediction.confidence ? `${(data.prediction.confidence * 100).toFixed(1)}%` : 'N/A'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: bioactivityData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    checkPageBreak(80);

    // Safety Assessment Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Safety Assessment', 14, yPos);
    yPos += 8;

    const safetyOverview = [
      ['Overall Score', data.prediction.safetyAssessment.overallScore ? `${data.prediction.safetyAssessment.overallScore.toFixed(1)}/10` : 'N/A'],
      ['Overall Risk', data.prediction.safetyAssessment.overallRisk ? data.prediction.safetyAssessment.overallRisk.toUpperCase() : 'N/A'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: safetyOverview,
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
    checkPageBreak(50);

    // Toxicity Endpoints
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Toxicity Endpoints', 14, yPos);
    yPos += 6;

    const toxicityData = [
      ['Hepatotoxicity', data.prediction.safetyAssessment.hepatotoxicity?.probability ? `${(data.prediction.safetyAssessment.hepatotoxicity.probability * 100).toFixed(1)}%` : 'N/A', data.prediction.safetyAssessment.hepatotoxicity?.risk || 'N/A'],
      ['Cardiotoxicity', data.prediction.safetyAssessment.cardiotoxicity?.probability ? `${(data.prediction.safetyAssessment.cardiotoxicity.probability * 100).toFixed(1)}%` : 'N/A', data.prediction.safetyAssessment.cardiotoxicity?.risk || 'N/A'],
      ['Mutagenicity', data.prediction.safetyAssessment.mutagenicity?.probability ? `${(data.prediction.safetyAssessment.mutagenicity.probability * 100).toFixed(1)}%` : 'N/A', data.prediction.safetyAssessment.mutagenicity?.risk || 'N/A'],
      ['hERG Inhibition', data.prediction.safetyAssessment.hergInhibition?.probability ? `${(data.prediction.safetyAssessment.hergInhibition.probability * 100).toFixed(1)}%` : 'N/A', data.prediction.safetyAssessment.hergInhibition?.risk || 'N/A'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Endpoint', 'Probability', 'Risk Level']],
      body: toxicityData,
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      margin: { left: 14, right: 14 },
      bodyStyles: {
        cellPadding: 3,
      },
      didParseCell: function(data: any) {
        if (data.column.index === 2 && data.section === 'body') {
          const risk = data.cell.raw as string;
          if (risk.toLowerCase() === 'high') {
            data.cell.styles.textColor = [239, 68, 68]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else if (risk.toLowerCase() === 'medium') {
            data.cell.styles.textColor = [234, 179, 8]; // Yellow
            data.cell.styles.fontStyle = 'bold';
          } else if (risk.toLowerCase() === 'low') {
            data.cell.styles.textColor = [34, 197, 94]; // Green
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    checkPageBreak(60);

    // Molecular Descriptors Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Molecular Descriptors', 14, yPos);
    yPos += 8;

    const descriptorsData = [
      ['LogP (Lipophilicity)', data.prediction.descriptors.logP?.toFixed(2) || 'N/A'],
      ['H-Bond Donors', data.prediction.descriptors.hBondDonors?.toString() || 'N/A'],
      ['H-Bond Acceptors', data.prediction.descriptors.hBondAcceptors?.toString() || 'N/A'],
      ['Rotatable Bonds', data.prediction.descriptors.rotatableBonds?.toString() || 'N/A'],
      ['Polar Surface Area', data.prediction.descriptors.polarSurfaceArea ? `${data.prediction.descriptors.polarSurfaceArea.toFixed(2)} Å²` : 'N/A'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Descriptor', 'Value']],
      body: descriptorsData,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    checkPageBreak(60);

    // Lipinski Rules Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Lipinski's Rule of Five (Drug-likeness)", 14, yPos);
    yPos += 8;

    const lipinskiData = data.lipinskiRules.rules.map(rule => [
      rule.name || 'N/A',
      rule.value !== undefined && rule.value !== null ? rule.value.toString() : 'N/A',
      `${rule.operator || ''} ${rule.limit !== undefined ? rule.limit : 'N/A'}`,
      rule.passed ? '✓ PASS' : '✗ FAIL'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Rule', 'Value', 'Limit', 'Status']],
      body: lipinskiData,
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246], textColor: 255 },
      margin: { left: 14, right: 14 },
      didParseCell: function(data: any) {
        if (data.column.index === 3 && data.section === 'body') {
          const status = data.cell.raw as string;
          if (status.includes('PASS')) {
            data.cell.styles.textColor = [34, 197, 94]; // Green
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [239, 68, 68]; // Red
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
    
    // Overall Assessment
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const overallText = `Overall: ${data.lipinskiRules.passed}/${data.lipinskiRules.total} rules passed`;
    const drugLikeText = data.lipinskiRules.passed === data.lipinskiRules.total ? 'Drug-like ✓' : 'Not drug-like ✗';
    doc.text(overallText, 14, yPos);
    doc.setTextColor(data.lipinskiRules.passed === data.lipinskiRules.total ? 34 : 239, 
                    data.lipinskiRules.passed === data.lipinskiRules.total ? 197 : 68, 
                    data.lipinskiRules.passed === data.lipinskiRules.total ? 94 : 68);
    doc.text(drugLikeText, 80, yPos);

    // Footer
    const totalPages = doc.getNumberOfPages();
    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text('Generated by BioPredict Safety Platform', pageWidth / 2, pageHeight - 6, { align: 'center' });
    }

    // Save PDF
    const pdfBlob = doc.output('blob');
    triggerDownload(pdfBlob, `${fileName}.pdf`);
  };

  // Helper function to trigger download
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading export options...</p>
        </div>
      </div>
    );
  }

  if (!currentAnalysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <Card className="border-2 border-dashed border-border/50">
              <CardContent className="pt-16 pb-16 text-center">
                <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold mb-3">No Data to Export</h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Before you can export results, you need to analyze a compound first.
                  The export will include bioactivity predictions, safety assessment,
                  and drug-likeness evaluation.
                </p>
                <Link href="/analyze">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600">
                    <FlaskConical className="mr-2 w-5 h-5" />
                    Analyze a Compound
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Export Results</h1>
              <p className="text-muted-foreground">
                Download comprehensive analysis report in your preferred format
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Export Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Analysis Summary */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Analysis Ready for Export</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Compound:</span>
                  <span className="font-semibold">{currentAnalysis.compound.name || 'Unnamed'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">SMILES:</span>
                  <span className="font-mono text-xs">{currentAnalysis.compound.smiles}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Safety Score:</span>
                  <Badge variant="outline">
                    {currentAnalysis.prediction.safetyAssessment.overallScore.toFixed(1)}/10
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Drug-likeness:</span>
                  <Badge variant={currentAnalysis.lipinskiRules.passed === currentAnalysis.lipinskiRules.total ? "default" : "secondary"}>
                    {currentAnalysis.lipinskiRules.passed}/{currentAnalysis.lipinskiRules.total} Rules
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Export Formats */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* CSV Export */}
              <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <CardContent className="pt-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold mb-2">CSV Format</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Comma-separated values for spreadsheet applications
                  </p>
                  <Button
                    onClick={() => handleExport('csv')}
                    disabled={exportingFormat !== null}
                    className="w-full"
                    variant="outline"
                  >
                    {exportingFormat === 'csv' ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 w-4 h-4" />
                        Export CSV
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Excel Export */}
              <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <CardContent className="pt-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Excel Format</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Microsoft Excel workbook with formatted data
                  </p>
                  <Button
                    onClick={() => handleExport('excel')}
                    disabled={exportingFormat !== null}
                    className="w-full"
                    variant="outline"
                  >
                    {exportingFormat === 'excel' ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 w-4 h-4" />
                        Export Excel
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* PDF Export */}
              <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                <CardContent className="pt-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileType className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold mb-2">PDF Report</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Professional report document for sharing
                  </p>
                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={exportingFormat !== null}
                    className="w-full"
                    variant="outline"
                  >
                    {exportingFormat === 'pdf' ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 w-4 h-4" />
                        Export PDF
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* What's Included */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What's Included in Export</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Compound Information
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Compound ID & Name</li>
                      <li>• SMILES notation</li>
                      <li>• Molecular structure data</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Bioactivity Prediction
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• pIC50 value</li>
                      <li>• Confidence score</li>
                      <li>• Target information</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Safety Assessment
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Overall safety score</li>
                      <li>• All toxicity endpoints</li>
                      <li>• Risk classifications</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Drug-likeness
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Lipinski's Rule compliance</li>
                      <li>• Molecular descriptors</li>
                      <li>• Export timestamp</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground mb-1">📊 CSV Files</p>
                  <p>Best for data analysis in Excel, R, or Python. Easy to import into databases.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">📑 Excel Files</p>
                  <p>Formatted workbooks with organized data. Great for presentations and reports.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">📄 PDF Reports</p>
                  <p>Professional documents perfect for sharing with colleagues or regulatory submissions.</p>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                All exports include metadata with timestamp and analysis parameters for reproducibility.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}
