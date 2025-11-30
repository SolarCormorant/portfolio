import React, { useEffect, useRef, useState } from "react";
import * as Plotly from "plotly.js-dist";
import { Range, getTrackBackground } from "react-range";
import "../../../css/scatter.css";

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

type TabKey = "utci" | "category";

interface Props {
  objFilePath?: string;
  contextObjFilePath?: string;
  utciCsvFiles?: string[];
  categoryCsvFiles?: string[];
}

// ortak renk paleti
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

const baseColorscale: [number, string][] = baseColors.map((color, index) => [
  index / (baseColors.length - 1),
  color,
]);

// Comfort category etiketleri
const comfortCategoryLabelMap: Record<number, string> = {
  "-3": "very strong cold stress",
  "-2": "strong cold stress",
  "-1": "moderate cold stress",
  "0": "no thermal stress",
  "1": "moderate heat stress",
  "2": "strong heat stress",
  "3": "very strong heat stress",
};

// Comfort category icin discrete renk paleti
const comfortCategoryColorscale: [number, string][] = [
  [0.0, "rgb(0, 0, 160)"],     // very strong cold
  [1 / 6, "rgb(0, 0, 255)"],   // strong cold
  [2 / 6, "rgb(0, 128, 255)"], // moderate cold
  [3 / 6, "rgb(0, 200, 0)"],   // no thermal stress (yeşil)
  [4 / 6, "rgb(255, 200, 0)"], // moderate heat
  [5 / 6, "rgb(255, 100, 0)"], // strong heat
  [1.0, "rgb(180, 0, 0)"],     // very strong heat
];

// her tab icin legend araligi
const getLegendRangeForTab = (tab: TabKey) => {
  if (tab === "utci") {
    // UTCI derece araligi
    return { min: -25, max: 35 };
  }
  // konfor kategori sayilari
  return { min: -3, max: 3 };
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
                colors: ["#555555", "#bbbbbb", "#555555"],
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
                backgroundColor: "#ffffff",
                border: "2px solid #cccccc",
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
                  color: "#dddddd",
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

const ThermalComfortMesh: React.FC<Props> = ({
  // obj dosyalarin
  objFilePath = "/3D/thermal_comfort/3D/object.obj",
  contextObjFilePath = "/3D/thermal_comfort/3D/context.obj",

  // tek csv dosyalari
  utciCsvFiles = ["/3D/thermal_comfort/3D/UTCI.csv"],
  categoryCsvFiles = ["/3D/thermal_comfort/3D/category .csv"],
}) => {
  const plotRef = useRef<HTMLDivElement | null>(null);

  const [meshData, setMeshData] = useState<MeshData | null>(null);
  const [contextMesh, setContextMesh] = useState<MeshData | null>(null);

  const [utciCSV, setUtciCSV] = useState<ParsedCSV | null>(null);
  const [categoryCSV, setCategoryCSV] = useState<ParsedCSV | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("utci");

  const [selectedWeek, setSelectedWeek] = useState<number>(1); // 1-4: Winter/Spring/Summer/Autumn
  const [startDayOfWeek, setStartDayOfWeek] = useState<number>(1); // 1-7
  const [endDayOfWeek, setEndDayOfWeek] = useState<number>(7); // 1-7

  // Week isimleri
  const weekNames = [
    "Winter Typical Week",
    "Spring Typical Week",
    "Summer Typical Week",
    "Autumn Typical Week",
  ];

// CSV yuklendikten sonra ilk week/day ayarla
useEffect(() => {
  const base = utciCSV || categoryCSV;
  if (!base || !base.headers || base.headers.length === 0) return;

  // Ilk yuklemede slider pozisyonunu ayarla (24 saat)
  setStartIndex(0);
  setEndIndex(23);
}, [utciCSV, categoryCSV]);


  const [startIndex, setStartIndex] = useState<number>(0);
  const [endIndex, setEndIndex] = useState<number>(0);

  const [utciRaw, setUtciRaw] = useState<number[] | null>(null);
  const [categoryRaw, setCategoryRaw] = useState<number[] | null>(null);

  const [utciIntensity, setUtciIntensity] = useState<number[]>([]);
  const [categoryIntensity, setCategoryIntensity] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // temel csv oku
// temel csv oku
// temel csv oku
const loadCSV = async (filePath: string): Promise<ParsedCSV> => {
  const res = await fetch(filePath);
  if (!res.ok) {
    throw new Error(`CSV yuklenemedi ${filePath} status ${res.status}`);
  }
  const text = await res.text();

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error(`CSV icinde yeterli satir yok ${filePath}`);
  }

  // 1) Ayirac  virgül  tab  veya noktalı virgül olabilir
  const headerLine = lines[0];
  const headerParts = headerLine
    .split(/[,\t;]+/)
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  const headers = headerParts;

  const dataRows: number[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]
      .split(/[,\t;]+/)
      .map((p) => p.trim());
    if (parts.length === 0) continue;

    const row: number[] = [];
    for (let c = 0; c < headers.length; c++) {
      const raw = parts[c] ?? "0";
      // olasi "1,23" formatini da noktaya cevir
      const val = parseFloat(raw.replace(",", "."));
      row.push(Number.isNaN(val) ? 0 : val);
    }
    dataRows.push(row);
  }

  // 2) "08 Jun 00:00" seklindeki basliklardan tarih ve saat cikarma
  // regex: (gun + ay)  (saat:dakika)
  const dateTimeMap: Record<string, Record<string, number>> = {};
  const dateToHoursSet: Record<string, Set<string>> = {};

  headers.forEach((header, index) => {
    const match = header.match(/^(\d{1,2}\s+\w+)\s+(\d{2}:\d{2})/);
    if (!match) {
      return;
    }

    const date = match[1]; // "08 Jun"
    const hour = match[2]; // "00:00"

    if (!dateTimeMap[date]) {
      dateTimeMap[date] = {};
    }
    dateTimeMap[date][hour] = index;

    if (!dateToHoursSet[date]) {
      dateToHoursSet[date] = new Set<string>();
    }
    dateToHoursSet[date].add(hour);
  });

  // Sort dates: equinoxes and solstices starting from spring
  const seasonalOrder = [
    "21 Mar", // March 21 - Spring Equinox
    "21 Jun", // June 21 - Summer Solstice
    "21 Sep", // September 21 - Autumn Equinox
    "21 Dec", // December 21 - Winter Solstice
  ];

  const dates = Object.keys(dateTimeMap).sort((a, b) => {
    const indexA = seasonalOrder.indexOf(a);
    const indexB = seasonalOrder.indexOf(b);

    // If both dates are in seasonalOrder, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // If only one is in seasonalOrder, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    // Otherwise, fall back to alphabetical
    return a.localeCompare(b);
  });

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

  console.log("CSV yuklendi", filePath, {
    headersCount: headers.length,
    datesCount: dates.length,
    firstHeader: headers[0],
    firstDate: dates[0],
  });

  return {
    headers,
    dataRows,
    dates,
    dateToHours,
    dateTimeMap,
  };
};


  // bir klasordeki 4 csv dosyasini birlestir
  const loadAndMergeCSVs = async (
    filePaths: string[]
  ): Promise<ParsedCSV | null> => {
    const validPaths = filePaths.filter((p) => !!p);
    if (validPaths.length === 0) return null;

    let combined: ParsedCSV | null = null;

    for (const path of validPaths) {
      try {
        const csv = await loadCSV(path);
        if (!combined) {
          combined = csv;
        } else {
          // data satirlarini birlestir
          combined.dataRows = combined.dataRows.concat(csv.dataRows);

          // tarihleri birlestir (tekrarlari ele al)
          csv.dates.forEach((date) => {
            if (!combined!.dates.includes(date)) {
              combined!.dates.push(date);
            }
          });

          // dateToHours'u birlestir
          for (const [date, hours] of Object.entries(csv.dateToHours)) {
            if (!combined!.dateToHours[date]) {
              combined!.dateToHours[date] = hours;
            }
          }

          // dateTimeMap'i birlestir
          for (const [date, hourMap] of Object.entries(csv.dateTimeMap)) {
            if (!combined!.dateTimeMap[date]) {
              combined!.dateTimeMap[date] = hourMap;
            } else {
              // ayni tarih varsa saat mapplerini birlestir
              for (const [hour, index] of Object.entries(hourMap)) {
                if (!combined!.dateTimeMap[date][hour]) {
                  combined!.dateTimeMap[date][hour] = index;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("CSV yuklenemedi", path, err);
      }
    }

    // tarihleri sirala
    if (combined) {
      combined.dates.sort((a, b) => a.localeCompare(b));
    }

    return combined;
  };

  // obj oku
  const loadOBJ = async (filePath: string) => {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`OBJ yuklenemedi ${filePath} status ${res.status}`);
    }
    return await res.text();
  };

  // obj parse
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

  // ilk yukleme
useEffect(() => {

  
  const run = async () => {
    try {
      setLoading(true);
      setError(null);

      const [objText, contextText, utci, cat] = await Promise.all([
        loadOBJ(objFilePath),
        loadOBJ(contextObjFilePath).catch(() => ""),
        loadAndMergeCSVs(utciCsvFiles),
        loadAndMergeCSVs(categoryCsvFiles),
      ]);

      const mesh = parseOBJ(objText);
      setMeshData(mesh);

      if (contextText) {
        const ctxMesh = parseOBJ(contextText);
        setContextMesh(ctxMesh);
      } else {
        setContextMesh(null);
      }

      if (utci) setUtciCSV(utci);
      if (cat) setCategoryCSV(cat);

      // Week ve day zaten state'te varsayilan olarak 1,1
      // Slider pozisyonu useEffect'te ayarlaniyor
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  run();
}, [objFilePath, contextObjFilePath]);


  // tum datasetler icin intensite hesapla
  useEffect(() => {
    if (!meshData) return;
    if (!utciCSV && !categoryCSV) return;

    const faceCount = meshData.faces.length;
    const levels = baseColors.length;

    const computeForCSV = (
      csv: ParsedCSV | null,
      tab: TabKey
    ): { raw: number[]; discrete: number[] } | null => {
      if (!csv) return null;

      // Week-day-hour bazli kolon hesaplama
      // CSV: 672 kolon = 4 week * 7 day * 24 hour
      // selectedWeek: 1-4, startDayOfWeek-endDayOfWeek: 1-7, startIndex-endIndex: 0-23

      const maxIdx = 23; // 0-23 saat
      const localStartHour = Math.max(0, Math.min(startIndex, maxIdx));
      const localEndHour = Math.max(localStartHour, Math.min(endIndex, maxIdx));

      const localStartDay = Math.max(1, Math.min(startDayOfWeek, 7));
      const localEndDay = Math.max(localStartDay, Math.min(endDayOfWeek, 7));

      const columnIndices: number[] = [];
      for (let dayIdx = localStartDay; dayIdx <= localEndDay; dayIdx++) {
        const dayIndex = (selectedWeek - 1) * 7 + (dayIdx - 1);
        const baseDayColumn = dayIndex * 24;

        for (let hourIdx = localStartHour; hourIdx <= localEndHour; hourIdx++) {
          const colIndex = baseDayColumn + hourIdx;
          if (colIndex < csv.headers.length) {
            columnIndices.push(colIndex);
          }
        }
      }
      if (columnIndices.length === 0) return null;

      // ortalama hesapla (toplama degil)
      const averaged: number[] = [];
      for (const row of csv.dataRows) {
        let sum = 0;
        for (const col of columnIndices) {
          sum += row[col] ?? 0;
        }
        // toplami saat sayisina bol = ortalama
        const average = sum / columnIndices.length;
        averaged.push(average);
      }

      let faceValues: number[];
      if (averaged.length >= faceCount) {
        faceValues = averaged.slice(0, faceCount);
      } else {
        faceValues = [];
        for (let i = 0; i < faceCount; i++) {
          faceValues.push(averaged[i % averaged.length]);
        }
      }

      const range = getLegendRangeForTab(tab);

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

    const utciRes = computeForCSV(utciCSV, "utci");
    const catRes = computeForCSV(categoryCSV, "category");

    setUtciRaw(utciRes ? utciRes.raw : null);
    setCategoryRaw(catRes ? catRes.raw : null);

    setUtciIntensity(utciRes ? utciRes.discrete : []);
    setCategoryIntensity(catRes ? catRes.discrete : []);
  }, [
    meshData,
    utciCSV,
    categoryCSV,
    selectedWeek,
    startDayOfWeek,
    endDayOfWeek,
    startIndex,
    endIndex,
  ]);

  // plot
  useEffect(() => {
    if (!plotRef.current || !meshData || loading) return;

    let intensity: number[] = [];
    if (activeTab === "utci") intensity = utciIntensity;
    if (activeTab === "category") intensity = categoryIntensity;

    if (intensity.length === 0) return;

    const { vertices, faces } = meshData;

    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const zs = vertices.map((v) => v[2]);

    const is = faces.map((f) => f[0]);
    const js = faces.map((f) => f[1]);
    const ks = faces.map((f) => f[2]);

    const levels = baseColors.length;

    // Category icin özel ayarlar
    let colorscale: [number, string][];
    let cmin: number;
    let cmax: number;
    let tickvals: number[];
    let ticktext: string[];

    if (activeTab === "category") {
      colorscale = comfortCategoryColorscale;
      cmin = 0;
      cmax = levels - 1;

      // -3'ten 3'e kadar kategoriler
      const categoryValues = [-3, -2, -1, 0, 1, 2, 3];
      tickvals = categoryValues.map((catVal) => {
        // -3..3 araligini 0..10 (levels-1) araligina map et
        const ratio = (catVal - (-3)) / (3 - (-3));
        return ratio * (levels - 1);
      });
      ticktext = categoryValues.map((catVal) =>
        comfortCategoryLabelMap[catVal] || `${catVal}`
      );
    } else {
      // UTCI için varsayılan ayarlar
      colorscale = baseColorscale;
      cmin = 0;
      cmax = levels - 1;

      const legendRange = getLegendRangeForTab(activeTab);
      tickvals = Array.from({ length: levels }, (_, i) => i);
      ticktext = tickvals.map((i) => {
        const ratio = i / (levels - 1);
        const val =
          legendRange.min + ratio * (legendRange.max - legendRange.min);
        return val.toFixed(0);
      });
    }

    // CSV'den tarih bilgisini al
    const baseCSV = utciCSV || categoryCSV;

    // Secilen week ve day'e gore kolon indekslerini hesapla
    const startColIndex = (selectedWeek - 1) * 7 * 24 + (startDayOfWeek - 1) * 24 + startIndex;
    const endColIndex = (selectedWeek - 1) * 7 * 24 + (endDayOfWeek - 1) * 24 + endIndex;

    // CSV headerlarından tarih bilgisini çıkar
    let dateRangeText = "";
    if (baseCSV && baseCSV.headers) {
      const startHeader = baseCSV.headers[startColIndex] || "";
      const endHeader = baseCSV.headers[endColIndex] || "";

      // "08 Jun 00:00" formatından tarih ve saat çıkar
      const startMatch = startHeader.match(/^(\d{1,2}\s+\w+)\s+(\d{2}:\d{2})/);
      const endMatch = endHeader.match(/^(\d{1,2}\s+\w+)\s+(\d{2}:\d{2})/);

      if (startMatch && endMatch) {
        const startDate = startMatch[1]; // "08 Jun"
        const startTime = startMatch[2]; // "00:00"
        const endDate = endMatch[1];     // "14 Jun"
        const endTime = endMatch[2];     // "23:00"

        if (startDate === endDate) {
          dateRangeText = `${startDate}, ${startTime}-${endTime}`;
        } else {
          dateRangeText = `${startDate} ${startTime} - ${endDate} ${endTime}`;
        }
      }
    }

    // Fallback: CSV'de header yoksa week adını kullan
    if (!dateRangeText) {
      const weekName = weekNames[selectedWeek - 1];
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const startDayName = dayNames[startDayOfWeek - 1];
      const endDayName = dayNames[endDayOfWeek - 1];
      dateRangeText = `${weekName}, ${startDayName}-${endDayName}, ${startIndex}:00-${endIndex}:00`;
    }

    const hoverText = intensity.map((_, idx) => {
      const utciVal =
        utciRaw && utciRaw[idx] !== undefined
          ? `${utciRaw[idx].toFixed(2)}`
          : "N/A";

      const catRawVal = categoryRaw && categoryRaw[idx] !== undefined
        ? categoryRaw[idx]
        : null;

      const catVal = catRawVal !== null
        ? `${comfortCategoryLabelMap[Math.round(catRawVal)] || catRawVal.toFixed(2)}`
        : "N/A";

      return `${dateRangeText}<br>UTCI: ${utciVal}<br>Category: ${catVal}`;
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
      colorscale,
      cmin,
      cmax,
      showscale: true,
      flatshading: false,
      lighting: { ambient: 0.7, diffuse: 0.8, specular: 0.2 },
      text: hoverText,
      hoverinfo: "text",
      colorbar: {
        title: {
          text: activeTab === "utci"
            ? "UTCI (°C)"
            : "Comfort Category",
          font: {
            color: "#f5f5f5",
            size: 12,
          },
        },
        len: 0.5,
        thickness: 14,
        tickmode: "array",
        tickvals,
        ticktext,
        tickfont: {
          color: "#f5f5f5",
          size: activeTab === "category" ? 8 : 10,
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
    utciIntensity,
    categoryIntensity,
    utciRaw,
    categoryRaw,
    loading,
    activeTab,
  ]);

  if (loading) {
    return <div>Veriler yukleniyor</div>;
  }

  if (error) {
    return <div>Hata olustu {error}</div>;
  }

  if (!meshData || (!utciCSV && !categoryCSV)) {
    return <div>Veri bulunamadi</div>;
  }

  const baseCSV = utciCSV || categoryCSV;

  // Saatler 0-23 arasi (24 saat)
  const maxHourIndex = 23;
  const safeStart = Math.max(0, Math.min(startIndex, maxHourIndex));
  const safeEnd = Math.max(safeStart, Math.min(endIndex, maxHourIndex));

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
          onClick={() => setActiveTab("utci")}
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: activeTab === "utci" ? 600 : 400,
            backgroundColor:
              activeTab === "utci" ? "#f5f5f5" : "#333333",
            color: activeTab === "utci" ? "#000000" : "#f5f5f5",
          }}
        >
          UTCI
        </button>
        <button
          onClick={() => setActiveTab("category")}
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: activeTab === "category" ? 600 : 400,
            backgroundColor:
              activeTab === "category" ? "#f5f5f5" : "#333333",
            color: activeTab === "category" ? "#000000" : "#f5f5f5",
          }}
        >
          Category
        </button>
      </div>

      {/* month day ve saat slideri */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div className="controls">
          <div className="field">
            <label>Week</label>
            <select
              className="select"
              value={selectedWeek}
              onChange={(e) => {
                setSelectedWeek(parseInt(e.target.value, 10));
              }}
            >
              {weekNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Day range slider (1-7) */}
          <div style={{ flex: 1, paddingLeft: "8px", paddingRight: "8px" }}>
            <Range
              step={1}
              min={1}
              max={7}
              values={[startDayOfWeek, endDayOfWeek]}
              onChange={(vals) => {
                const s = Math.min(vals[0], vals[1]);
                const e = Math.max(vals[0], vals[1]);
                setStartDayOfWeek(s);
                setEndDayOfWeek(e);
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
                      values: [startDayOfWeek, endDayOfWeek],
                      colors: ["#555555", "#bbbbbb", "#555555"],
                      min: 1,
                      max: 7,
                    }),
                  }}
                >
                  {children}
                </div>
              )}
              renderThumb={({ index, props }) => {
                const currentDay = index === 0 ? startDayOfWeek : endDayOfWeek;

                return (
                  <div
                    {...props}
                    style={{
                      ...props.style,
                      height: "14px",
                      width: "14px",
                      borderRadius: "50%",
                      backgroundColor: "#ffffff",
                      border: "2px solid #cccccc",
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
                        color: "#dddddd",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {currentDay}
                    </div>
                  </div>
                );
              }}
            />
          </div>

          {/* Hour range slider */}
          <div style={{ flex: 2 }}>
            <HourRangeSlider
              hours={Array.from({ length: 24 }, (_, i) => i.toString())}
              start={safeStart}
              end={safeEnd}
              onChange={(s, e) => {
                setStartIndex(s);
                setEndIndex(e);
              }}
            />
          </div>
        </div>
      </div>

      <div
        ref={plotRef}
        style={{ width: "100%", height: "600px" }}
      />
    </div>
  );
};

export default ThermalComfortMesh;
