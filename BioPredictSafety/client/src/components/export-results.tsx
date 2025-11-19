import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Code, FileImage } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AnalysisResult } from "@/types/molecular";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface ExportResultsProps {
  analysis: AnalysisResult | null;
  disabled: boolean;
}

export default function ExportResults({ analysis, disabled }: ExportResultsProps) {
  const { toast } = useToast();

  const exportMutation = useMutation({
    mutationFn: async ({ format }: { format: string }) => {
      if (!analysis) throw new Error("No analysis data available");
      
      const response = await apiRequest('POST', '/api/export', {
        format,
        compoundIds: [analysis.compound.id]
      });
      
      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prediction.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Results have been downloaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export results",
        variant: "destructive",
      });
    },
  });

  const handleExport = (format: string) => {
    exportMutation.mutate({ format });
  };

  const buildAdmet = (d: any) => ({
    absorption: d?.tpsa < 90 && d?.logP < 5 ? "favorable" : "moderate",
    distribution: d?.logP >= 3 ? "high tissue distribution likely" : "balanced",
    metabolism: d?.logP >= 3 ? "likely metabolic clearance via CYPs" : "moderate",
    excretion: d?.molecularWeight < 500 ? "primarily renal/hepatic" : "reduced clearance",
  });

  const exportPdf = async () => {
    if (!analysis) {
      toast({ title: "No analysis", description: "Run an analysis first.", variant: "destructive" });
      return;
    }

    const { compound, prediction, lipinskiRules, structure } = analysis;
    const d: any = prediction?.descriptors || {};
    const admet = buildAdmet(d);
    const bioClass = prediction?.pic50 >= 7 ? "Active" : prediction?.pic50 >= 5.5 ? "Moderately Active" : "Inactive";

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;

    // Header
    doc.setFontSize(18);
    doc.text("Bioactivity Prediction Report", pageWidth / 2, y, { align: "center" });
    y += 26;
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    y += 24;

    // Compound summary
    doc.setFontSize(13);
    doc.text("Compound Summary", 40, y);
    y += 12;
    doc.setFontSize(11);
    doc.text([`
Name: ${compound.name || "-"}`,
      `SMILES: ${compound.smiles}`], 40, y);
    y += 30;

    // Images (2D and 3D)
    const imgY = y;
    const imgWidth = 200;
    const imgHeight = 150;
    if (structure?.images?.image2d) {
      try { doc.addImage(structure.images.image2d, "PNG", 40, imgY, imgWidth, imgHeight); } catch {}
    }
    if (structure?.images?.image3d) {
      try { doc.addImage(structure.images.image3d, "PNG", 40 + imgWidth + 20, imgY, imgWidth, imgHeight); } catch {}
    }
    y = imgY + imgHeight + 20;

    // Predictions table
    // @ts-ignore - autotable is added via side-effect import
    doc.autoTable({
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["pIC50", String(prediction?.pic50 ?? "-")],
        ["Bioactivity Class", bioClass],
        ["Confidence", prediction?.confidence != null ? `${Math.round(prediction.confidence * 100)}%` : "-"],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [32, 82, 149] },
      theme: "striped",
      margin: { left: 40, right: 40 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 16;

    // Descriptors table
    // @ts-ignore
    doc.autoTable({
      startY: y,
      head: [["Descriptor", "Value"]],
      body: [
        ["LogP", String(d?.logP ?? "-")],
        ["Molecular Weight", String(d?.molecularWeight ?? "-")],
        ["TPSA", String(d?.tpsa ?? "-")],
        ["Rotatable Bonds", String(d?.rotatableBonds ?? "-")],
        ["HBD", String(d?.hbdCount ?? "-")],
        ["HBA", String(d?.hbaCount ?? "-")],
        ["Rings", String(d?.ringCount ?? "-")],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [32, 82, 149] },
      theme: "striped",
      margin: { left: 40, right: 40 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 16;

    // Safety table
    const s: any = prediction?.safetyAssessment || {};
    // @ts-ignore
    doc.autoTable({
      startY: y,
      head: [["Safety Endpoint", "Risk", "Probability"]],
      body: [
        ["Overall", String(s?.overallRisk ?? "-"), String(s?.overallScore ?? "-")],
        ["Hepatotoxicity", String(s?.hepatotoxicity?.risk ?? "-"), s?.hepatotoxicity?.probability != null ? String(s.hepatotoxicity.probability) : "-"],
        ["Cardiotoxicity", String(s?.cardiotoxicity?.risk ?? "-"), s?.cardiotoxicity?.probability != null ? String(s.cardiotoxicity.probability) : "-"],
        ["Mutagenicity", String(s?.mutagenicity?.risk ?? "-"), s?.mutagenicity?.probability != null ? String(s.mutagenicity.probability) : "-"],
        ["hERG Inhibition", String(s?.hergInhibition?.risk ?? "-"), s?.hergInhibition?.probability != null ? String(s.hergInhibition.probability) : "-"],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [32, 82, 149] },
      theme: "striped",
      margin: { left: 40, right: 40 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 16;

    // Lipinski summary
    const lipSummary = lipinskiRules ? `${lipinskiRules.passed}/${lipinskiRules.total} rules passed` : "-";
    doc.setFontSize(12);
    doc.text(`Lipinski Rules: ${lipSummary}`, 40, y);
    y += 20;

    // ADMET summary
    doc.text("ADMET Summary:", 40, y);
    y += 14;
    doc.setFontSize(10);
    doc.text([`Absorption: ${admet.absorption}`, `Distribution: ${admet.distribution}`, `Metabolism: ${admet.metabolism}`, `Excretion: ${admet.excretion}`], 40, y);

    doc.save(`${compound.name || compound.smiles || 'prediction'}.pdf`);
  };

  return (
    <Card data-testid="card-export-results">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Download className="mr-2 text-primary" />
          Export Results
        </h3>
        
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => handleExport('csv')}
            disabled={disabled || exportMutation.isPending}
            data-testid="button-export-csv"
          >
            <div className="flex items-center">
              <div>
                <div className="font-medium text-sm text-left">CSV Report</div>
                <div className="text-xs text-muted-foreground text-left">Tabular data format</div>
              </div>
            </div>
            <FileText className="h-5 w-5 text-primary" />
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => handleExport('json')}
            disabled={disabled || exportMutation.isPending}
            data-testid="button-export-json"
          >
            <div className="flex items-center">
              <div>
                <div className="font-medium text-sm text-left">JSON Data</div>
                <div className="text-xs text-muted-foreground text-left">Machine-readable format</div>
              </div>
            </div>
            <Code className="h-5 w-5 text-primary" />
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={exportPdf}
            disabled={disabled}
            data-testid="button-export-pdf"
          >
            <div className="flex items-center">
              <div>
                <div className="font-medium text-sm text-left">PDF Report</div>
                <div className="text-xs text-muted-foreground text-left">Formatted document</div>
              </div>
            </div>
            <FileImage className="h-5 w-5 text-primary" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
