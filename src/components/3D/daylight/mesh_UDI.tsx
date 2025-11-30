import React, { useEffect, useRef, useState } from "react";
import * as Plotly from "plotly.js-dist";

interface MeshData {
  vertices: number[][];
  faces: number[][];
}

interface ModuleObjectiveCSV {
  modules: string[];
  rotations: number[];
  objectives: string[];
  // moduleId -> rotationStr -> objective -> values per face
  valueMap: Record<string, Record<string, Record<string, number[]>>>;
}



interface Props {
  moduleObjFilePath?: string;
  contextObjFilePath?: string;
  moduleObjectiveCsvFilePath?: string;
}

// CSV ile uyumlu module id listesi
const buildingModuleOptions = [
  "module_2_1",
  "module_2_2",
  "module_2_3",
  "module_3_1",
  "module_4_1",
  "module_4_2",
  "module_6_1",
];

// Rotasyonlar
const rotationOptions = Array.from({ length: 9 }, (_, i) => i * 45); // 0 45 ... 360

// Objective listesi
const objectiveOptions = ["UDI-f", "UDI-a", "UDI-e"];

// UDI renk paleti
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

// UDI yüzde aralığı
const UDI_RANGE = { min: 0, max: 100 };

// UI etiketi icin kucuk yardimci
const formatModuleLabel = (id: string) =>
  id.replace("module_", "Module ").replace(/_/g, " ");

const mesh_UDI: React.FC<Props> = ({
  moduleObjFilePath = "/3D/daylight/module_2_1.obj",
  contextObjFilePath = "/3D/daylight/module_2_1_context.obj",
  moduleObjectiveCsvFilePath = "/3D/daylight/module_objective.csv",
}) => {
  const plotRef = useRef<HTMLDivElement | null>(null);

  const [meshData, setMeshData] = useState<MeshData | null>(null);
  const [contextMesh, setContextMesh] = useState<MeshData | null>(null);
  const [moduleCSV, setModuleCSV] = useState<ModuleObjectiveCSV | null>(
    null
  );

  const [selectedModule, setSelectedModule] =
    useState<string>("module_2_1");
  const [selectedRotation, setSelectedRotation] = useState<number>(0);
  const [selectedObjective, setSelectedObjective] =
    useState<string>("UDI-f");

  const [rawValues, setRawValues] = useState<number[]>([]);
  const [intensity, setIntensity] = useState<number[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // OBJ yukleme
  const loadOBJ = async (filePath: string): Promise<string> => {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`OBJ yuklenemedi ${res.status}`);
    }
    return await res.text();
  };

  // OBJ parse
  const parseOBJ = (content: string): MeshData => {
    const vertices: number[][] = [];
    const faces: number[][] = [];

    const lines = content.split("\n");

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      const parts = line.split(/\s+/);

      if (parts[0] === "v") {
        vertices.push([
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ]);
      } else if (parts[0] === "f") {
        const indices = parts
          .slice(1)
          .map((p) => parseInt(p.split("/")[0], 10) - 1);

        if (indices.length === 3) {
          faces.push(indices);
        } else if (indices.length === 4) {
          faces.push([indices[0], indices[1], indices[2]]);
          faces.push([indices[0], indices[2], indices[3]]);
        }
      }
    }

    return { vertices, faces };
  };

  // module_objective CSV yukleme
  // Beklenen yapi
  // module, rotation, UDI-f, UDI-a, UDI-e
  const loadModuleObjectiveCSV = async (
    filePath: string
  ): Promise<ModuleObjectiveCSV> => {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`CSV yuklenemedi ${res.status}`);
    }
    const text = await res.text();

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV icinde yeterli satir yok");
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
        "CSV basliklari module rotation UDI f UDI a UDI e seklinde olmalidir"
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
  const rotationRaw = parts[rotationCol];
  const rotationParsed = parseFloat(rotationRaw);

  if (!moduleId) continue;
  if (Number.isNaN(rotationParsed)) continue;

  // normalize
  const rotationVal = Math.round(rotationParsed);
  const rotationKey = String(rotationVal);

  const udiF = parseFloat(parts[udiFCol] || "0");
  const udiA = parseFloat(parts[udiACol] || "0");
  const udiE = parseFloat(parts[udiECol] || "0");

  modulesSet.add(moduleId);
  rotationsSet.add(rotationVal);

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

  valueMap[moduleId][rotationKey]["UDI-f"].push(Number.isNaN(udiF) ? 0 : udiF);
  valueMap[moduleId][rotationKey]["UDI-a"].push(Number.isNaN(udiA) ? 0 : udiA);
  valueMap[moduleId][rotationKey]["UDI-e"].push(Number.isNaN(udiE) ? 0 : udiE);
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

  // Tum dosyalari yukle
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const [objText, contextText, moduleCSVRaw] = await Promise.all([
          loadOBJ(moduleObjFilePath),
          loadOBJ(contextObjFilePath).catch(() => ""),
          loadModuleObjectiveCSV(moduleObjectiveCsvFilePath),
        ]);

        const mesh = parseOBJ(objText);
        setMeshData(mesh);

        if (contextText) {
          const ctx = parseOBJ(contextText);
          setContextMesh(ctx);
        } else {
          setContextMesh(null);
        }

        setModuleCSV(moduleCSVRaw);

        // Varsayilan secimler
        const availableModules =
          buildingModuleOptions.filter((m) =>
            moduleCSVRaw.modules.includes(m)
          ) || moduleCSVRaw.modules;

        const defaultModule =
          availableModules[0] || moduleCSVRaw.modules[0];

        const availableRotations =
          rotationOptions.filter((r) =>
            moduleCSVRaw.rotations.includes(r)
          ) || moduleCSVRaw.rotations;

        const defaultRotation =
          availableRotations[0] || moduleCSVRaw.rotations[0];

        const availableObjectives =
          objectiveOptions.filter((o) =>
            moduleCSVRaw.objectives.includes(o)
          ) || moduleCSVRaw.objectives;

        const defaultObjective =
          availableObjectives[0] || moduleCSVRaw.objectives[0];

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
  }, [moduleObjFilePath, contextObjFilePath, moduleObjectiveCsvFilePath]);

  // Secilen module rotation objective icin degerleri hesapla
  useEffect(() => {
    if (!meshData || !moduleCSV) return;

    const moduleId = selectedModule;
const rotationStr = String(selectedRotation);
    const objective = selectedObjective;

    const moduleEntry = moduleCSV.valueMap[moduleId];
    if (!moduleEntry) {
      setRawValues([]);
      setIntensity([]);
      return;
    }

const rotationEntry = moduleEntry[rotationStr];


    const values = rotationEntry[objective];
    if (!values || values.length === 0) {
      setRawValues([]);
      setIntensity([]);
      return;
    }

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
      const clamped = Math.max(
        UDI_RANGE.min,
        Math.min(UDI_RANGE.max, v)
      );
      const ratio =
        UDI_RANGE.max === UDI_RANGE.min
          ? 0
          : (clamped - UDI_RANGE.min) /
            (UDI_RANGE.max - UDI_RANGE.min);
      const level = Math.floor(ratio * (levels - 1));
      return level;
    });

    setRawValues(faceValues);
    setIntensity(discrete);
  }, [
    meshData,
    moduleCSV,
    selectedModule,
    selectedRotation,
    selectedObjective,
  ]);

  // Plot
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
      const val =
        UDI_RANGE.min +
        ratio * (UDI_RANGE.max - UDI_RANGE.min);
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
      lighting: { ambient: 0.7, diffuse: 0.8, specular: 0.2 },
      text: hoverText,
      hoverinfo: "text",
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

    const traces: Partial<Plotly.Data>[] = [mainTrace];

    if (contextMesh) {
      const cx = contextMesh.vertices.map((v) => v[0]);
      const cy = contextMesh.vertices.map((v) => v[1]);
      const cz = contextMesh.vertices.map((v) => v[2]);

      const ci = contextMesh.faces.map((f) => f[0]);
      const cj = contextMesh.faces.map((f) => f[1]);
      const ck = contextMesh.faces.map((f) => f[2]);

      const contextTrace: Partial<Plotly.Data> = {
        type: "mesh3d",
        x: cx,
        y: cy,
        z: cz,
        i: ci,
        j: cj,
        k: ck,
        color: "rgba(200,200,200,0.25)",
        opacity: 1,
        flatshading: true,
        showscale: false,
        hoverinfo: "skip",
      };

      traces.push(contextTrace);
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
    intensity,
    rawValues,
    loading,
    selectedModule,
    selectedRotation,
    selectedObjective,
  ]);

  if (loading) {
    return <div>Veriler yukleniyor</div>;
  }

  if (error) {
    return <div>Hata olustu {error}</div>;
  }

  if (!meshData || !moduleCSV) {
    return <div>Veri bulunamadi</div>;
  }

  const availableModules = buildingModuleOptions.filter((m) =>
    moduleCSV.modules.includes(m)
  );

  const availableRotations = rotationOptions.filter((r) =>
    moduleCSV.rotations.includes(r)
  );

  const availableObjectives = objectiveOptions.filter((o) =>
    moduleCSV.objectives.includes(o)
  );

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "12px",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#cccccc",
              marginBottom: "4px",
            }}
          >
            Building Module
          </div>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            style={{
              backgroundColor: "#333333",
              color: "#f5f5f5",
              borderRadius: "4px",
              border: "1px solid #555555",
              padding: "4px 8px",
              minWidth: "130px",
            }}
          >
            {availableModules.map((m) => (
              <option key={m} value={m}>
                {formatModuleLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#cccccc",
              marginBottom: "4px",
            }}
          >
            Rotation
          </div>
          <select
            value={selectedRotation}
            onChange={(e) =>
              setSelectedRotation(Number(e.target.value))
            }
            style={{
              backgroundColor: "#333333",
              color: "#f5f5f5",
              borderRadius: "4px",
              border: "1px solid #555555",
              padding: "4px 8px",
              minWidth: "90px",
            }}
          >
            {availableRotations.map((r) => (
              <option key={r} value={r}>
                {r}°
              </option>
            ))}
          </select>
        </div>

        <div>
          <div
            style={{
              fontSize: "11px",
              color: "#cccccc",
              marginBottom: "4px",
            }}
          >
            Objective
          </div>
          <select
            value={selectedObjective}
            onChange={(e) => setSelectedObjective(e.target.value)}
            style={{
              backgroundColor: "#333333",
              color: "#f5f5f5",
              borderRadius: "4px",
              border: "1px solid #555555",
              padding: "4px 8px",
              minWidth: "90px",
            }}
          >
            {availableObjectives.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={plotRef} style={{ width: "100%", height: "600px" }} />
    </div>
  );
};

export default mesh_UDI;
