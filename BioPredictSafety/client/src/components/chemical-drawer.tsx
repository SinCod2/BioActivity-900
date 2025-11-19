import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChemicalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyze: (data: { smiles?: string; molfile?: string; inchi?: string }) => void;
}

interface Atom {
  id: string;
  x: number;
  y: number;
  element: string;
}

interface Bond {
  id: string;
  atom1Id: string;
  atom2Id: string;
  type: 'single' | 'double' | 'triple';
}

interface MoleculeStructure {
  atoms: Atom[];
  bonds: Bond[];
}

type DrawMode = 'bond-single' | 'bond-double' | 'bond-triple' | 'atom' | 'erase' | 'ring3' | 'ring4' | 'ring5' | 'ring6';

export default function ChemicalDrawer({ open, onOpenChange, onAnalyze }: ChemicalDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('bond-single');
  const [selectedAtom, setSelectedAtom] = useState<string>('C');
  const [molecule, setMolecule] = useState<MoleculeStructure>({ atoms: [], bonds: [] });
  const [history, setHistory] = useState<MoleculeStructure[]>([]);
  const [tempAtom, setTempAtom] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStartAtom, setDragStartAtom] = useState<Atom | null>(null);
  // New: support simple two-click bond creation
  const [bondStartAtom, setBondStartAtom] = useState<Atom | null>(null);
  const [exportFormat, setExportFormat] = useState<'smiles' | 'mol' | 'inchi'>('mol');
  const [hoverAtom, setHoverAtom] = useState<string | null>(null);
  const [mode, setMode] = useState<string>('broadband');
  const { toast } = useToast();

  const CANVAS_WIDTH = 850;
  const CANVAS_HEIGHT = 480;
  const BOND_LENGTH = 40;
  const ATOM_RADIUS = 15;

  const drawMolecule = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Different backgrounds and grid styles based on mode
    if (mode === 'broadband') {
      // Broadband mode - Standard gradient with regular grid
      const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.5, '#f8fafc');
      gradient.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Standard grid
      const gridSize = 20;
      const majorGridSize = 100;
      
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
      
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      for (let x = 0; x <= CANVAS_WIDTH; x += majorGridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += majorGridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    } else if (mode === 'precision') {
      // Precision mode - Fine grid with graph paper look
      ctx.fillStyle = '#fefefe';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const fineGrid = 10;
      const mediumGrid = 50;
      
      // Very fine grid
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 0.3;
      for (let x = 0; x <= CANVAS_WIDTH; x += fineGrid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += fineGrid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
      
      // Medium grid
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 0.8;
      for (let x = 0; x <= CANVAS_WIDTH; x += mediumGrid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += mediumGrid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    } else if (mode === 'organic') {
      // Organic mode - Warm tones with organic chemistry feel
      const gradient = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 0, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH);
      gradient.addColorStop(0, '#fffbeb');
      gradient.addColorStop(0.5, '#fef3c7');
      gradient.addColorStop(1, '#fde68a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Hexagonal pattern hint with circular grid
      const gridSize = 30;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.4;
      
      for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
      
      // Major accent lines
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      for (let x = 0; x <= CANVAS_WIDTH; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += 120) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    } else if (mode === 'inorganic') {
      // Inorganic mode - Cool tones with crystalline structure
      const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#eff6ff');
      gradient.addColorStop(0.5, '#dbeafe');
      gradient.addColorStop(1, '#bfdbfe');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Crystalline grid pattern
      const gridSize = 25;
      const majorGridSize = 75;
      
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 0.6;
      for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
      
      // Diamond pattern
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.2;
      for (let x = 0; x <= CANVAS_WIDTH; x += majorGridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += majorGridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    }
    
    // Center crosshair (common for all modes)
    ctx.strokeStyle = mode === 'organic' ? '#d97706' : mode === 'inorganic' ? '#2563eb' : '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw bonds with mode-specific styling
    molecule.bonds.forEach(bond => {
      const atom1 = molecule.atoms.find(a => a.id === bond.atom1Id);
      const atom2 = molecule.atoms.find(a => a.id === bond.atom2Id);
      if (!atom1 || !atom2) return;

      // Bond shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();

      if (bond.type === 'single') {
        ctx.moveTo(atom1.x, atom1.y);
        ctx.lineTo(atom2.x, atom2.y);
      } else if (bond.type === 'double') {
        const dx = atom2.x - atom1.x;
        const dy = atom2.y - atom1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const offsetX = (-dy / length) * 3;
        const offsetY = (dx / length) * 3;
        ctx.moveTo(atom1.x + offsetX, atom1.y + offsetY);
        ctx.lineTo(atom2.x + offsetX, atom2.y + offsetY);
        ctx.moveTo(atom1.x - offsetX, atom1.y - offsetY);
        ctx.lineTo(atom2.x - offsetX, atom2.y - offsetY);
      } else if (bond.type === 'triple') {
        const dx = atom2.x - atom1.x;
        const dy = atom2.y - atom1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const offsetX = (-dy / length) * 4;
        const offsetY = (dx / length) * 4;
        ctx.moveTo(atom1.x, atom1.y);
        ctx.lineTo(atom2.x, atom2.y);
        ctx.moveTo(atom1.x + offsetX, atom1.y + offsetY);
        ctx.lineTo(atom2.x + offsetX, atom2.y + offsetY);
        ctx.moveTo(atom1.x - offsetX, atom1.y - offsetY);
        ctx.lineTo(atom2.x - offsetX, atom2.y - offsetY);
      }
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });

    // Draw atoms with enhanced styling
    molecule.atoms.forEach(atom => {
      const connectedBonds = molecule.bonds.filter(b => b.atom1Id === atom.id || b.atom2Id === atom.id);
      if (atom.element !== 'C' || connectedBonds.length === 0) {
        // Atom shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Highlight atom on hover in erase mode
        if (drawMode === 'erase' && hoverAtom === atom.id) {
          ctx.fillStyle = '#fee2e2';
        } else {
          // Gradient fill for atoms
          const atomGradient = ctx.createRadialGradient(atom.x - 3, atom.y - 3, 2, atom.x, atom.y, ATOM_RADIUS);
          atomGradient.addColorStop(0, '#ffffff');
          atomGradient.addColorStop(1, '#f1f5f9');
          ctx.fillStyle = atomGradient;
        }
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, ATOM_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset shadow for stroke
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        if (drawMode === 'erase' && hoverAtom === atom.id) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
        }
        ctx.stroke();
        
        // Element text with better font
        ctx.fillStyle = drawMode === 'erase' && hoverAtom === atom.id ? '#dc2626' : '#0f172a';
        ctx.font = 'bold 15px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(atom.element, atom.x, atom.y);
      } else {
        // Highlight carbon dots in erase mode
        if (drawMode === 'erase' && hoverAtom === atom.id) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(atom.x, atom.y, 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(atom.x, atom.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // Draw temporary bond preview with enhanced style
    if (tempAtom && dragStartAtom) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(59, 130, 246, 0.3)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(dragStartAtom.x, dragStartAtom.y);
      ctx.lineTo(tempAtom.x, tempAtom.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    // Preview for two-click bond creation when not dragging
    if (bondStartAtom && tempAtom && !dragging && drawMode.startsWith('bond-')) {
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(bondStartAtom.x, bondStartAtom.y);
      ctx.lineTo(tempAtom.x, tempAtom.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [molecule, tempAtom, dragStartAtom, bondStartAtom, hoverAtom, drawMode, mode, dragging]);

  useEffect(() => {
    drawMolecule();
  }, [drawMolecule]);

  const findAtomAtPosition = (x: number, y: number): Atom | null => {
    return molecule.atoms.find(atom => {
      const distance = Math.sqrt((atom.x - x) ** 2 + (atom.y - y) ** 2);
      return distance <= ATOM_RADIUS;
    }) || null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedAtom = findAtomAtPosition(x, y);

    // Erase mode
    if (drawMode === 'erase' && clickedAtom) {
      setHistory([...history, molecule]);
      setMolecule(prev => ({
        atoms: prev.atoms.filter(a => a.id !== clickedAtom.id),
        bonds: prev.bonds.filter(b => b.atom1Id !== clickedAtom.id && b.atom2Id !== clickedAtom.id)
      }));
      return;
    }

    // Two-click bond creation (alternative to drag)
    if (drawMode.startsWith('bond-')) {
      const bondType = drawMode.replace('bond-', '') as 'single' | 'double' | 'triple';
      if (!bondStartAtom) {
        // First click
        if (clickedAtom) {
          setBondStartAtom(clickedAtom);
        } else {
          const newAtom: Atom = { id: `atom-${Date.now()}`, x, y, element: 'C' };
          setMolecule(prev => ({ ...prev, atoms: [...prev.atoms, newAtom] }));
          setBondStartAtom(newAtom);
        }
      } else {
        // Second click
        if (clickedAtom && clickedAtom.id !== bondStartAtom.id) {
          const newBond: Bond = { id: `bond-${Date.now()}`, atom1Id: bondStartAtom.id, atom2Id: clickedAtom.id, type: bondType };
          setMolecule(prev => ({ ...prev, bonds: [...prev.bonds, newBond] }));
        } else if (!clickedAtom) {
          const newAtom: Atom = { id: `atom-${Date.now()}`, x, y, element: 'C' };
          const newBond: Bond = { id: `bond-${Date.now()}-b`, atom1Id: bondStartAtom.id, atom2Id: newAtom.id, type: bondType };
          setMolecule(prev => ({ atoms: [...prev.atoms, newAtom], bonds: [...prev.bonds, newBond] }));
        }
        setBondStartAtom(null);
        setTempAtom(null);
      }
      return;
    }

    if (drawMode === 'atom') {
      if (clickedAtom) {
        setMolecule(prev => ({
          ...prev,
          atoms: prev.atoms.map(a => a.id === clickedAtom.id ? { ...a, element: selectedAtom } : a)
        }));
      } else {
        const newAtom: Atom = { id: `atom-${Date.now()}`, x, y, element: selectedAtom };
        setMolecule(prev => ({ ...prev, atoms: [...prev.atoms, newAtom] }));
      }
      return;
    }

    if (drawMode.startsWith('ring')) {
      const ringSize = parseInt(drawMode.replace('ring', ''));
      const newAtoms: Atom[] = [];
      const newBonds: Bond[] = [];
      const radius = BOND_LENGTH;
      const angleStep = (2 * Math.PI) / ringSize;

      for (let i = 0; i < ringSize; i++) {
        const angle = i * angleStep - Math.PI / 2;
        newAtoms.push({
          id: `atom-${Date.now()}-${i}`,
          x: x + radius * Math.cos(angle),
          y: y + radius * Math.sin(angle),
          element: 'C'
        });
      }

      for (let i = 0; i < ringSize; i++) {
        newBonds.push({
          id: `bond-${Date.now()}-${i}`,
          atom1Id: newAtoms[i].id,
          atom2Id: newAtoms[(i + 1) % ringSize].id,
          type: i % 2 === 0 && ringSize === 6 ? 'double' : 'single'
        });
      }

      setMolecule(prev => ({
        atoms: [...prev.atoms, ...newAtoms],
        bonds: [...prev.bonds, ...newBonds]
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode.startsWith('bond-')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedAtom = findAtomAtPosition(x, y);

    if (clickedAtom || molecule.atoms.length === 0) {
      setDragging(true);
      if (clickedAtom) {
        setDragStartAtom(clickedAtom);
      } else {
        const newAtom: Atom = { id: `atom-${Date.now()}`, x, y, element: 'C' };
        setMolecule(prev => ({ ...prev, atoms: [newAtom] }));
        setDragStartAtom(newAtom);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update hover state for erase mode
    if (drawMode === 'erase') {
      const hoveredAtom = findAtomAtPosition(x, y);
      setHoverAtom(hoveredAtom ? hoveredAtom.id : null);
    } else {
      setHoverAtom(null);
    }
    
    // Bond drag preview
    if (dragging && drawMode.startsWith('bond-')) {
      setTempAtom({ x, y });
      return;
    }
    // Two-click bond preview
    if (!dragging && bondStartAtom && drawMode.startsWith('bond-')) {
      setTempAtom({ x, y });
      return;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !drawMode.startsWith('bond-') || !dragStartAtom) {
      setDragging(false);
      setTempAtom(null);
      setDragStartAtom(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const endAtom = findAtomAtPosition(x, y);

    if (endAtom && endAtom.id !== dragStartAtom.id) {
      const bondType = drawMode.replace('bond-', '') as 'single' | 'double' | 'triple';
      const newBond: Bond = { id: `bond-${Date.now()}`, atom1Id: dragStartAtom.id, atom2Id: endAtom.id, type: bondType };
      setMolecule(prev => ({ ...prev, bonds: [...prev.bonds, newBond] }));
    } else if (!endAtom && Math.sqrt((x - dragStartAtom.x) ** 2 + (y - dragStartAtom.y) ** 2) > 20) {
      const newAtom: Atom = { id: `atom-${Date.now()}`, x, y, element: 'C' };
      const bondType = drawMode.replace('bond-', '') as 'single' | 'double' | 'triple';
      const newBond: Bond = { id: `bond-${Date.now()}-b`, atom1Id: dragStartAtom.id, atom2Id: newAtom.id, type: bondType };
      setMolecule(prev => ({ atoms: [...prev.atoms, newAtom], bonds: [...prev.bonds, newBond] }));
    }

    setDragging(false);
    setTempAtom(null);
    setDragStartAtom(null);
    setBondStartAtom(null);
  };

  const handleClear = () => {
    setHistory([...history, molecule]);
    setMolecule({ atoms: [], bonds: [] });
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setMolecule(previous);
      toast({ title: "Undone", description: "Reverted to previous state" });
    } else {
      toast({ title: "Nothing to undo", variant: "default" });
    }
  };

  const handleFlipHorizontal = () => {
    const centerX = CANVAS_WIDTH / 2;
    setHistory([...history, molecule]);
    setMolecule({
      atoms: molecule.atoms.map(atom => ({
        ...atom,
        x: centerX - (atom.x - centerX)
      })),
      bonds: molecule.bonds
    });
  };

  const handleRotate = () => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    setHistory([...history, molecule]);
    setMolecule({
      atoms: molecule.atoms.map(atom => {
        const dx = atom.x - centerX;
        const dy = atom.y - centerY;
        return {
          ...atom,
          x: centerX - dy,
          y: centerY + dx
        };
      }),
      bonds: molecule.bonds
    });
  };

  // Placeholder tool actions now implemented
  const addChain = (length: number = 5) => {
    const centerX = CANVAS_WIDTH / 2 - (length * BOND_LENGTH) / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const newAtoms: Atom[] = [];
    const newBonds: Bond[] = [];
    for (let i = 0; i < length; i++) {
      newAtoms.push({ id: `atom-${Date.now()}-${i}`, x: centerX + i * BOND_LENGTH, y: centerY + (i % 2 === 0 ? 0 : 10), element: 'C' });
      if (i > 0) {
        newBonds.push({ id: `bond-${Date.now()}-${i}`, atom1Id: newAtoms[i - 1].id, atom2Id: newAtoms[i].id, type: 'single' });
      }
    }
    setMolecule(prev => ({ atoms: [...prev.atoms, ...newAtoms], bonds: [...prev.bonds, ...newBonds] }));
  };

  const addAromaticRing = () => {
    // Create a benzene-like ring with alternating double bonds
    const ringSize = 6;
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const radius = BOND_LENGTH;
    const angleStep = (2 * Math.PI) / ringSize;
    const newAtoms: Atom[] = [];
    const newBonds: Bond[] = [];
    for (let i = 0; i < ringSize; i++) {
      const angle = i * angleStep - Math.PI / 2;
      newAtoms.push({ id: `atom-${Date.now()}-${i}`, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle), element: 'C' });
    }
    for (let i = 0; i < ringSize; i++) {
      newBonds.push({ id: `bond-${Date.now()}-${i}`, atom1Id: newAtoms[i].id, atom2Id: newAtoms[(i + 1) % ringSize].id, type: i % 2 === 0 ? 'double' : 'single' });
    }
    setMolecule(prev => ({ atoms: [...prev.atoms, ...newAtoms], bonds: [...prev.bonds, ...newBonds] }));
  };

  const toggleAromatic = () => {
    // Toggle alternating pattern for any 6-member carbon ring (simplistic)
    const carbonIds = molecule.atoms.filter(a => a.element === 'C').map(a => a.id);
    // Find cycles of length 6 (naive: any set of 6 carbons connected in a loop)
    // Simplify: if total carbons >=6, just toggle first 6 sequentially by position order.
    if (carbonIds.length < 6) return;
    const target = carbonIds.slice(0, 6);
    setMolecule(prev => ({
      ...prev,
      bonds: prev.bonds.map((b, i) => {
        const inTarget = target.includes(b.atom1Id) && target.includes(b.atom2Id);
        if (!inTarget) return b;
        // Toggle: double->single, single->double for alternating indices
        if (i % 2 === 0) {
          return { ...b, type: b.type === 'double' ? 'single' : 'double' };
        }
        return b;
      })
    }));
  };

  const addFunctionalGroup = (group: string) => {
    setHistory([...history, molecule]);
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    
    let newAtoms: Atom[] = [];
    let newBonds: Bond[] = [];
    
    if (group === 'OH') {
      // Hydroxyl group
      const o = { id: `atom-${Date.now()}`, x: centerX, y: centerY, element: 'O' };
      const h = { id: `atom-${Date.now() + 1}`, x: centerX + 30, y: centerY, element: 'H' };
      newAtoms = [o, h];
      newBonds = [{ id: `bond-${Date.now()}`, atom1Id: o.id, atom2Id: h.id, type: 'single' as const }];
    } else if (group === 'CHO') {
      // Aldehyde group
      const c = { id: `atom-${Date.now()}`, x: centerX, y: centerY, element: 'C' };
      const o = { id: `atom-${Date.now() + 1}`, x: centerX, y: centerY - 30, element: 'O' };
      const h = { id: `atom-${Date.now() + 2}`, x: centerX + 30, y: centerY, element: 'H' };
      newAtoms = [c, o, h];
      newBonds = [
        { id: `bond-${Date.now()}`, atom1Id: c.id, atom2Id: o.id, type: 'double' as const },
        { id: `bond-${Date.now() + 1}`, atom1Id: c.id, atom2Id: h.id, type: 'single' as const }
      ];
    } else if (group === 'COOH') {
      // Carboxylic acid
      const c = { id: `atom-${Date.now()}`, x: centerX, y: centerY, element: 'C' };
      const o1 = { id: `atom-${Date.now() + 1}`, x: centerX, y: centerY - 30, element: 'O' };
      const o2 = { id: `atom-${Date.now() + 2}`, x: centerX + 30, y: centerY, element: 'O' };
      const h = { id: `atom-${Date.now() + 3}`, x: centerX + 50, y: centerY, element: 'H' };
      newAtoms = [c, o1, o2, h];
      newBonds = [
        { id: `bond-${Date.now()}`, atom1Id: c.id, atom2Id: o1.id, type: 'double' as const },
        { id: `bond-${Date.now() + 1}`, atom1Id: c.id, atom2Id: o2.id, type: 'single' as const },
        { id: `bond-${Date.now() + 2}`, atom1Id: o2.id, atom2Id: h.id, type: 'single' as const }
      ];
    }
    
    setMolecule(prev => ({
      atoms: [...prev.atoms, ...newAtoms],
      bonds: [...prev.bonds, ...newBonds]
    }));
    toast({ title: "Added", description: `${group} group added` });
  };

  const generateSMILES = (): string => {
    if (molecule.atoms.length === 0) return '';
    let smiles = '';
    const visited = new Set<string>();
    
    const dfs = (atomId: string, parentId: string | null = null): void => {
      if (visited.has(atomId)) return;
      visited.add(atomId);
      const atom = molecule.atoms.find(a => a.id === atomId);
      if (!atom) return;
      smiles += atom.element !== 'C' ? `[${atom.element}]` : 'C';
      const bonds = molecule.bonds.filter(b => 
        (b.atom1Id === atomId || b.atom2Id === atomId) && 
        (parentId === null || (b.atom1Id !== parentId && b.atom2Id !== parentId))
      );
      bonds.forEach((bond, index) => {
        const nextAtomId = bond.atom1Id === atomId ? bond.atom2Id : bond.atom1Id;
        if (!visited.has(nextAtomId)) {
          if (bond.type === 'double') smiles += '=';
          else if (bond.type === 'triple') smiles += '#';
          if (index > 0) smiles += '(';
          dfs(nextAtomId, atomId);
          if (index > 0) smiles += ')';
        }
      });
    };

    if (molecule.atoms.length > 0) dfs(molecule.atoms[0].id);
    return smiles || 'C';
  };

  const generateMOLFile = (): string => {
    const header = `\n  Generated\n\n${molecule.atoms.length.toString().padStart(3, ' ')}${molecule.bonds.length.toString().padStart(3, ' ')}  0  0  0  0  0  0  0  0999 V2000\n`;
    let atomBlock = '';
    molecule.atoms.forEach(atom => {
      const x = ((atom.x - CANVAS_WIDTH / 2) / 20).toFixed(4).padStart(10, ' ');
      const y = (-(atom.y - CANVAS_HEIGHT / 2) / 20).toFixed(4).padStart(10, ' ');
      const z = '0.0000'.padStart(10, ' ');
      atomBlock += `${x}${y}${z} ${atom.element.padEnd(3, ' ')} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
    });
    let bondBlock = '';
    molecule.bonds.forEach(bond => {
      const atom1Index = molecule.atoms.findIndex(a => a.id === bond.atom1Id) + 1;
      const atom2Index = molecule.atoms.findIndex(a => a.id === bond.atom2Id) + 1;
      const bondType = bond.type === 'single' ? 1 : bond.type === 'double' ? 2 : 3;
      bondBlock += `${atom1Index.toString().padStart(3, ' ')}${atom2Index.toString().padStart(3, ' ')}  ${bondType}  0  0  0  0\n`;
    });
    return header + atomBlock + bondBlock + 'M  END\n';
  };

  const handleExport = () => {
    if (molecule.atoms.length === 0) {
      toast({ title: 'Empty Structure', description: 'Please draw a structure first.', variant: 'destructive' });
      return;
    }
    const content = exportFormat === 'smiles' ? generateSMILES() : generateMOLFile();
    const filename = exportFormat === 'smiles' ? 'structure.smi' : 'structure.mol';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Successful', description: `Exported as ${filename}` });
  };

  const handleAnalyze = () => {
    if (molecule.atoms.length === 0) {
      toast({ title: 'Empty Structure', description: 'Please draw a structure.', variant: 'destructive' });
      return;
    }
    onAnalyze({ smiles: generateSMILES(), molfile: generateMOLFile() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] max-h-[95vh] p-0 gap-0 bg-gradient-to-br from-slate-50 via-white to-blue-50 border-2 border-blue-200 shadow-2xl overflow-hidden">
        <div className="flex flex-col h-[95vh]">
          {/* Advanced Header */}
          <div className="relative px-6 py-4 border-b border-blue-100 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 flex-shrink-0">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/30 rounded-xl blur-lg" />
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <svg className="w-7 h-7 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight drop-shadow-md">Chemical Structure Editor</h2>
                  <p className="text-xs text-blue-100 mt-0.5">Draw and analyze molecular structures</p>
                </div>
              </div>
              {/* Removed duplicate custom close button to keep only one X icon */}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Advanced Left Panel */}
            <div className="w-[380px] border-r border-blue-100 flex flex-col bg-gradient-to-b from-white to-slate-50 shadow-lg overflow-y-auto">
              {/* Format Selection */}
              <div className="flex gap-3 p-4 border-b border-blue-100 bg-white/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Mode</label>
                  <select 
                    value={mode} 
                    onChange={(e) => setMode(e.target.value)} 
                    style={{ color: '#1e293b', backgroundColor: 'white' }}
                    className="w-full h-10 px-4 border-2 border-blue-200 rounded-xl text-sm bg-white shadow-sm hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                  >
                    <option value="broadband" style={{ color: '#1e293b', backgroundColor: 'white', padding: '8px' }}>Broadband</option>
                    <option value="precision" style={{ color: '#1e293b', backgroundColor: 'white', padding: '8px' }}>Precision</option>
                    <option value="organic" style={{ color: '#1e293b', backgroundColor: 'white', padding: '8px' }}>Organic</option>
                    <option value="inorganic" style={{ color: '#1e293b', backgroundColor: 'white', padding: '8px' }}>Inorganic</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Export</label>
                  <div className="flex gap-2">
                    <select 
                      value={exportFormat} 
                      onChange={(e) => setExportFormat(e.target.value as any)} 
                      style={{ color: '#1e293b', backgroundColor: 'white' }}
                      className="flex-1 h-10 px-3 border-2 border-blue-200 rounded-xl text-sm bg-white shadow-sm hover:border-blue-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                    >
                      <option value="smiles" style={{ color: '#1e293b', backgroundColor: 'white', padding: '8px' }}>SMILES</option>
                      <option value="mol" style={{ color: '#1e293b', backgroundColor: 'white', padding: '8px' }}>MOL</option>
                    </select>
                    <button
                      onClick={handleExport}
                      className="h-10 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawing Tools Section */}
              <div className="p-4 border-b border-blue-100 bg-gradient-to-br from-white to-blue-50/30 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
                  <h3 className="text-sm font-bold text-gray-800 tracking-wide">DRAWING TOOLS</h3>
                </div>
                <div className="grid grid-cols-9 gap-1.5">
                  <button onClick={handleClear} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-xs font-bold text-gray-800 transition-all shadow-sm">New</button>
                  <button onClick={handleUndo} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-xs font-bold text-gray-800 transition-all shadow-sm">Udo</button>
                  <button onClick={handleClear} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-xs font-bold text-gray-800 transition-all shadow-sm">Cln</button>
                  <button onClick={() => toast({ title: 'Style', description: 'Style options coming soon' })} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-xs font-bold text-gray-800 transition-all shadow-sm">Sty</button>
                  <button onClick={() => setDrawMode('erase')} className={`h-8 border rounded font-bold transition-all shadow-sm ${drawMode === 'erase' ? 'bg-gradient-to-b from-red-500 to-red-600 text-white border-red-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-red-50 hover:to-red-100 hover:border-red-400 text-gray-800'} text-xs`}>Del</button>
                  <button onClick={() => toast({ title: 'Query', description: 'Query mode coming soon' })} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-xs font-bold text-gray-800 transition-all shadow-sm">Qry</button>
                  <button onClick={handleFlipHorizontal} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">⬌</button>
                  <button onClick={handleRotate} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">↻</button>
                  <button onClick={() => toast({ title: 'Charge', description: 'Select an atom first to add charge' })} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">±</button>

                  <button onClick={() => setDrawMode('bond-single')} className={`h-8 border rounded font-bold transition-all shadow-sm ${drawMode === 'bond-single' ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white border-blue-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 text-gray-800'} text-base`}>—</button>
                  <button onClick={() => setDrawMode('bond-double')} className={`h-8 border rounded font-bold transition-all shadow-sm ${drawMode === 'bond-double' ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white border-blue-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 text-gray-800'} text-base`}>=</button>
                  <button onClick={() => setDrawMode('bond-triple')} className={`h-8 border rounded font-bold transition-all shadow-sm ${drawMode === 'bond-triple' ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white border-blue-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 text-gray-800'} text-base`}>≡</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">◄</button>
                  <button onClick={() => { addChain(6); toast({ title: 'Chain Added', description: 'Added 6-carbon chain' }); }} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">···</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">—</button>
                  <button onClick={() => { addAromaticRing(); toast({ title: 'Aromatic Ring', description: 'Added benzene ring' }); }} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">∞</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">~</button>
                  <button onClick={() => { toggleAromatic(); toast({ title: 'Aromatic Toggled', description: 'Tried toggling aromatic pattern' }); }} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-blue-50 hover:to-blue-100 hover:border-blue-400 rounded text-xs font-bold text-gray-800 transition-all shadow-sm">S/A</button>

                  <button onClick={() => setDrawMode('ring3')} className={`h-8 border rounded font-bold transition-all shadow-sm ${drawMode === 'ring3' ? 'bg-gradient-to-b from-green-500 to-green-600 text-white border-green-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-green-50 hover:to-green-100 hover:border-green-400 text-gray-800'} text-sm`}>△</button>
                  <button onClick={() => setDrawMode('ring4')} className={`h-8 border rounded font-bold transition-all shadow-sm ${drawMode === 'ring4' ? 'bg-gradient-to-b from-green-500 to-green-600 text-white border-green-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-green-50 hover:to-green-100 hover:border-green-400 text-gray-800'} text-sm`}>□</button>
                  <button onClick={() => setDrawMode('ring5')} className={`h-8 border rounded font-bold transition-all shadow-sm ${drawMode === 'ring5' ? 'bg-gradient-to-b from-green-500 to-green-600 text-white border-green-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-green-50 hover:to-green-100 hover:border-green-400 text-gray-800'} text-sm`}>⬠</button>
                  <button onClick={() => setDrawMode('ring6')} className={`h-8 border rounded font-bold transition-all shadow-sm ${drawMode === 'ring6' ? 'bg-gradient-to-b from-green-500 to-green-600 text-white border-green-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-green-50 hover:to-green-100 hover:border-green-400 text-gray-800'} text-sm`}>⬡</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-green-50 hover:to-green-100 hover:border-green-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">⭓</button>
                  <button onClick={() => { addAromaticRing(); toast({ title: 'Aromatic Ring', description: 'Added benzene ring' }); }} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-green-50 hover:to-green-100 hover:border-green-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">⬢</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-green-50 hover:to-green-100 hover:border-green-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">⬡</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-purple-50 hover:to-purple-100 hover:border-purple-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">⊞</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-purple-50 hover:to-purple-100 hover:border-purple-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">⊕</button>

                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">~</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">~</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">Y</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">~</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">T</button>
                  <button className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">Y</button>
                  <button onClick={() => addFunctionalGroup('OH')} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-sm font-bold text-gray-800 transition-all shadow-sm">+</button>
                  <button onClick={() => addFunctionalGroup('CHO')} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-[10px] font-bold text-gray-800 transition-all shadow-sm">CHO</button>
                  <button onClick={() => addFunctionalGroup('COOH')} className="h-8 border border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 hover:border-orange-400 rounded text-[10px] font-bold text-gray-800 transition-all shadow-sm">CO₂H</button>
                </div>
              </div>

              {/* Periodic Table Section */}
              <div className="overflow-y-auto p-4 border-b border-blue-100 bg-gradient-to-br from-blue-50/20 to-white" style={{maxHeight: 'calc(100vh - 550px)', minHeight: '200px'}}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full" />
                  <h3 className="text-sm font-bold text-gray-800 tracking-wide">PERIODIC TABLE</h3>
                </div>
                <div className="grid grid-cols-9 gap-1.5 text-xs">
                  {[
                    ['H', '', '', '', '', '', '', '', 'He'],
                    ['Li', 'Be', '', '', 'B', 'C', 'N', 'O', 'F'],
                    ['Na', 'Mg', '', '', 'Al', 'Si', 'P', 'S', 'Cl'],
                    ['K', 'Ca', 'Sc▼', '', 'Ga', 'Ge', 'As', 'Se', 'Br'],
                    ['Rb', 'Sr', 'Y▼', '', 'In', 'Sn', 'Sb', 'Te', 'I'],
                    ['Cs', 'Ba', 'Lu▼', '', 'Tl', 'Pb', 'Bi', 'Po', 'At']
                  ].map((row, i) => (
                    row.map((el, j) => el ? (
                      <button
                        key={`${i}-${j}`}
                        onClick={() => { setSelectedAtom(el.replace('▼', '')); setDrawMode('atom'); }}
                        className={`h-8 border rounded font-bold transition-all shadow-sm ${selectedAtom === el.replace('▼', '') && drawMode === 'atom' ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white border-indigo-600' : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:from-indigo-50 hover:to-indigo-100 hover:border-indigo-400 text-gray-800'} ${el.includes('▼') ? 'text-[10px]' : 'text-sm'}`}
                      >
                        {el}
                      </button>
                    ) : <div key={`${i}-${j}`} />)
                  ))}
                </div>
              </div>
            </div>

            {/* High-Tech Canvas Panel */}
            <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-w-0 relative overflow-hidden">
              {/* Animated tech background */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-grid-slate-400/25 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
                <div className="absolute top-0 bottom-0 left-0 w-px bg-gradient-to-b from-transparent via-indigo-500 to-transparent" />
                <div className="absolute top-0 bottom-0 right-0 w-px bg-gradient-to-b from-transparent via-purple-500 to-transparent" />
              </div>
              
              {/* Corner accents */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-400/50 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-blue-400/50 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-indigo-400/50 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-purple-400/50 rounded-br-lg" />
              
              {/* Canvas info overlay */}
              <div className="absolute top-6 left-6 z-20 bg-black/40 backdrop-blur-md px-3 py-2 rounded-lg border border-cyan-500/30">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-cyan-100 font-medium">Grid: 20px | Major: 100px</span>
                </div>
              </div>
              
              {/* Mode indicator */}
              <div className="absolute top-6 right-6 z-20 bg-black/40 backdrop-blur-md px-3 py-2 rounded-lg border border-blue-500/30">
                <div className="flex items-center gap-2 text-xs">
                  <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  <span className="text-blue-100 font-medium capitalize">{drawMode.replace('-', ' ')}</span>
                </div>
              </div>
              
              <div className="flex-1 p-8 flex items-center justify-center overflow-auto relative z-10">
                <div className="relative group">
                  {/* Holographic glow effect */}
                  <div className="absolute -inset-8 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl opacity-60 group-hover:opacity-80 transition-opacity duration-500 animate-pulse" />
                  <div className="absolute -inset-6 bg-gradient-to-r from-cyan-400/5 via-blue-400/5 to-purple-400/5 rounded-2xl" />
                  
                  {/* Canvas container with tech frame */}
                  <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border-2 border-slate-700/50">
                    <canvas
                      ref={canvasRef}
                      width={CANVAS_WIDTH}
                      height={CANVAS_HEIGHT}
                      className="cursor-crosshair rounded-xl shadow-2xl bg-white relative ring-2 ring-offset-2 ring-offset-slate-900 ring-blue-500/20 hover:ring-blue-400/40 transition-all duration-300"
                      onClick={handleCanvasClick}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={() => { setDragging(false); setTempAtom(null); setDragStartAtom(null); setHoverAtom(null); }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Stats bar */}
              <div className="absolute bottom-20 left-6 right-6 z-20 bg-black/40 backdrop-blur-md px-4 py-2 rounded-lg border border-indigo-500/30">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                      </svg>
                      <span className="text-indigo-200">Atoms: <span className="font-bold text-white">{molecule.atoms.length}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-purple-200">Bonds: <span className="font-bold text-white">{molecule.bonds.length}</span></span>
                    </div>
                  </div>
                  <div className="text-cyan-200 font-mono">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
              
              {/* Advanced Action Bar */}
              <div className="p-5 border-t border-blue-100 bg-white/95 backdrop-blur-sm flex-shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={handleAnalyze} 
                    className="flex-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] h-12 text-base rounded-xl border border-blue-400/20"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Analyze Structure
                  </Button>
                  <Button 
                    onClick={handleClear}
                    className="h-12 px-6 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white border-2 border-rose-400/30 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
