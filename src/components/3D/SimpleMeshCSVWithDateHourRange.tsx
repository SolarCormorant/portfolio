import React, { useEffect, useRef, useState } from "react";
import * as Plotly from "plotly.js-dist";
import { Range, getTrackBackground } from "react-range";
import BrowserOnly from "@docusaurus/BrowserOnly";

interface MeshData {
  vertices: number[][];
  faces: number[][];
}

interface ParsedCSV {
  headers: string[];
  dataRows: number[][];
  dates: string[];
  dateToHours: Record<string, string[]>;
  dateTimeMap: Record<string, Record<string, number>>;
}

interface Props {
  daylightCsvFilePath?: string;
  solarCsvFilePath?: string;
  objFilePath?: string;
  contextObjFilePath?: string;
}

// renk paleti
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

const customColorscale: [number, string][] = baseColors.map((color, index) => [
  index / (baseColors.length - 1),
  color,
]);

// legend araligi sabit
const getLegendRange = (tab: "daylight" | "solar") => {
  if (tab === "daylight") {
    return { min: 0, max: 12 }; // saat
  }
  return { min: 0, max: 12 }; // solar icin istersen degistirebilirsin
};

// saat slideri
interface HourRangeSliderProps {
  hours: string[];
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}

const HourRangeSlider: React.FC<HourRangeSliderProps> = ({
  hours,
  start,
  end,
  onChange,
}) => {
  const values = [start, end];
  const maxIndex = Math.max(0, hours.length - 1);

  if (hours.length <= 1) {
    return null;
  }

  return (
    <div style={{ width: "100%" }}>
      <Range
        values={values}
        step={1}
        min={0}
        max={maxIndex}
        onChange={(vals) => {
          const s = Math.min(vals[0], vals[1]);
          const e = Math.max(vals[0], vals[1]);
          onChange(s, e);
        }}
        renderTrack={({ props, children }) => (
          <div
            {...props}
            style={{
              ...props.style,
              height: "4px",
              width: "100%",
              borderRadius: "999px",
              background: getTrackBackground({
                values,
                colors: ["#555", "#bbb", "#555"],
                min: 0,
                max: maxIndex,
              }),
            }}
          >
            {children}
          </div>
        )}
        renderThumb={({ index, props }) => {
          const currentHour = index === 0 ? hours[start] : hours[end];

          return (
            <div
              {...props}
              style={{
                ...props.style,
                height: "14px",
                width: "14px",
                borderRadius: "50%",
                backgroundColor: "#fff",
                border: "2px solid #ccc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "18px",
                  fontSize: "11px",
                  color: "#ddd",
                  whiteSpace: "nowrap",
                }}
              >
                {currentHour}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

const SimpleMeshCSVWithDateHourRange: React.FC<Props> = ({
  daylightCsvFilePath = "/3D/rad_yeni.csv",
  solarCsvFilePath = "/3D/rad_solar.csv",
  objFilePath = "/3D/rad_mesh_yeni.obj",
  contextObjFilePath = "/3D/context.obj",
}) => {
  const plotRef = useRef<HTMLDivElement | null>(null);

  const [meshData, setMeshData] = useState<MeshData | null>(null);
  const [contextMesh, setContextMesh] = useState<MeshData | null>(null);
  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);

  const [activeTab, setActiveTab] = useState<"daylight" | "solar">(
    "daylight"
  );

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [startIndex, setStartIndex] = useState<number>(0);
  const [endIndex, setEndIndex] = useState<number>(0);

  const [intensity, setIntensity] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CSV oku
  const loadCSV = async (filePath: string): Promise<ParsedCSV> => {
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

    const dataRows: number[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/,|\t/).map((p) => p.trim());
      if (parts.length === 0) continue;

      const row: number[] = [];
      for (let c = 0; c < headers.length; c++) {
        const raw = parts[c] ?? "0";
        const val = parseFloat(raw);
        row.push(Number.isNaN(val) ? 0 : val);
      }
      dataRows.push(row);
    }

    const dateTimeMap: Record<string, Record<string, number>> = {};
    const dateToHoursSet: Record<string, Set<string>> = {};

    headers.forEach((header, index) => {
      const parts = header.split(/\s+/);
      if (parts.length < 3) return;

      const date = `${parts[0]} ${parts[1]}`;
      const hour = parts[2];

      if (!dateTimeMap[date]) {
        dateTimeMap[date] = {};
      }
      dateTimeMap[date][hour] = index;

      if (!dateToHoursSet[date]) {
        dateToHoursSet[date] = new Set<string>();
      }
      dateToHoursSet[date].add(hour);
    });

    const dates = Object.keys(dateTimeMap).sort((a, b) =>
      a.localeCompare(b)
    );

    const dateToHours: Record<string, string[]> = {};
    for (const date of dates) {
      const hourList = Array.from(dateToHoursSet[date] || []);
      hourList.sort((a, b) => {
        const [ha, ma] = a.split(":").map(Number);
        const [hb, mb] = b.split(":").map(Number);
        return ha * 60 + ma - (hb * 60 + mb);
      });
      dateToHours[date] = hourList;
    }

    return {
      headers,
      dataRows,
      dates,
      dateToHours,
      dateTimeMap,
    };
  };

  // OBJ yukle
  const loadOBJ = async (filePath: string) => {
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

  // dosyalari yukle
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentCsvPath =
          activeTab === "daylight"
            ? daylightCsvFilePath
            : solarCsvFilePath;

        const [parsedCSV, objText, contextText] = await Promise.all([
          loadCSV(currentCsvPath),
          loadOBJ(objFilePath),
          loadOBJ(contextObjFilePath).catch(() => ""),
        ]);

        const mesh = parseOBJ(objText);
        setMeshData(mesh);

        if (contextText) {
          const ctxMesh = parseOBJ(contextText);
          setContextMesh(ctxMesh);
        } else {
          setContextMesh(null);
        }

        setCsvData(parsedCSV);

        if (parsedCSV.dates.length > 0) {
          const firstDate = parsedCSV.dates[0];
          const hoursForDate = parsedCSV.dateToHours[firstDate] || [];
          setSelectedDate(firstDate);
          setStartIndex(0);
          setEndIndex(Math.max(0, hoursForDate.length - 1));
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Bilinmeyen hata");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [
    activeTab,
    daylightCsvFilePath,
    solarCsvFilePath,
    objFilePath,
    contextObjFilePath,
  ]);

  // intensite hesapla
  useEffect(() => {
    if (!csvData || !meshData || !selectedDate) return;

    const hours = csvData.dateToHours[selectedDate];
    if (!hours || hours.length === 0) return;

    const safeStart = Math.max(0, Math.min(startIndex, hours.length - 1));
    const safeEnd = Math.max(safeStart, Math.min(endIndex, hours.length - 1));

    const columnIndices: number[] = [];
    for (let idx = safeStart; idx <= safeEnd; idx++) {
      const hour = hours[idx];
      const colIndex = csvData.dateTimeMap[selectedDate][hour];
      if (colIndex !== undefined) {
        columnIndices.push(colIndex);
      }
    }

    if (columnIndices.length === 0) return;

    const summedValues: number[] = [];

    for (const row of csvData.dataRows) {
      let sum = 0;
      for (const col of columnIndices) {
        sum += row[col] ?? 0;
      }
      summedValues.push(sum);
    }

    const faceCount = meshData.faces.length;
    const truncated =
      summedValues.length >= faceCount
        ? summedValues.slice(0, faceCount)
        : (() => {
            const repeated: number[] = [];
            for (let i = 0; i < faceCount; i++) {
              repeated.push(summedValues[i % summedValues.length]);
            }
            return repeated;
          })();

    const minVal = Math.min(...truncated);
    const maxVal = Math.max(...truncated);
    const levels = baseColors.length;

    const discreteValues =
      maxVal === minVal
        ? truncated.map(() => 0)
        : truncated.map((v) => {
            const ratio = (v - minVal) / (maxVal - minVal);
            const level = Math.floor(ratio * (levels - 1));
            return level;
          });

    setIntensity(discreteValues);
  }, [csvData, meshData, selectedDate, startIndex, endIndex]);

  // plot
  useEffect(() => {
    if (!plotRef.current || !meshData || intensity.length === 0 || loading)
      return;

    const traces: Partial<Plotly.Data>[] = [];

    // ana mesh
    const { vertices, faces } = meshData;

    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const zs = vertices.map((v) => v[2]);

    const is = faces.map((f) => f[0]);
    const js = faces.map((f) => f[1]);
    const ks = faces.map((f) => f[2]);

    const levels = baseColors.length;
    const cmin = 0;
    const cmax = levels - 1;

    const legendRange = getLegendRange(activeTab);
    const tickvals = Array.from({ length: levels }, (_, i) => i);
    const ticktext = tickvals.map((i) => {
      const ratio = i / (levels - 1);
      const val =
        legendRange.min + ratio * (legendRange.max - legendRange.min);
      return val.toFixed(0);
    });

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
      colorscale: customColorscale,
      cmin,
      cmax,
      showscale: true,
      flatshading: false,
      lighting: { ambient: 0.7, diffuse: 0.8, specular: 0.2 },
      colorbar: {
        title:
          activeTab === "daylight" ? "Daylight hours" : "Solar radiation",
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

    traces.push(mainTrace);

    // context mesh sabit renk
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
        eye: { x: 1.5, y: 1.5, z: 1.5 },
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
  }, [meshData, contextMesh, intensity, loading, activeTab]);

  if (loading) {
    return <div>Veriler yukleniyor</div>;
  }

  if (error) {
    return <div>Hata olustu {error}</div>;
  }

  if (!csvData || !meshData) {
    return <div>Veri bulunamadi</div>;
  }

  const hoursForSelected = csvData.dateToHours[selectedDate] || [];

  const safeStart = Math.max(
    0,
    Math.min(startIndex, Math.max(0, hoursForSelected.length - 1))
  );
  const safeEnd = Math.max(
    safeStart,
    Math.min(endIndex, Math.max(0, hoursForSelected.length - 1))
  );

  return (
    <div style={{ width: "100%" }}>
      {/* tablar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <button
          onClick={() => setActiveTab("daylight")}
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: activeTab === "daylight" ? 600 : 400,
            backgroundColor:
              activeTab === "daylight" ? "#f5f5f5" : "#333333",
            color: activeTab === "daylight" ? "#000" : "#f5f5f5",
          }}
        >
          Daylight Hours
        </button>
        <button
          onClick={() => setActiveTab("solar")}
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: activeTab === "solar" ? 600 : 400,
            backgroundColor:
              activeTab === "solar" ? "#f5f5f5" : "#333333",
            color: activeTab === "solar" ? "#000" : "#f5f5f5",
          }}
        >
          Solar Radiation
        </button>
      </div>

      {/* tarih ve slider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "12px",
        }}
      >
        <select
          value={selectedDate}
          onChange={(e) => {
            const newDate = e.target.value;
            setSelectedDate(newDate);
            const hours = csvData.dateToHours[newDate] || [];
            setStartIndex(0);
            setEndIndex(Math.max(0, hours.length - 1));
          }}
          style={{
            backgroundColor: "#333333",
            color: "#f5f5f5",
            borderRadius: "4px",
            border: "1px solid #555555",
            padding: "4px 8px",
          }}
        >
          {csvData.dates.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>

        <div style={{ flex: 1 }}>
          {hoursForSelected.length > 0 && (
            <HourRangeSlider
              hours={hoursForSelected}
              start={safeStart}
              end={safeEnd}
              onChange={(s, e) => {
                setStartIndex(s);
                setEndIndex(e);
              }}
            />
          )}
        </div>
      </div>

      <div ref={plotRef} style={{ width: "100%", height: "600px" }} />
    </div>
  );
};

export default SimpleMeshCSVWithDateHourRange;
