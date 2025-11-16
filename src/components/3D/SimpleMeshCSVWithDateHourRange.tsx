import React, { useEffect, useRef, useState } from "react";
import * as Plotly from "plotly.js-dist";
import { Range, getTrackBackground } from "react-range";

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

// Daylight renk paleti
const daylightColors = [
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

const daylightColorscale: [number, string][] = daylightColors.map(
  (color, index) => [index / (daylightColors.length - 1), color]
);

// Solar radiation renk paleti
const solarColors = [
  "rgb(4,25,145)",
  "rgb(7,48,224)",
  "rgb(7,88,255)",
  "rgb(1,232,255)",
  "rgb(97,246,156)",
  "rgb(166,249,86)",
  "rgb(254,244,1)",
  "rgb(255,121,0)",
  "rgb(239,39,0)",
  "rgb(138,17,0)",
];

const solarColorscale: [number, string][] = solarColors.map(
  (color, index) => [index / (solarColors.length - 1), color]
);

// Legend araligi sabit
const getLegendRange = (tab: "daylight" | "solar") => {
  if (tab === "daylight") {
    return { min: 0, max: 12 }; // saat
  }
  return { min: 0, max: 7 }; // kWh
};

// Saat slideri
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
  daylightCsvFilePath = "/3D/3D_daylight.csv",
  solarCsvFilePath = "/3D/3D_radiation.csv",
  objFilePath = "/3D/rad_mesh_yeni.obj",
  contextObjFilePath = "/3D/context.obj",
}) => {
  const plotRef = useRef<HTMLDivElement | null>(null);

  const [meshData, setMeshData] = useState<MeshData | null>(null);
  const [contextMesh, setContextMesh] = useState<MeshData | null>(null);

  const [daylightCSV, setDaylightCSV] = useState<ParsedCSV | null>(null);
  const [solarCSV, setSolarCSV] = useState<ParsedCSV | null>(null);

  const [activeTab, setActiveTab] = useState<"daylight" | "solar">(
    "daylight"
  );

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [startIndex, setStartIndex] = useState<number>(0);
  const [endIndex, setEndIndex] = useState<number>(0);

  const [daylightRaw, setDaylightRaw] = useState<number[] | null>(null);
  const [solarRaw, setSolarRaw] = useState<number[] | null>(null);
  const [daylightIntensity, setDaylightIntensity] = useState<number[]>([]);
  const [solarIntensity, setSolarIntensity] = useState<number[]>([]);

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

  // Dosyalari yukle
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const [dayCSV, solCSV, objText, contextText] = await Promise.all([
          loadCSV(daylightCsvFilePath).catch(() => null),
          loadCSV(solarCsvFilePath).catch(() => null),
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

        if (dayCSV) {
          setDaylightCSV(dayCSV);
        }
        if (solCSV) {
          setSolarCSV(solCSV);
        }

        let initialDate = "";
        let initialHours: string[] = [];

        if (dayCSV && dayCSV.dates.length > 0) {
          initialDate = dayCSV.dates[0];
          initialHours = dayCSV.dateToHours[initialDate] || [];
        } else if (solCSV && solCSV.dates.length > 0) {
          initialDate = solCSV.dates[0];
          initialHours = solCSV.dateToHours[initialDate] || [];
        }

        if (initialDate) {
          setSelectedDate(initialDate);
          setStartIndex(0);
          setEndIndex(Math.max(0, initialHours.length - 1));
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Bilinmeyen hata");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [daylightCsvFilePath, solarCsvFilePath, objFilePath, contextObjFilePath]);

  // Daylight ve solar icin intensite hesapla
  useEffect(() => {
    if (!meshData || !selectedDate) return;
    if (!daylightCSV && !solarCSV) return;

    const faceCount = meshData.faces.length;

    const computeForCSV = (
      csv: ParsedCSV | null,
      kind: "daylight" | "solar"
    ): { raw: number[]; discrete: number[] } | null => {
      if (!csv) return null;

      const levels =
        kind === "daylight" ? daylightColors.length : solarColors.length;

      const hours = csv.dateToHours[selectedDate];
      if (!hours || hours.length === 0) return null;

      const maxIdx = hours.length - 1;
      const localStart = Math.max(0, Math.min(startIndex, maxIdx));
      const localEnd = Math.max(localStart, Math.min(endIndex, maxIdx));

      const columnIndices: number[] = [];
      for (let idx = localStart; idx <= localEnd; idx++) {
        const hour = hours[idx];
        const colIndex = csv.dateTimeMap[selectedDate][hour];
        if (colIndex !== undefined) {
          columnIndices.push(colIndex);
        }
      }
      if (columnIndices.length === 0) return null;

      const summed: number[] = [];
      for (const row of csv.dataRows) {
        let sum = 0;
        for (const col of columnIndices) {
          sum += row[col] ?? 0;
        }
        summed.push(sum);
      }

      let faceValues: number[];
      if (summed.length >= faceCount) {
        faceValues = summed.slice(0, faceCount);
      } else {
        faceValues = [];
        for (let i = 0; i < faceCount; i++) {
          faceValues.push(summed[i % summed.length]);
        }
      }

      const range = getLegendRange(kind);

      const discrete = faceValues.map((v) => {
        const clamped = Math.max(range.min, Math.min(range.max, v));
        const ratio =
          range.max === range.min
            ? 0
            : (clamped - range.min) / (range.max - range.min);
        const level = Math.floor(ratio * (levels - 1));
        return level;
      });

      return { raw: faceValues, discrete };
    };

    const dl = computeForCSV(daylightCSV, "daylight");
    const sr = computeForCSV(solarCSV, "solar");

    setDaylightRaw(dl ? dl.raw : null);
    setSolarRaw(sr ? sr.raw : null);
    setDaylightIntensity(dl ? dl.discrete : []);
    setSolarIntensity(sr ? sr.discrete : []);
  }, [daylightCSV, solarCSV, meshData, selectedDate, startIndex, endIndex]);

  // Plot
  useEffect(() => {
    const intensity =
      activeTab === "daylight" ? daylightIntensity : solarIntensity;

    if (!plotRef.current || !meshData || intensity.length === 0 || loading)
      return;

    const { vertices, faces } = meshData;

    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const zs = vertices.map((v) => v[2]);

    const is = faces.map((f) => f[0]);
    const js = faces.map((f) => f[1]);
    const ks = faces.map((f) => f[2]);

    const levels =
      activeTab === "daylight" ? daylightColors.length : solarColors.length;
    const colorscale =
      activeTab === "daylight" ? daylightColorscale : solarColorscale;

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

    const hoverText =
      vertices.length > 0
        ? intensity.map((_, idx) => {
            const dlVal =
              daylightRaw && daylightRaw[idx] !== undefined
                ? `${daylightRaw[idx].toFixed(2)} h`
                : "N/A";
            const srVal =
              solarRaw && solarRaw[idx] !== undefined
                ? `${solarRaw[idx].toFixed(2)} kWh`
                : "N/A";
            return `Daylight hours ${dlVal}<br>Solar radiation ${srVal}`;
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
      colorscale,
      cmin,
      cmax,
      showscale: true,
      flatshading: false,
      lighting: { ambient: 0.7, diffuse: 0.8, specular: 0.2 },
      text: hoverText,
      hoverinfo: "text",
      colorbar: {
        title:
          activeTab === "daylight"
            ? "Daylight hours"
            : "Solar radiation (kWh)",
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

    // Context mesh
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
  }, [
    meshData,
    contextMesh,
    daylightIntensity,
    solarIntensity,
    daylightRaw,
    solarRaw,
    loading,
    activeTab,
  ]);

  if (loading) {
    return <div>Veriler yukleniyor</div>;
  }

  if (error) {
    return <div>Hata olustu {error}</div>;
  }

  if (!meshData || (!daylightCSV && !solarCSV)) {
    return <div>Veri bulunamadi</div>;
  }

  const baseCSV = daylightCSV || solarCSV;
  const hoursForSelected =
    baseCSV?.dateToHours[selectedDate] || [];

  const maxHourIndex = Math.max(0, hoursForSelected.length - 1);
  const safeStart = Math.max(
    0,
    Math.min(startIndex, maxHourIndex)
  );
  const safeEnd = Math.max(
    safeStart,
    Math.min(endIndex, maxHourIndex)
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

      {/* Tarih ve slider */}
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

            const hours =
              (daylightCSV &&
                daylightCSV.dateToHours[newDate]) ||
              (solarCSV &&
                solarCSV.dateToHours[newDate]) ||
              [];

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
          {(baseCSV?.dates || []).map((date) => (
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
