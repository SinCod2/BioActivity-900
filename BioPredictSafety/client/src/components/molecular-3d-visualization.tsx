import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Box, Download, Expand, RotateCw } from "lucide-react";
import { AnalysisResult } from "@/types/molecular";
import { getMolecularName } from "@/lib/molecular-utils";
import { Switch } from "@/components/ui/switch";

interface Molecular3DVisualizationProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
}

// 3D structure types
type Atom3D = { element: string; x: number; y: number; z: number };
type Bond3D = { from: number; to: number; order: number };
type Structure3D = { atoms: Atom3D[]; bonds: Bond3D[] };

export default function Molecular3DVisualization({ analysis, isAnalyzing }: Molecular3DVisualizationProps) {
  const compound = analysis?.compound;
  const prediction = analysis?.prediction;
  const structureData = analysis?.structure;
  const structureImages = structureData?.images;
  const backendStructure = structureData?.coordinates3d || null;
  const static3DImage = structureImages?.image3d || null;
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenViewerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [geminiStructure, setGeminiStructure] = useState<any>(null);
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [useGemini, setUseGemini] = useState(false);

  // Fetch 3D structure from Gemini API when compound changes or AI toggle is enabled
  useEffect(() => {
    if (compound && useGemini && !geminiStructure) {
      setIsLoadingGemini(true);
      fetch('/api/gemini/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          smiles: compound.smiles, 
          name: compound.name 
        })
      })
        .then(res => res.json())
        .then(data => {
          console.log('Gemini API response:', data);
          if (data.success && data.data) {
            setGeminiStructure(data.data);
          } else {
            console.warn('Gemini generation unsuccessful, using fallback');
            // Don't auto-disable, just use local fallback
          }
        })
        .catch(err => {
          console.error('Gemini API error:', err);
          // Don't auto-disable, just use local fallback
        })
        .finally(() => setIsLoadingGemini(false));
    } else if (!useGemini) {
      // Clear Gemini structure when AI is disabled
      setGeminiStructure(null);
    }
  }, [compound, useGemini, geminiStructure]);

  useEffect(() => {
    setGeminiStructure(null);
  }, [compound?.smiles]);

  // Generate 3D coordinates from SMILES (improved algorithm)
  const generate3DStructure = (smiles: string): Structure3D => {
    const atoms: Atom3D[] = [];
    const bonds: Bond3D[] = [];
    
    // Parse SMILES string
    let atomIndex = 0;
    const ringConnections: { [key: string]: number } = {};
    let branchStack: number[] = [];
    let currentAtom = -1;
    
    for (let i = 0; i < smiles.length; i++) {
      const char = smiles[i];
      
      // Handle atoms
      if (/[A-Z]/.test(char) || /[cnops]/.test(char)) { // include aromatic lower-case c,n,o,p,s
        let element = char;
        
        // Handle two-letter elements
        if (i + 1 < smiles.length && /[a-z]/.test(smiles[i + 1]) && /[A-Z]/.test(char)) {
          element += smiles[i + 1];
          i++;
        }
        
        // Map common elements
        const elementMap: { [key: string]: string } = {
          'C': 'C', 'N': 'N', 'O': 'O', 'S': 'S', 'P': 'P',
          'F': 'F', 'Cl': 'Cl', 'Br': 'Br', 'I': 'I', 'H': 'H'
        };
        // Map aromatic lower-case to upper-case equivalents
        if (/[cnops]/.test(element)) {
          element = element.toUpperCase();
        }
        const atomElement = elementMap[element] || 'C';
        atoms.push({ element: atomElement, x: 0, y: 0, z: 0 });
        
        // Connect to previous atom if exists
        if (currentAtom >= 0) {
          bonds.push({ from: currentAtom, to: atomIndex, order: 1 });
        }
        
        currentAtom = atomIndex;
        atomIndex++;
      }
      // Handle double bond
      else if (char === '=') {
        if (bonds.length > 0) {
          bonds[bonds.length - 1].order = 2;
        }
      }
      // Handle triple bond
      else if (char === '#') {
        if (bonds.length > 0) {
          bonds[bonds.length - 1].order = 3;
        }
      }
      // Handle ring closures
      else if (/[0-9]/.test(char)) {
        const ringNum = char;
        if (ringConnections[ringNum] !== undefined) {
          bonds.push({ from: ringConnections[ringNum], to: currentAtom, order: 1 });
          delete ringConnections[ringNum];
        } else {
          ringConnections[ringNum] = currentAtom;
        }
      }
      // Handle branches
      else if (char === '(') {
        branchStack.push(currentAtom);
      }
      else if (char === ')') {
        currentAtom = branchStack.pop() || currentAtom;
      }
    }
    
    // Generate 3D coordinates using force-directed layout
    if (atoms.length === 0) return { atoms, bonds };
    
    // Initialize positions in a spiral for better initial distribution
    const radius = Math.sqrt(atoms.length) * 1.8; // More spread out
    atoms.forEach((atom, i) => {
      const angle = (i / atoms.length) * Math.PI * 4;
      const r = (i / atoms.length) * radius;
      atom.x = Math.cos(angle) * r;
      atom.y = Math.sin(angle) * r;
      atom.z = (i / atoms.length - 0.5) * 3; // More depth
    });
    
    // Apply force-directed algorithm for better layout
    const iterations = 240; // More iterations for better convergence
    const idealBondLength = 2.2; // Longer bonds for better spacing
    const repulsionStrength = 1.5; // Stronger repulsion between atoms
    const springStrength = 0.25; // Stronger spring force for bonds
    const minSeparation = 1.2;
    
    for (let iter = 0; iter < iterations; iter++) {
      const forces = atoms.map(() => ({ x: 0, y: 0, z: 0 }));
      
      // Repulsion between all atoms
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const dx = atoms[j].x - atoms[i].x;
          const dy = atoms[j].y - atoms[i].y;
          const dz = atoms[j].z - atoms[i].z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
          
          const force = repulsionStrength / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;
          
          forces[i].x -= fx;
          forces[i].y -= fy;
          forces[i].z -= fz;
          forces[j].x += fx;
          forces[j].y += fy;
          forces[j].z += fz;

          // Collision avoidance – ensure minimum separation
          if (dist < minSeparation) {
            const push = (minSeparation - dist) * 0.6;
            const px = (dx / dist) * push;
            const py = (dy / dist) * push;
            const pz = (dz / dist) * push;
            forces[i].x -= px; forces[i].y -= py; forces[i].z -= pz;
            forces[j].x += px; forces[j].y += py; forces[j].z += pz;
          }
        }
      }
      
      // Spring forces for bonds
      bonds.forEach((bond: Bond3D) => {
        const i = bond.from;
        const j = bond.to;
        const dx = atoms[j].x - atoms[i].x;
        const dy = atoms[j].y - atoms[i].y;
        const dz = atoms[j].z - atoms[i].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
        
        const displacement = dist - idealBondLength;
        const force = displacement * springStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        
        forces[i].x += fx;
        forces[i].y += fy;
        forces[i].z += fz;
        forces[j].x -= fx;
        forces[j].y -= fy;
        forces[j].z -= fz;
      });
      
      // Apply forces with adaptive damping
      const damping = 0.55 - (iter / iterations) * 0.35; // Decrease damping over time for settling
      atoms.forEach((atom, i) => {
        atom.x += forces[i].x * damping;
        atom.y += forces[i].y * damping;
        atom.z += forces[i].z * damping;
      });
    }
    
    // Calculate bounds for proper centering and scaling
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    atoms.forEach(atom => {
      minX = Math.min(minX, atom.x);
      maxX = Math.max(maxX, atom.x);
      minY = Math.min(minY, atom.y);
      maxY = Math.max(maxY, atom.y);
      minZ = Math.min(minZ, atom.z);
      maxZ = Math.max(maxZ, atom.z);
    });
    
    // Calculate scale to fit in reasonable bounds
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const depth = maxZ - minZ || 1;
    const maxDim = Math.max(width, height, depth);
    const targetSize = 2.0; // Target size for the molecule
    const scale = (maxDim > 0) ? targetSize / maxDim : 1;
    
    // Center and scale the molecule
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    atoms.forEach(atom => {
      atom.x = (atom.x - centerX) * scale;
      atom.y = (atom.y - centerY) * scale;
      atom.z = (atom.z - centerZ) * scale;
    });
    
    return { atoms, bonds };
  };

  const pubchemStructure: Structure3D | null = backendStructure && Array.isArray(backendStructure.atoms)
    && Array.isArray(backendStructure.bonds)
    ? (backendStructure as Structure3D)
    : null;

  const structure: Structure3D | null = compound ? (
    geminiStructure && Array.isArray(geminiStructure.atoms) && Array.isArray(geminiStructure.bonds)
      ? (geminiStructure as Structure3D)
      : pubchemStructure || generate3DStructure(compound.smiles)
  ) : null;

  const structureSource = geminiStructure ? 'gemini' : (structureData?.source ?? 'computed');

  // High-fidelity viewer using 3Dmol.js (loaded lazily)
  useEffect(() => {
    if (!compound?.smiles) return;
    const mount3Dmol = () => {
      try {
        if (!viewerContainerRef.current) return;
        const element = viewerContainerRef.current.querySelector('.three-dmol-viewer');
        if (!element || !(window as any).$3Dmol) return;
        // Clear previous content
        element.innerHTML = '';
        const viewer = new (window as any).$3Dmol.GLViewer(element, { backgroundColor: 'white' });
        viewer.addModel(compound.smiles, 'smiles');
        viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.3 } });
        viewer.zoomTo();
        viewer.render();
      } catch (e) {
        console.warn('3Dmol viewer setup failed', e);
      }
    };
    if (!(window as any).$3Dmol) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/3dmol/build/3Dmol.js';
      script.async = true;
      script.onload = mount3Dmol;
      document.head.appendChild(script);
    } else {
      mount3Dmol();
    }
  }, [compound?.smiles, viewerContainerRef]);

  // Handle mouse interactions for rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    setRotation(prev => ({
      x: prev.x + deltaY * 0.5,
      y: prev.y + deltaX * 0.5,
    }));
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Auto-rotate
  useEffect(() => {
    if (!compound || isFullscreen) return;
    
    const interval = setInterval(() => {
      setRotation(prev => ({
        x: prev.x,
        y: prev.y + 0.5,
      }));
    }, 50);
    
    return () => clearInterval(interval);
  }, [compound, isFullscreen]);

  // Reset rotation
  const handleReset = () => {
    setRotation({ x: 0, y: 0 });
  };

  // Download 3D structure as PNG
  const handleDownload = () => {
    if (!compound) return;

    if (static3DImage) {
      const link = document.createElement('a');
      link.href = static3DImage;
      link.download = `${compound.name || getMolecularName(compound.smiles)}_3d_structure.png`;
      link.click();
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 900;

    // Fill background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw title
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('3D Molecular Structure', canvas.width / 2, 50);

    // Render 3D structure
    if (structure) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 - 50;
      const scale = 120;

      // Draw bonds
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 3;
      structure.bonds.forEach(bond => {
        const from = structure.atoms[bond.from];
        const to = structure.atoms[bond.to];
        
        const fromX = centerX + from.x * scale;
        const fromY = centerY - from.y * scale;
        const toX = centerX + to.x * scale;
        const toY = centerY - to.y * scale;
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
      });

      // Draw atoms
      structure.atoms.forEach(atom => {
        const x = centerX + atom.x * scale;
        const y = centerY - atom.y * scale;
        
        // Atom sphere
        const gradient = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, 25);
        
        switch (atom.element) {
          case 'C':
            gradient.addColorStop(0, '#666666');
            gradient.addColorStop(1, '#333333');
            break;
          case 'O':
            gradient.addColorStop(0, '#ff5555');
            gradient.addColorStop(1, '#cc0000');
            break;
          case 'N':
            gradient.addColorStop(0, '#5555ff');
            gradient.addColorStop(1, '#0000cc');
            break;
          case 'S':
            gradient.addColorStop(0, '#ffff55');
            gradient.addColorStop(1, '#cccc00');
            break;
          default:
            gradient.addColorStop(0, '#999999');
            gradient.addColorStop(1, '#666666');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 25, 0, Math.PI * 2);
        ctx.fill();
        
        // Atom label
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(atom.element, x, y);
      });
    }

    // Add compound info
    ctx.fillStyle = '#4b5563';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    const infoY = canvas.height - 120;
    
    ctx.fillText(compound.name || getMolecularName(compound.smiles), canvas.width / 2, infoY);
    ctx.font = '16px monospace';
    ctx.fillText(`SMILES: ${compound.smiles}`, canvas.width / 2, infoY + 30);
    
    if (prediction) {
      ctx.fillText(
        `Molecular Weight: ${prediction.descriptors.molecularWeight.toFixed(2)} g/mol`,
        canvas.width / 2,
        infoY + 60
      );
    }

    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${compound.name || 'molecule'}_3d_structure.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  // Render 3D structure with proper perspective
  const render3DStructure = (containerRef: React.RefObject<HTMLDivElement>) => {
    if (!structure) return null;

    const viewBoxSize = 500;
    const centerX = viewBoxSize / 2;
    const centerY = viewBoxSize / 2;
    const scale = 50; // Adjusted scale for better spacing


    // Apply 3D rotation transformation
    const rotatePoint = (x: number, y: number, z: number) => {
      // Convert rotation angles to radians
      const angleX = (rotation.x * Math.PI) / 180;
      const angleY = (rotation.y * Math.PI) / 180;
      
      // Rotate around Y axis
      let newX = x * Math.cos(angleY) + z * Math.sin(angleY);
      let newZ = -x * Math.sin(angleY) + z * Math.cos(angleY);
      
      // Rotate around X axis
      let newY = y * Math.cos(angleX) - newZ * Math.sin(angleX);
      newZ = y * Math.sin(angleX) + newZ * Math.cos(angleX);
      
      // Apply perspective
      const perspective = 6; // Increased for less distortion
      const perspectiveFactor = perspective / (perspective + newZ);
      
      return {
        x: centerX + newX * scale * perspectiveFactor,
        y: centerY - newY * scale * perspectiveFactor,
        z: newZ,
        scale: perspectiveFactor
      };
    };

    // Transform all atoms with perspective
    const transformedAtoms = structure.atoms.map((atom: Atom3D) => 
      rotatePoint(atom.x, atom.y, atom.z)
    );

    // Sort bonds and atoms by depth (z-index) for proper rendering
    const bondDepths = structure.bonds.map((bond: Bond3D, i: number) => {
      const fromZ = transformedAtoms[bond.from].z;
      const toZ = transformedAtoms[bond.to].z;
      return { bond, index: i, depth: (fromZ + toZ) / 2 };
    });
    bondDepths.sort((a, b) => a.depth - b.depth);

    const atomDepths = structure.atoms.map((atom: Atom3D, i: number) => ({
      atom,
      index: i,
      depth: transformedAtoms[i].z,
      transformed: transformedAtoms[i]
    }));
    atomDepths.sort((a, b) => a.depth - b.depth);

    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', maxHeight: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
          <filter id="shadowStrong">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.4"/>
          </filter>
          <radialGradient id="carbonGrad">
            <stop offset="0%" stopColor="#888888" />
            <stop offset="100%" stopColor="#444444" />
          </radialGradient>
          <radialGradient id="oxygenGrad">
            <stop offset="0%" stopColor="#ff6666" />
            <stop offset="100%" stopColor="#dd0000" />
          </radialGradient>
          <radialGradient id="nitrogenGrad">
            <stop offset="0%" stopColor="#6666ff" />
            <stop offset="100%" stopColor="#0000dd" />
          </radialGradient>
          <radialGradient id="sulfurGrad">
            <stop offset="0%" stopColor="#ffff66" />
            <stop offset="100%" stopColor="#dddd00" />
          </radialGradient>
          <radialGradient id="hydrogenGrad">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cccccc" />
          </radialGradient>
          <radialGradient id="phosphorusGrad">
            <stop offset="0%" stopColor="#ff8800" />
            <stop offset="100%" stopColor="#cc6600" />
          </radialGradient>
        </defs>

        {/* Draw bonds (back to front) */}
        {bondDepths.map(({ bond, index }: { bond: Bond3D; index: number }) => {
          const fromPos = transformedAtoms[bond.from];
          const toPos = transformedAtoms[bond.to];
          
          // Adjust bond thickness based on depth
          const avgScale = (fromPos.scale + toPos.scale) / 2;
          const strokeWidth = Math.max(3, bond.order * 2.5 * avgScale); // Visible bonds
          
          // Multiple bonds offset
          if (bond.order === 1) {
            return (
              <line
                key={`bond-${index}`}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#6b7280"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={0.7 + avgScale * 0.3}
              />
            );
          } else if (bond.order === 2) {
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const offsetX = (-dy / len) * 3.5; // Slightly larger offset
            const offsetY = (dx / len) * 3.5;
            
            return (
              <g key={`bond-${index}`}>
                <line
                  x1={fromPos.x + offsetX}
                  y1={fromPos.y + offsetY}
                  x2={toPos.x + offsetX}
                  y2={toPos.y + offsetY}
                  stroke="#6b7280"
                  strokeWidth={strokeWidth * 0.8}
                  strokeLinecap="round"
                  opacity={0.7 + avgScale * 0.3}
                />
                <line
                  x1={fromPos.x - offsetX}
                  y1={fromPos.y - offsetY}
                  x2={toPos.x - offsetX}
                  y2={toPos.y - offsetY}
                  stroke="#6b7280"
                  strokeWidth={strokeWidth * 0.8}
                  strokeLinecap="round"
                  opacity={0.7 + avgScale * 0.3}
                />
              </g>
            );
          } else {
            // Triple bond
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const offsetX = (-dy / len) * 4.5;
            const offsetY = (dx / len) * 4.5;
            
            return (
              <g key={`bond-${index}`}>
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke="#6b7280"
                  strokeWidth={strokeWidth * 0.8}
                  strokeLinecap="round"
                  opacity={0.7 + avgScale * 0.3}
                />
                <line
                  x1={fromPos.x + offsetX}
                  y1={fromPos.y + offsetY}
                  x2={toPos.x + offsetX}
                  y2={toPos.y + offsetY}
                  stroke="#6b7280"
                  strokeWidth={strokeWidth * 0.7}
                  strokeLinecap="round"
                  opacity={0.6 + avgScale * 0.3}
                />
                <line
                  x1={fromPos.x - offsetX}
                  y1={fromPos.y - offsetY}
                  x2={toPos.x - offsetX}
                  y2={toPos.y - offsetY}
                  stroke="#6b7280"
                  strokeWidth={strokeWidth * 0.7}
                  strokeLinecap="round"
                  opacity={0.6 + avgScale * 0.3}
                />
              </g>
            );
          }
        })}

        {/* Draw atoms (back to front) */}
        {atomDepths.map(({ atom, index, transformed }: { atom: Atom3D; index: number; transformed: { x: number; y: number; z: number; scale: number } }) => {
          const radius = 16 * transformed.scale; // Slightly smaller for more space
          
          let fill = "url(#carbonGrad)";
          switch (atom.element) {
            case 'O':
              fill = "url(#oxygenGrad)";
              break;
            case 'N':
              fill = "url(#nitrogenGrad)";
              break;
            case 'S':
              fill = "url(#sulfurGrad)";
              break;
            case 'H':
              fill = "url(#hydrogenGrad)";
              break;
            case 'P':
              fill = "url(#phosphorusGrad)";
              break;
          }
          
          return (
            <g key={`atom-${index}`}>
              <circle
                cx={transformed.x}
                cy={transformed.y}
                r={radius}
                fill={fill}
                filter={transformed.scale > 0.9 ? "url(#shadowStrong)" : "url(#shadow)"}
                opacity={0.9 + transformed.scale * 0.1}
              />
              <text
                x={transformed.x}
                y={transformed.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={Math.max(12, 14 * transformed.scale)}
                fontWeight="bold"
              >
                {atom.element}
              </text>
            </g>
          );
        })}

        {/* Overlay: SMILES and Molecular Weight inside the image area */}
        {compound && (
          <g>
            {/* Top-right MW badge */}
            <g transform={`translate(${viewBoxSize - 10}, 10)`}>
              <g transform="translate(-160, 0)">
                <rect x={0} y={0} width={170} height={28} rx={8} ry={8} fill="#ffffff" opacity={0.6} />
                <text x={10} y={19} fontSize={12} fontWeight="700" fill="#0f172a">
                  MW: {prediction ? prediction.descriptors.molecularWeight.toFixed(2) : '—'} g/mol
                </text>
              </g>
            </g>
            {/* Bottom center SMILES */}
            <g transform={`translate(${viewBoxSize / 2}, ${viewBoxSize - 22})`}>
              <rect x={-Math.min(260, viewBoxSize * 0.9) / 2} y={-22} width={Math.min(260, viewBoxSize * 0.9)} height={24} rx={6} ry={6} fill="#ffffff" opacity={0.6} />
              <text x={0} y={-3} textAnchor="middle" fontSize={12} fill="#334155">
                {(compound.smiles.length > 34 ? `${compound.smiles.slice(0,34)}…` : compound.smiles)}
              </text>
            </g>
          </g>
        )}
      </svg>
    );
  };

  return (
    <>
      {/* 3D Molecular Visualization */}
  <Card data-testid="card-3d-molecular-visualization" className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center justify-between">
            <span className="flex items-center">
              <Box className="mr-2 text-primary" />
              3D Structure
            </span>
            <div className="flex items-center space-x-3">
              {/* AI geometry toggle */}
              <div className="hidden sm:flex items-center pr-3 mr-1 border-r border-border/60">
                <span className="text-xs text-muted-foreground mr-2">AI geometry</span>
                <Switch
                  checked={useGemini}
                  onCheckedChange={(v: boolean) => {
                    setUseGemini(v);
                    // Clear structure when toggling to force regeneration
                    setGeminiStructure(null);
                  }}
                  aria-label="Toggle AI geometry"
                />
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                onClick={handleReset}
                title="Reset rotation"
                data-testid="button-reset-rotation"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                onClick={handleDownload}
                title="Download 3D structure"
                data-testid="button-download-3d-structure"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                onClick={() => setIsFullscreen(true)}
                title="View fullscreen"
                data-testid="button-fullscreen-3d-structure"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div> 
          </h2>
          
          <div 
            ref={viewerContainerRef}
            className="border border-border rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 relative overflow-hidden" 
            style={{ height: '450px' }}
            data-testid="container-3d-structure-display"
          >
            <div className="absolute inset-0 three-dmol-viewer" />
            {isAnalyzing || isLoadingGemini ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Skeleton className="h-32 w-32 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                  <Skeleton className="h-3 w-36 mx-auto" />
                  {isLoadingGemini && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      🤖 Generating AI-powered 3D structure...
                    </p>
                  )}
                </div>
              </div>
            ) : compound ? (
              <div className="w-full h-full flex flex-col relative">
                {/* 3D Structure Viewer - Takes full container */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full h-full max-w-full max-h-full flex items-center justify-center">
                    {structure
                      ? render3DStructure(viewerContainerRef)
                      : static3DImage ? (
                          <img
                            src={static3DImage}
                            alt="PubChem 3D structure"
                            className="max-h-full max-w-full rounded-md shadow-sm"
                          />
                        ) : (
                          <div className="text-center text-sm text-muted-foreground">
                            3D coordinates unavailable for this compound.
                          </div>
                        )}
                  </div>
                </div>
                
                {/* Compound Info Overlay - Inside the box */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 via-background/90 to-transparent backdrop-blur-sm pb-4 pt-8 px-4 text-center space-y-1.5 z-10 pointer-events-none">
                  <p className="text-base font-bold text-foreground" data-testid="text-3d-compound-name">
                    {compound.name || getMolecularName(compound.smiles)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {structureSource === 'gemini' && 'Source: Gemini AI geometry'}
                    {structureSource === 'pubchem' && 'Source: PubChem 3D coordinates'}
                    {structureSource === 'computed' && 'Source: Generated locally'}
                  </p>
                  <p className="text-xs text-muted-foreground opacity-90">
                    <span className="inline-flex items-center gap-1">
                      <span>Drag to rotate</span>
                      <span className="text-muted-foreground/60">•</span>
                      <span>Reset to center</span>
                      {geminiStructure && (
                        <>
                          <span className="text-muted-foreground/60">•</span>
                          <span className="text-primary">✨ AI-Enhanced</span>
                        </>
                      )}
                    </span>
                  </p>
                  {/* Mobile AI toggle inside box */}
                  <div className="flex sm:hidden items-center justify-center gap-2 pt-1 pointer-events-auto">
                    <span className="text-xs text-muted-foreground">AI geometry</span>
                    <Switch
                      checked={useGemini}
                      onCheckedChange={(v: boolean) => {
                        setUseGemini(v);
                        setGeminiStructure(null);
                      }}
                      aria-label="Toggle AI geometry"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl text-muted-foreground mb-4">🧬</div>
                  <p className="text-sm text-muted-foreground">Enter a compound to view 3D structure</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-6xl h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Box className="mr-2 text-primary" />
                3D Structure - Full View
              </span>
              <div className="flex space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleReset}
                  title="Reset rotation"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleDownload}
                  title="Download 3D structure"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div 
            ref={fullscreenViewerRef}
            className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg"
          >
            {compound && (
              <div className="w-full h-full flex flex-col p-8">
                <div className="flex-1 flex items-center justify-center">
                  <div style={{ width: '75%', maxWidth: '800px', aspectRatio: '1' }}>
                    {render3DStructure(fullscreenViewerRef)}
                  </div>
                </div>
                <div className="text-center border-t border-border/50 pt-6 mt-6 space-y-2">
                  <p className="text-2xl text-foreground font-bold">
                    {compound.name || getMolecularName(compound.smiles)}
                  </p>
                  <p className="text-sm text-muted-foreground pt-2 opacity-75">
                    Drag to rotate • Reset to center
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
