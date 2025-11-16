import React, { useEffect, useRef, useState } from "react";
import * as Plotly from "plotly.js-dist";

interface MeshData {
  vertices: number[][];
  faces: number[][];
}

const baseColors = [
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

const minVal = 0;
const maxVal = 1;



const customColorscale: [number, string][] = baseColors.map((color, index) => [
  index / (baseColors.length - 1),
  color,
]);



interface SimpleMeshCSVProps {
  csvFilePath?: string;
  objFilePath?: string;
}
const SimpleMeshCSVVisualization: React.FC<SimpleMeshCSVProps> = ({
  csvFilePath = "/3D/rad_yeni.csv",
  objFilePath = "/3D/rad_mesh_yeni.obj",
}) => {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [meshData, setMeshData] = useState<MeshData | null>(null);
  const [values, setValues] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadCSV = async (filePath: string) => {
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

    const header = lines[0];
    console.log("CSV header", header);

    const numericValues = lines.slice(1).map((line, index) => {
      const parts = line.split(",");
      const raw = parts[0].trim();
      const v = parseFloat(raw);
      if (Number.isNaN(v)) {
        console.warn(
          `Satır ${index + 2} sayıya çevrilemedi değeri sıfır kabul ediliyor`,
          line
        );
        return 0;
      }
      return v;
    });

    return numericValues;
  };

  const loadOBJ = async (filePath: string) => {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`OBJ yüklenemedi ${res.status}`);
    }
    const text = await res.text();
    return text;
  };

  const parseOBJ = (content: string): MeshData => {
    const vertices: number[][] = [];
    const faces: number[][] = [];

    const lines = content.split("\n");

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const parts = line.split(/\s+/);
      if (parts.length === 0) continue;

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

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const [csvValues, objText] = await Promise.all([
          loadCSV(csvFilePath),
          loadOBJ(objFilePath),
        ]);

        const parsedMesh = parseOBJ(objText);

        setValues(csvValues);
        setMeshData(parsedMesh);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Bilinmeyen hata");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [csvFilePath, objFilePath]);

  useEffect(() => {
    if (!plotRef.current || !meshData || values.length === 0 || loading) return;

    const { vertices, faces } = meshData;
    const faceCount = faces.length;

    if (faceCount === 0) return;

    const faceIntensity: number[] = [];
    for (let i = 0; i < faceCount; i++) {
      faceIntensity.push(values[i % values.length]);
    }

    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const zs = vertices.map((v) => v[2]);

    const is = faces.map((f) => f[0]);
    const js = faces.map((f) => f[1]);
    const ks = faces.map((f) => f[2]);

    const minVal =
      faceIntensity.length > 0 ? Math.min(...faceIntensity) : 0;
    const maxVal =
      faceIntensity.length > 0 ? Math.max(...faceIntensity) : 1;

    const trace: Partial<Plotly.Data> = {
      type: "mesh3d",
      x: xs,
      y: ys,
      z: zs,
      i: is,
      j: js,
      k: ks,
      intensity: faceIntensity,
      intensitymode: "cell",
      colorscale: customColorscale,
      cmin: minVal,
      cmax: maxVal,
      showscale: true,
      flatshading: false,
      lighting: { ambient: 0.7, diffuse: 0.8, specular: 0.2 },
      colorbar: {
        title: "Value",
        len: 0.8,
        thickness: 20,
      },
    };

    const layout: Partial<Plotly.Layout> = {
      scene: {
        aspectmode: "data",
        camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } },
        xaxis: { title: " ", showticklabels: false, showgrid: false },
        yaxis: { title: " ", showticklabels: false, showgrid: false },
        zaxis: { title: " ", showticklabels: false, showgrid: false },
      },
      margin: { l: 0, r: 0, b: 0, t: 30 },
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
    };

    Plotly.newPlot(plotRef.current, [trace as any], layout, config);
  }, [meshData, values, loading]);

  if (loading) {
    return <div>Veriler yükleniyor</div>;
  }

  if (error) {
    return <div>Hata oluştu {error}</div>;
  }

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <div ref={plotRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default SimpleMeshCSVVisualization;
