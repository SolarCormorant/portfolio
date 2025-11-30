import React, { useEffect, useRef, useState } from "react";
import * as Plotly from "plotly.js-dist";
import { useColorMode } from "@docusaurus/theme-common";
import "../../../css/scatter.css";

interface MeshData {
  vertices: number[][];
  faces: number[][];
  lines?: number[][]; // Her line bir vertex index çifti [i1, i2]
}

interface ModuleObjectiveCSV {
  modules: string[];
  rotations: number[];
  objectives: string[];
  valueMap: Record<string, Record<string, Record<string, number[]>>>;
}

interface Props {
  moduleObjFilePath?: string;
  contextObjFilePath?: string;
  linesObjFilePath?: string; // Yeni: çizgiler için ayrı dosya
  moduleObjectiveCsvFilePath?: string;
}


const udiColors = [
  "rgb(0,0,255)",
  "rgb(53,0,202)",
  "rgb(107,0,148)",
  "rgb(160,0,95)",
  "rgb(214,0,41)",
  "rgb(255,12,0)",
  "rgb(255,66,0)",
  "rgb(255,119,0)",
  "rgb(255,173,0)",
  "rgb(255,226,0)",
  "rgb(255,255,0)",
];

const udiColorscale: [number, string][] = udiColors.map((color, index) => [
  index / (udiColors.length - 1),
  color,
]);

const UDI_RANGE = { min: 0, max: 100 };

const formatModuleLabel = (id: string) =>
  id.replace("module_", "Module ").replace(/_/g, " ");

const mesh_UDI_with_lines: React.FC<Props> = ({
  moduleObjFilePath = "/3D/daylight/module_2_1.obj",
  contextObjFilePath = "/3D/daylight/module_2_1_context.obj",
  linesObjFilePath = "/3D/daylight/lines.obj", // Varsayılan çizgi dosyası
  moduleObjectiveCsvFilePath = "/3D/daylight/master.csv",
}) => {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const { colorMode } = useColorMode();

  // All meshes from OBJ files (multiple objects per file)
  const [allMeshes, setAllMeshes] = useState<Record<string, MeshData> | null>(null);
  const [allContextMeshes, setAllContextMeshes] = useState<Record<string, MeshData> | null>(null);
  const [allLinesMeshes, setAllLinesMeshes] = useState<Record<string, MeshData> | null>(null);

  // Selected meshes (based on selectedRotation)
  const [meshData, setMeshData] = useState<MeshData | null>(null);
  const [contextMesh, setContextMesh] = useState<MeshData | null>(null);
  const [linesData, setLinesData] = useState<MeshData | null>(null);

  // Store the centroid of the main mesh for consistent transformation
  const [meshCentroid, setMeshCentroid] = useState<[number, number, number]>([0, 0, 0]);

  const [moduleCSV, setModuleCSV] = useState<ModuleObjectiveCSV | null>(null);

  const [selectedModule, setSelectedModule] = useState<string>("module_2_1");
  const [selectedRotation, setSelectedRotation] = useState<number>(0);
  const [selectedObjective, setSelectedObjective] = useState<string>("UDI-f");

  const [rawValues, setRawValues] = useState<number[]>([]);
  const [intensity, setIntensity] = useState<number[]>([]);

  const [svgZoom, setSvgZoom] = useState<number>(1);
  const [svgPan, setSvgPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // OBJ yükleme
  const loadOBJ = async (filePath: string): Promise<string> => {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`OBJ yüklenemedi ${res.status}`);
    }
    return await res.text();
  };

  // Rotate vertices around Z-axis with a custom pivot point
  const rotateVerticesZ = (
    vertices: number[][],
    angleDegrees: number,
    pivotX = 0,
    pivotY = 0
  ): number[][] => {
    const angleRad = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    return vertices.map(([x, y, z]) => {
      // Translate to origin
      const translatedX = x - pivotX;
      const translatedY = y - pivotY;

      // Rotate
      const rotatedX = translatedX * cos - translatedY * sin;
      const rotatedY = translatedX * sin + translatedY * cos;

      // Translate back
      return [rotatedX + pivotX, rotatedY + pivotY, z];
    });
  };

  // Calculate centroid (center point) of vertices
  const calculateCentroid = (vertices: number[][]): [number, number, number] => {
    if (vertices.length === 0) return [0, 0, 0];

    const sum = vertices.reduce(
      (acc, [x, y, z]) => [acc[0] + x, acc[1] + y, acc[2] + z],
      [0, 0, 0]
    );

    return [
      sum[0] / vertices.length,
      sum[1] / vertices.length,
      sum[2] / vertices.length,
    ];
  };

  // Translate (move) vertices by offset
  const translateVertices = (
    vertices: number[][],
    offsetX: number,
    offsetY: number,
    offsetZ = 0
  ): number[][] => {
    return vertices.map(([x, y, z]) => [
      x + offsetX,
      y + offsetY,
      z + offsetZ,
    ]);
  };

  // OBJ parse - supports multiple named objects
  const parseOBJ = (
    content: string,
    isLinesOnly = false
  ): Record<string, MeshData> => {
    const objects: Record<string, MeshData> = {};
    let currentObjectName = "default";
    let currentVertices: number[][] = [];
    let currentFaces: number[][] = [];
    let currentLines: number[][] = [];
    let globalVertexCount = 0; // Track total vertices seen across all objects
    let objectVertexStartIndex = 0; // Where current object's vertices start in global index

    const linesParsed = content.split("\n");

    const finalizeCurrentObject = () => {
      if (currentVertices.length > 0 || currentFaces.length > 0) {
        // For lines-only mode
        if (
          isLinesOnly &&
          currentVertices.length > 0 &&
          currentLines.length === 0 &&
          currentFaces.length === 0
        ) {
          for (let i = 0; i < currentVertices.length - 1; i++) {
            currentLines.push([i, i + 1]);
          }
        }

        // Check if object with this name already exists - if so, merge
        if (objects[currentObjectName]) {
          const existing = objects[currentObjectName];
          const vertexOffset = existing.vertices.length;

          // Merge vertices
          existing.vertices.push(...currentVertices);

          // Merge faces with adjusted indices
          const adjustedFaces = currentFaces.map((face) =>
            face.map((idx) => idx + vertexOffset)
          );
          existing.faces.push(...adjustedFaces);

          // Merge lines if present
          if (currentLines.length > 0) {
            const adjustedLines = currentLines.map(([i1, i2]) => [
              i1 + vertexOffset,
              i2 + vertexOffset,
            ]);
            if (existing.lines) {
              existing.lines.push(...adjustedLines);
            } else {
              existing.lines = adjustedLines;
            }
          }
        } else {
          // New object - create it
          objects[currentObjectName] = {
            vertices: currentVertices,
            faces: currentFaces,
            lines: currentLines.length > 0 ? currentLines : undefined,
          };
        }
      }

      // Update global vertex count for next object
      globalVertexCount += currentVertices.length;
    };

    for (const raw of linesParsed) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      const parts = line.split(/\s+/);

      if (parts[0] === "o") {
        // New object - finalize previous and start new
        finalizeCurrentObject();

        currentObjectName = parts.slice(1).join(" ") || "default";
        currentVertices = [];
        currentFaces = [];
        currentLines = [];
        objectVertexStartIndex = globalVertexCount; // Record where this object's vertices start
      } else if (parts[0] === "v") {
        // Vertex
        currentVertices.push([
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ]);
      } else if (parts[0] === "f") {
        // Face - convert global indices to local indices for this object
        const globalIndices = parts
          .slice(1)
          .map((p) => parseInt(p.split("/")[0], 10) - 1);

        // Convert to local indices (relative to current object's vertex array)
        const localIndices = globalIndices.map(
          (globalIdx) => globalIdx - objectVertexStartIndex
        );

        if (localIndices.length === 3) {
          currentFaces.push(localIndices);
        } else if (localIndices.length === 4) {
          currentFaces.push([localIndices[0], localIndices[1], localIndices[2]]);
          currentFaces.push([localIndices[0], localIndices[2], localIndices[3]]);
        }
      } else if (parts[0] === "l") {
        // Line - convert global indices to local indices
        const globalIndices = parts.slice(1).map((p) => parseInt(p, 10) - 1);
        const localIndices = globalIndices.map(
          (globalIdx) => globalIdx - objectVertexStartIndex
        );

        for (let i = 0; i < localIndices.length - 1; i++) {
          currentLines.push([localIndices[i], localIndices[i + 1]]);
        }
      }
    }

    // Finalize the last object
    finalizeCurrentObject();

    return objects;
  };

  // CSV yükleme (aynı)
  const loadModuleObjectiveCSV = async (
    filePath: string
  ): Promise<ModuleObjectiveCSV> => {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`CSV yüklenemedi ${res.status}`);
    }
    const text = await res.text();

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV içinde yeterli satır yok");
    }

    const headerParts = lines[0].split(/,|\t/).map((h) => h.trim());
    const headers = headerParts.filter((h) => h.length > 0);

    const moduleCol = headers.indexOf("module");
    const rotationCol = headers.indexOf("rotation");
    const udiFCol = headers.indexOf("UDI-f");
    const udiACol = headers.indexOf("UDI-a");
    const udiECol = headers.indexOf("UDI-e");

    if (
      moduleCol === -1 ||
      rotationCol === -1 ||
      udiFCol === -1 ||
      udiACol === -1 ||
      udiECol === -1
    ) {
      throw new Error(
        "CSV başlıkları module rotation UDI-f UDI-a UDI-e şeklinde olmalıdır"
      );
    }

    const modulesSet = new Set<string>();
    const rotationsSet = new Set<number>();
    const valueMap: Record<
      string,
      Record<string, Record<string, number[]>>
    > = {};

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/,|\t/).map((p) => p.trim());
      if (parts.length === 0) continue;

      const moduleId = parts[moduleCol];
      const rotationStr = parts[rotationCol];
      const rotationVal = parseFloat(rotationStr);

      const udiF = parseFloat(parts[udiFCol] || "0");
      const udiA = parseFloat(parts[udiACol] || "0");
      const udiE = parseFloat(parts[udiECol] || "0");

      if (!moduleId) continue;
      if (Number.isNaN(rotationVal)) continue;

      modulesSet.add(moduleId);
      rotationsSet.add(rotationVal);

      // Normalize rotation key to integer string (e.g., "135.0" -> "135")
      const rotationKey = String(Math.round(rotationVal));

      if (!valueMap[moduleId]) {
        valueMap[moduleId] = {};
      }
      if (!valueMap[moduleId][rotationKey]) {
        valueMap[moduleId][rotationKey] = {
          "UDI-f": [],
          "UDI-a": [],
          "UDI-e": [],
        };
      }

      valueMap[moduleId][rotationKey]["UDI-f"].push(
        Number.isNaN(udiF) ? 0 : udiF
      );
      valueMap[moduleId][rotationKey]["UDI-a"].push(
        Number.isNaN(udiA) ? 0 : udiA
      );
      valueMap[moduleId][rotationKey]["UDI-e"].push(
        Number.isNaN(udiE) ? 0 : udiE
      );
    }

    const modules = Array.from(modulesSet);
    const rotations = Array.from(rotationsSet).sort((a, b) => a - b);
    const objectives = ["UDI-f", "UDI-a", "UDI-e"];

    return {
      modules,
      rotations,
      objectives,
      valueMap,
    };
  };

  // Tüm dosyaları yükle
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const [objText, contextText, linesText, moduleCSVRaw] =
          await Promise.all([
            loadOBJ(moduleObjFilePath),
            loadOBJ(contextObjFilePath).catch(() => ""),
            loadOBJ(linesObjFilePath).catch(() => ""), // Çizgiler opsiyonel
            loadModuleObjectiveCSV(moduleObjectiveCsvFilePath),
          ]);

        const meshes = parseOBJ(objText);
        console.log("Loaded meshes:", Object.keys(meshes));
        setAllMeshes(meshes);

        if (contextText) {
          const ctxMeshes = parseOBJ(contextText);
          console.log("Loaded context meshes:", Object.keys(ctxMeshes));
          setAllContextMeshes(ctxMeshes);
        } else {
          setAllContextMeshes(null);
        }

        if (linesText) {
          const linesMeshes = parseOBJ(linesText, true); // isLinesOnly = true
          console.log("Loaded lines meshes:", Object.keys(linesMeshes));
          setAllLinesMeshes(linesMeshes);
        } else {
          setAllLinesMeshes(null);
        }

        setModuleCSV(moduleCSVRaw);

        // Use values directly from CSV
        const defaultModule = moduleCSVRaw.modules[0];
        const defaultRotation = moduleCSVRaw.rotations[0];
        const defaultObjective = moduleCSVRaw.objectives[0];

        setSelectedModule(defaultModule);
        setSelectedRotation(defaultRotation);
        setSelectedObjective(defaultObjective);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Bilinmeyen hata");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [
    moduleObjFilePath,
    contextObjFilePath,
    linesObjFilePath,
    moduleObjectiveCsvFilePath,
  ]);

  // Select mesh based on selectedRotation
  useEffect(() => {
    if (!allMeshes) return;

    // Object name format: module_X_Y_rotation
    // e.g., "module_2_1_45" for module_2_1 at 45 degrees
    // Convert rotation to integer to match OBJ object names
    const rotationInt = Math.round(selectedRotation);
    const objectName = `${selectedModule}_${rotationInt}`;
    console.log("Selecting mesh:", objectName);
    console.log("Available meshes:", Object.keys(allMeshes));
    const mesh = allMeshes[objectName];

    if (mesh) {
      console.log("✅ Found mesh:", objectName, "vertices:", mesh.vertices.length, "faces:", mesh.faces.length);

      // Center the mesh to origin (0,0) in X,Y plane
      const centroid = calculateCentroid(mesh.vertices);
      setMeshCentroid(centroid); // Store for context mesh transformation

      const centeredVertices = translateVertices(
        mesh.vertices,
        -centroid[0],
        -centroid[1],
        0 // Don't change Z
      );

      setMeshData({
        ...mesh,
        vertices: centeredVertices,
      });
    } else {
      console.warn(`❌ Mesh object not found: ${objectName}`);
      setMeshData(null);
      setMeshCentroid([0, 0, 0]);
    }

    // Context mesh is rendered separately per object (no merge needed)
    // Just log that we have context meshes available
    if (allContextMeshes && Object.keys(allContextMeshes).length > 0) {
      console.log("✅ Loaded context meshes:", Object.keys(allContextMeshes).length, "objects");
      setContextMesh(null); // Not using merged context mesh anymore
    } else {
      setContextMesh(null);
    }

    // For lines: combine ALL objects and apply rotation
    if (allLinesMeshes) {
      const allLineObjects = Object.values(allLinesMeshes);
      if (allLineObjects.length > 0) {
        // Merge all line objects into one
        const mergedLines: MeshData = {
          vertices: [],
          faces: [],
          lines: [],
        };

        let vertexOffset = 0;
        allLineObjects.forEach((lineObj) => {
          // Add vertices
          mergedLines.vertices.push(...lineObj.vertices);

          // Add lines with adjusted indices
          if (lineObj.lines) {
            const adjustedLines = lineObj.lines.map(([i1, i2]) => [
              i1 + vertexOffset,
              i2 + vertexOffset,
            ]);
            mergedLines.lines!.push(...adjustedLines);
          }

          vertexOffset += lineObj.vertices.length;
        });

        // Mesh is now centered at origin (0,0)
        // Center lines to origin as well
        const linesCentroid = calculateCentroid(mergedLines.vertices);

        // Translate lines to origin
        let transformedVertices = translateVertices(
          mergedLines.vertices,
          -linesCentroid[0],
          -linesCentroid[1],
          0 // Don't change Z
        );

        // No rotation needed - lines.obj should already be in correct orientation
        // The rotation-specific mesh from OBJ already has the correct orientation

        console.log(
          "✅ Merged all lines:",
          mergedLines.lines?.length || 0,
          "line segments, centered to origin (0, 0)"
        );

        setLinesData({
          ...mergedLines,
          vertices: transformedVertices,
        });
      } else {
        setLinesData(null);
      }
    } else {
      setLinesData(null);
    }
  }, [allMeshes, allContextMeshes, allLinesMeshes, selectedModule, selectedRotation]);

  // Değerleri hesapla (aynı)
  useEffect(() => {
    if (!meshData || !moduleCSV) return;

    const moduleId = selectedModule;
    const rotationStr = String(selectedRotation);
    const objective = selectedObjective;

    const moduleEntry = moduleCSV.valueMap[moduleId];
    if (!moduleEntry) {
      console.warn("❌ No module entry for:", moduleId, "available:", Object.keys(moduleCSV.valueMap));
      setRawValues([]);
      setIntensity([]);
      return;
    }

    const rotationEntry = moduleEntry[rotationStr];
    if (!rotationEntry) {
      console.warn("❌ No rotation entry for:", rotationStr, "available:", Object.keys(moduleEntry));
      setRawValues([]);
      setIntensity([]);
      return;
    }

    const values = rotationEntry[objective];
    if (!values || values.length === 0) {
      console.warn("❌ No values for objective:", objective);
      setRawValues([]);
      setIntensity([]);
      return;
    }

    console.log("✅ Found CSV values:", values.length, "for", moduleId, rotationStr, objective);

    const faceCount = meshData.faces.length;
    if (values.length !== faceCount) {
      console.warn(
        "mesh UDI uyumsuzluk",
        "module",
        moduleId,
        "rotation",
        rotationStr,
        "objective",
        objective,
        "faceCount",
        faceCount,
        "rowCount",
        values.length
      );
    }

    let faceValues: number[];
    if (values.length >= faceCount) {
      faceValues = values.slice(0, faceCount);
    } else {
      faceValues = [];
      for (let i = 0; i < faceCount; i++) {
        faceValues.push(values[i % values.length] ?? 0);
      }
    }

    const levels = udiColors.length;
    const discrete = faceValues.map((v) => {
      const clamped = Math.max(UDI_RANGE.min, Math.min(UDI_RANGE.max, v));
      const ratio =
        UDI_RANGE.max === UDI_RANGE.min
          ? 0
          : (clamped - UDI_RANGE.min) / (UDI_RANGE.max - UDI_RANGE.min);
      const level = Math.floor(ratio * (levels - 1));
      return level;
    });

    console.log("✅ Setting intensity array with", discrete.length, "values");
    setRawValues(faceValues);
    setIntensity(discrete);
  }, [
    meshData,
    moduleCSV,
    selectedModule,
    selectedRotation,
    selectedObjective,
  ]);

  // Plot - mesh + çizgiler
  useEffect(() => {
    if (!plotRef.current || !meshData || intensity.length === 0 || loading)
      return;

    const { vertices, faces } = meshData;

    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const zs = vertices.map((v) => v[2]);

    const is = faces.map((f) => f[0]);
    const js = faces.map((f) => f[1]);
    const ks = faces.map((f) => f[2]);

    const levels = udiColors.length;
    const cmin = 0;
    const cmax = levels - 1;

    const tickvals = Array.from({ length: levels }, (_, i) => i);
    const ticktext = tickvals.map((i) => {
      const ratio = i / (levels - 1);
      const val = UDI_RANGE.min + ratio * (UDI_RANGE.max - UDI_RANGE.min);
      return val.toFixed(0);
    });

    const hoverText =
      vertices.length > 0
        ? intensity.map((_, idx) => {
            const value =
              rawValues && rawValues[idx] !== undefined
                ? rawValues[idx].toFixed(1)
                : "N/A";
            return `Module ${selectedModule}<br>Rotation ${selectedRotation}°<br>${selectedObjective} ${value}`;
          })
        : [];

    const mainTrace: Partial<Plotly.Data> = {
      type: "mesh3d",
      x: xs,
      y: ys,
      z: zs,
      i: is,
      j: js,
      k: ks,
      intensity,
      intensitymode: "cell",
      colorscale: udiColorscale,
      cmin,
      cmax,
      showscale: true,
      flatshading: false,
      opacity: 1,  // Full opacity for main mesh
      lighting: { ambient: 0.8, diffuse: 0.9, specular: 0.3, roughness: 0.5 },
      text: hoverText,
      hoverinfo: "text",
      hovertemplate: "%{text}<extra></extra>",  // Better hover display
      colorbar: {
        title: `${selectedObjective} [%]`,
        len: 0.5,
        thickness: 14,
        tickmode: "array",
        tickvals,
        ticktext,
        tickfont: {
          color: "#f5f5f5",
          size: 10,
        },
        outlinewidth: 0,
        bgcolor: "rgba(0,0,0,0)",
      },
    };

    // Start with empty traces array - add context first, then main mesh on top
    const traces: Partial<Plotly.Data>[] = [];

    // Context mesh ekle FIRST - so main mesh will be on top for hover
    // Each object separately with different colors
    // Only show context objects that belong to the selected module
    if (allContextMeshes && Object.keys(allContextMeshes).length > 0) {
      // Extract module number from selectedModule (e.g., "module_2_1" -> "1" or "module_0" -> "0")
      const moduleMatch = selectedModule.match(/_(\d+)$/);
      const currentModuleNumber = moduleMatch ? moduleMatch[1] : null;
      console.log(`🔍 selectedModule: ${selectedModule}, extracted number: ${currentModuleNumber}`);

      // Filter context objects that belong to current module
      const relevantContextObjects = Object.entries(allContextMeshes).filter(([objectName]) => {
        const contextModuleMatch = objectName.match(/_(\d+)$/);
        const contextModuleNumber = contextModuleMatch ? contextModuleMatch[1] : null;
        return currentModuleNumber === contextModuleNumber;
      });

      if (relevantContextObjects.length > 0) {
        // Use the same centroid as the main mesh for consistent transformation
        const meshCenter = meshCentroid;
        console.log(`📍 Using main mesh centroid for context: [${meshCenter[0].toFixed(2)}, ${meshCenter[1].toFixed(2)}, ${meshCenter[2].toFixed(2)}]`);

        // Now render each object with the same transformation as main mesh
        relevantContextObjects.forEach(([objectName, meshObj]) => {
          // Skip if no faces
          if (!meshObj.faces || meshObj.faces.length === 0) {
            console.warn(`⚠️ Context object ${objectName} has no faces, skipping`);
            return;
          }

          // Apply same centering as main mesh (use main mesh's centroid)
          let transformedVertices = translateVertices(
            meshObj.vertices,
            -meshCenter[0],
            -meshCenter[1],
            0 // Don't change Z
          );

          // Apply rotation around Z-axis at origin (0,0)
          transformedVertices = rotateVerticesZ(transformedVertices, selectedRotation, 0, 0);

          const cx = transformedVertices.map((v) => v[0]);
          const cy = transformedVertices.map((v) => v[1]);
          const cz = transformedVertices.map((v) => v[2]);

          const ci = meshObj.faces.map((f) => f[0]);
          const cj = meshObj.faces.map((f) => f[1]);
          const ck = meshObj.faces.map((f) => f[2]);

          // Determine color: light blue for glazing, grey for others
          const isGlazing = objectName.toLowerCase().includes("glazing");
          const color = isGlazing
            ? "rgba(173, 216, 230, 0.4)"  // Light blue - more transparent for hover
            : "rgba(150, 150, 150, 0.25)";  // Grey - very transparent for hover

          console.log(`  → ${objectName}: ${meshObj.vertices.length} vertices, ${meshObj.faces.length} faces, color: ${color}`);

          const contextTrace: Partial<Plotly.Data> = {
            type: "mesh3d",
            x: cx,
            y: cy,
            z: cz,
            i: ci,
            j: cj,
            k: ck,
            color: color,
            opacity: 0.6,  // Reduce overall opacity for better hover on main mesh
            flatshading: false,  // Smoother lighting
            showscale: false,
            hoverinfo: "skip",
            hoverlabel: { bgcolor: "rgba(0,0,0,0)" },  // Invisible hover
            lighting: {
              ambient: 0.9,
              diffuse: 0.5,
              fresnel: 0.1,
              specular: 0.1,
              roughness: 1,
            },
          };

          traces.push(contextTrace);
        });

        console.log(`✅ Rendered ${relevantContextObjects.length} context objects for module ${selectedModule}`);
      }
    }

    // Add main mesh AFTER context - so it stays on top for hover interaction
    traces.push(mainTrace);

    // Çizgileri ekle
    if (linesData && linesData.lines && linesData.lines.length > 0) {
      // Her çizgi segmenti için ayrı bir trace (discontinuous lines için)
      // Veya tüm çizgileri tek trace'de birleştir
      const lineXs: (number | null)[] = [];
      const lineYs: (number | null)[] = [];
      const lineZs: (number | null)[] = [];

      linesData.lines.forEach((lineSegment, idx) => {
        const [i1, i2] = lineSegment;
        const v1 = linesData.vertices[i1];
        const v2 = linesData.vertices[i2];

        if (v1 && v2) {
          lineXs.push(v1[0], v2[0], null); // null ile segmentleri ayır
          lineYs.push(v1[1], v2[1], null);
          lineZs.push(v1[2], v2[2], null);
        }
      });

      const lineTrace: Partial<Plotly.Data> = {
        type: "scatter3d",
        mode: "lines",
        x: lineXs,
        y: lineYs,
        z: lineZs,
        line: {
          color: "rgb(255,255,255)",
          width: 3,
        },
        hoverinfo: "skip",
        showlegend: false,
      };

      traces.push(lineTrace);
    }

    const baseScene: Partial<Plotly.Scene> = {
      aspectmode: "data",
      bgcolor: "rgba(0,0,0,0)",
      xaxis: {
        visible: false,
        showgrid: false,
        showticklabels: false,
        zeroline: false,
        showbackground: false,
      },
      yaxis: {
        visible: false,
        showgrid: false,
        showticklabels: false,
        zeroline: false,
        showbackground: false,
      },
      zaxis: {
        visible: false,
        showgrid: false,
        showticklabels: false,
        zeroline: false,
        showbackground: false,
      },
    };

    const plotElement: any = plotRef.current;
    const existingCamera =
      plotElement?.layout?.scene?.camera || {
        eye: { x: 0, y: -2, z: 1.5 }, // Güneyden bakış (negatif Y)
      };

    const layout: Partial<Plotly.Layout> = {
      scene: {
        ...baseScene,
        camera: existingCamera,
      },
      margin: { l: 0, r: 0, b: 0, t: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
    };

    if (plotElement && plotElement.data) {
      Plotly.react(plotRef.current, traces as any, layout, config);
    } else {
      Plotly.newPlot(plotRef.current, traces as any, layout, config);
    }
  }, [
    meshData,
    contextMesh,
    linesData,
    intensity,
    rawValues,
    loading,
    selectedModule,
    selectedRotation,
    selectedObjective,
  ]);

  if (loading) {
    return <div>Veriler yükleniyor...</div>;
  }

  if (error) {
    return <div>Hata oluştu: {error}</div>;
  }

  if (!meshData || !moduleCSV) {
    return <div>Veri bulunamadı</div>;
  }

  // Use values directly from CSV
  const availableModules = moduleCSV.modules;
  const availableRotations = moduleCSV.rotations;
  const availableObjectives = moduleCSV.objectives;

  console.log("Render - meshData:", meshData ? `${meshData.vertices.length} vertices, ${meshData.faces.length} faces` : "null");
  console.log("Render - availableModules:", availableModules);
  console.log("Render - availableRotations:", availableRotations);
  console.log("Render - selectedModule:", selectedModule);
  console.log("Render - selectedRotation:", selectedRotation);

  return (
    <div style={{ width: "100%" }}>
      <div className="controls">
        <div className="field">
          <label>Building Module</label>
          <select
            className="select"
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
          >
            {availableModules.map((m) => (
              <option key={m} value={m}>
                {formatModuleLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Rotation</label>
          <select
            className="select"
            value={selectedRotation}
            onChange={(e) => setSelectedRotation(Number(e.target.value))}
          >
            {availableRotations.map((r) => (
              <option key={r} value={r}>
                {r}°
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Objective</label>
          <select
            className="select"
            value={selectedObjective}
            onChange={(e) => setSelectedObjective(e.target.value)}
          >
            {availableObjectives.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Container for Plotly and SVG side by side */}
      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Plotly 3D Visualization */}
        <div ref={plotRef} style={{ flex: "1 1 500px", minWidth: "300px", height: "600px" }} />

        {/* Floor Plan SVG with zoom controls */}
        <div
          style={{
            flex: "0 0 auto",
            width: "min(400px, 40%)",
            minWidth: "250px",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {/* Zoom Controls */}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", alignItems: "center" }}>
            <button
              onClick={() => setSvgZoom(Math.max(0.5, svgZoom - 0.25))}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "1rem",
                cursor: "pointer",
                border: "1px solid #ccc",
                borderRadius: "4px",
                backgroundColor: "transparent",
              }}
            >
              −
            </button>
            <span style={{ minWidth: "80px", textAlign: "center", fontSize: "0.9rem" }}>
              {Math.round(svgZoom * 100)}%
            </span>
            <button
              onClick={() => setSvgZoom(Math.min(3, svgZoom + 0.25))}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "1rem",
                cursor: "pointer",
                border: "1px solid #ccc",
                borderRadius: "4px",
                backgroundColor: "transparent",
              }}
            >
              +
            </button>
            <button
              onClick={() => {
                setSvgZoom(1);
                setSvgPan({ x: 0, y: 0 });
              }}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.9rem",
                cursor: "pointer",
                border: "1px solid #ccc",
                borderRadius: "4px",
                backgroundColor: "transparent",
              }}
            >
              Reset
            </button>
          </div>

          {/* SVG Container */}
          <div
            style={{
              height: "600px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "transparent",
              overflow: "hidden",
              position: "relative",
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setSvgZoom(Math.max(0.5, Math.min(3, svgZoom + delta)));
            }}
            onMouseDown={(e) => {
              setIsDragging(true);
              setDragStart({ x: e.clientX - svgPan.x, y: e.clientY - svgPan.y });
            }}
            onMouseMove={(e) => {
              if (isDragging) {
                setSvgPan({
                  x: e.clientX - dragStart.x,
                  y: e.clientY - dragStart.y,
                });
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <img
              src={`/3D/daylight/module_${selectedModule.match(/_(\d+)$/)?.[1] || "0"}.svg`}
              alt="Floor plan"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                filter: colorMode === "dark" ? "invert(1)" : "none",
                transform: `translate(${svgPan.x}px, ${svgPan.y}px) scale(${svgZoom})`,
                transition: isDragging ? "none" : "transform 0.2s ease-out",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
                pointerEvents: "none",
              }}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default mesh_UDI_with_lines;
