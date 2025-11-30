import React, { useEffect, useRef, useState } from "react";
import * as Plotly from "plotly.js-dist";

interface ParsedCSV {
  headers: string[];
  rows: number[][];
}

interface HeatmapData {
  days: string[];
  hours: number[];
  z: number[][];
  hoverText: string[][];
  minValue: number;
  maxValue: number;
}

interface Props {
  utciCsvFilePath?: string;
  comfortConditionCsvFilePath?: string;
  comfortableCsvFilePath?: string;
}

// Condition kolon adlari
const conditionOptions = [
  { key: "sun_wind", label: "Sun And Wind", columnName: "Sun And Wind" },
  { key: "sun_no_wind", label: "Sun and No Wind", columnName: "Sun and No Wind" },
  { key: "no_sun_wind", label: "No Sun and Wind", columnName: "No Sun and Wind" },
  {
    key: "no_sun_no_wind",
    label: "No Sun and No Wind",
    columnName: "No Sun and No Wind",
  },
];

// Measure secenekleri
const defaultMeasureOptions = [
  { key: "utci", label: "UTCI (°C)" },
  { key: "comfort_condition", label: "Comfort Condition" },
  { key: "comfortable", label: "Comfortable (%)" },
];

// UTCI icin default renk paleti (istersen degistirebilirsin)
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

const udiColorscale: [number, string][] = udiColors.map((c, i) => [
  i / (udiColors.length - 1),
  c,
]);

// Comfort condition kategorileri
// Buradaki sayilar CSV deki degerlerine gore -3..3 veya 1..7 vs seklinde duzenlenebilir
const comfortCategoryLabelMap: Record<number, string> = {
  "-3": "very strong cold stress",
  "-2": "strong cold stress",
  "-1": "moderate cold stress",
  "0": "no thermal stress",
  "1": "moderate heat stress",
  "2": "strong heat stress",
  "3": "very strong heat stress",
};

// Comfort condition icin discrete renk paleti
const comfortCategoryColorscale: [number, string][] = [
  [0.0, "rgb(0, 0, 160)"], // very strong cold
  [1 / 6, "rgb(0, 0, 255)"], // strong cold
  [2 / 6, "rgb(0, 128, 255)"], // moderate cold
  [3 / 6, "rgb(0, 200, 0)"], // no thermal stress (yesil)
  [4 / 6, "rgb(255, 200, 0)"], // moderate heat
  [5 / 6, "rgb(255, 100, 0)"], // strong heat
  [1.0, "rgb(180, 0, 0)"], // very strong heat
];

// Her measure icin istege bagli manuel min max
const manualRanges: Record<string, { min: number; max: number } | null> = {
  utci: { min: -30, max: 30 }, // derece ornegi
  comfort_condition: { min: -3, max: 3 }, // kategorilere gore
  comfortable: { min: 0, max: 100 }, // ornek degerler
};

const ConditionHeatmap: React.FC<Props> = ({
  utciCsvFilePath = "/3D/thermal_comfort/outdoor_comfort_heatmap_UTCI.csv",
  comfortConditionCsvFilePath = "/3D/thermal_comfort/outdoor_comfort_heatmap_category.csv",
  comfortableCsvFilePath = "/3D/thermal_comfort/outdoor_comfort_heatmap_category.csv",
}) => {
  const plotRef = useRef<HTMLDivElement | null>(null);

  const [selectedMeasure, setSelectedMeasure] = useState<string>("utci");
  const [selectedCondition, setSelectedCondition] = useState<string>("sun_wind");

  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);

  const [csvGlobalMin, setCsvGlobalMin] = useState<number | null>(null);
  const [csvGlobalMax, setCsvGlobalMax] = useState<number | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Hangi measure hangi CSV
  const resolveMeasurePath = (measureKey: string): string | null => {
    if (measureKey === "utci") return utciCsvFilePath;
    if (measureKey === "comfort_condition") return comfortConditionCsvFilePath;
    if (measureKey === "comfortable") return comfortableCsvFilePath;
    return null;
  };

  const getMeasureLabel = (measureKey: string): string => {
    const found = defaultMeasureOptions.find((m) => m.key === measureKey);
    return found ? found.label : measureKey;
  };

  // CSV parse
  const parseCSV = (text: string): ParsedCSV => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV icinde yeterli satir yok");
    }

    const headerParts = lines[0].split(/,|\t/).map((h) => h.trim());
    const headers = headerParts.filter((h) => h.length > 0);

    const rows: number[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/,|\t/).map((p) => p.trim());
      if (parts.length === 0) continue;
      const values = parts.map((p) => {
        const v = parseFloat(p);
        return Number.isNaN(v) ? NaN : v;
      });
      rows.push(values);
    }

    return { headers, rows };
  };

  // Saatlik array i 365x24 matrise cevir
  const buildHeatmapData = (
    values: number[],
    conditionLabel: string,
    measureLabel: string,
    valueFormatter?: (v: number) => string
  ): HeatmapData => {
    const totalHours = values.length;
    const daysCount = Math.floor(totalHours / 24);

    const startDate = new Date(2021, 0, 1, 0, 0, 0);
    const hours = Array.from({ length: 24 }, (_, h) => h);

    const days: string[] = [];
    const z: number[][] = [];
    const hoverText: string[][] = [];

    let idx = 0;
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    for (let d = 0; d < daysCount; d++) {
      const dayBase = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
      const dayLabel = `${dayBase.getDate().toString().padStart(2, "0")} ${
        monthNames[dayBase.getMonth()]
      }`;
      days.push(dayLabel);

      const row: number[] = [];
      const hoverRow: string[] = [];

      for (let h = 0; h < 24; h++) {
        if (idx >= totalHours) break;

        const value = values[idx];
        row.push(value);

        if (Number.isFinite(value)) {
          if (value < minValue) minValue = value;
          if (value > maxValue) maxValue = value;
        }

        const t = new Date(dayBase.getTime() + h * 60 * 60 * 1000);
        const timeLabel = `${t.getHours().toString().padStart(2, "0")}:00`;

        const displayValue = (() => {
          if (!Number.isFinite(value)) return "N/A";
          if (valueFormatter) return valueFormatter(value);
          return value.toFixed(2);
        })();

        const hover = `Condition ${conditionLabel}<br>Measure ${measureLabel}<br>${dayLabel} ${timeLabel}<br>Value ${displayValue}`;
        hoverRow.push(hover);

        idx++;
      }

      z.push(row);
      hoverText.push(hoverRow);
    }

    if (!Number.isFinite(minValue)) {
      minValue = 0;
      maxValue = 1;
    }

    return { days, hours, z, hoverText, minValue, maxValue };
  };

  // Secili measure icin CSV yukle ve global min max hesapla
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const path = resolveMeasurePath(selectedMeasure);
        if (!path) {
          throw new Error("Secilen measure icin CSV yolu tanimli degil");
        }

        const res = await fetch(path);
        if (!res.ok) {
          throw new Error(`CSV yuklenemedi ${res.status}`);
        }
        const text = await res.text();
        const parsed = parseCSV(text);

        // Tum condition kolonlari icin global min max
        let globalMin = Number.POSITIVE_INFINITY;
        let globalMax = Number.NEGATIVE_INFINITY;

        const conditionColumnIndices = conditionOptions
          .map((c) => parsed.headers.indexOf(c.columnName))
          .filter((idx) => idx !== -1);

        for (const row of parsed.rows) {
          for (const idx of conditionColumnIndices) {
            const v = row[idx];
            if (Number.isFinite(v)) {
              if (v < globalMin) globalMin = v;
              if (v > globalMax) globalMax = v;
            }
          }
        }

        if (Number.isFinite(globalMin) && Number.isFinite(globalMax)) {
          setCsvGlobalMin(globalMin);
          setCsvGlobalMax(globalMax);
        } else {
          setCsvGlobalMin(null);
          setCsvGlobalMax(null);
        }

        setCsvData(parsed);
      } catch (e: any) {
        console.error(e);
        setCsvData(null);
        setHeatmapData(null);
        setCsvGlobalMin(null);
        setCsvGlobalMax(null);
        setError(e.message ?? "Bilinmeyen hata");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [
    selectedMeasure,
    utciCsvFilePath,
    comfortConditionCsvFilePath,
    comfortableCsvFilePath,
  ]);

  // CSV + condition a gore heatmap datasini hazirla
  useEffect(() => {
    if (!csvData) {
      setHeatmapData(null);
      return;
    }

    const condition = conditionOptions.find((c) => c.key === selectedCondition);
    if (!condition) {
      setHeatmapData(null);
      return;
    }

    const colIndex = csvData.headers.indexOf(condition.columnName);
    if (colIndex === -1) {
      console.warn("CSV icinde beklenen condition kolonu yok", condition.columnName);
      setHeatmapData(null);
      return;
    }

    const flatValues: number[] = [];
    for (const row of csvData.rows) {
      const v = row[colIndex];
      flatValues.push(v);
    }

    const measureLabel = getMeasureLabel(selectedMeasure);

    let valueFormatter: ((v: number) => string) | undefined;
    if (selectedMeasure === "comfort_condition") {
      valueFormatter = (v: number) => {
        if (!Number.isFinite(v)) return "N/A";
        const rounded = Math.round(v);
        return comfortCategoryLabelMap[rounded] ?? `category ${rounded}`;
      };
    }

    const heat = buildHeatmapData(
      flatValues,
      condition.label,
      measureLabel,
      valueFormatter
    );
    setHeatmapData(heat);
  }, [csvData, selectedCondition, selectedMeasure]);

  // Plot
  useEffect(() => {
    if (!plotRef.current || !heatmapData || loading) return;

    const { days, hours, z, hoverText, minValue, maxValue } = heatmapData;
    const measureLabel = getMeasureLabel(selectedMeasure);

    // Manuel range
    const manualRange = manualRanges[selectedMeasure] || null;
    const zminValue = manualRange?.min ?? csvGlobalMin ?? minValue;
    const zmaxValue = manualRange?.max ?? csvGlobalMax ?? maxValue;

    // Measure a gore colorscale
    let colorscale: any = udiColorscale;
    if (selectedMeasure === "utci") {
      colorscale = "RdBu";
    } else if (selectedMeasure === "comfort_condition") {
      colorscale = comfortCategoryColorscale;
    } else if (selectedMeasure === "comfortable") {
      colorscale = "Tealrose";
    }

    // Colorbar tickleri sadece comfort_condition icin
    let colorbarTickVals: number[] | undefined;
    let colorbarTickText: string[] | undefined;

    if (selectedMeasure === "comfort_condition") {
      const entries = Object.entries(comfortCategoryLabelMap)
        .map(([k, v]) => [Number(k), v] as [number, string])
        .sort((a, b) => a[0] - b[0]);

      colorbarTickVals = entries.map(([k]) => k);
      colorbarTickText = entries.map(([, v]) => v);
    }

    // X ekseni 3 saatte bir
    const xTickVals = Array.from({ length: 8 }, (_, i) => i * 3); // 0 3 ... 21
    const xTickText = xTickVals.map((v) => String(v));

    // Y ekseni ay basi ve 15 i
    const yTickVals = days.filter(
      (d) => d.startsWith("01 ") || d.startsWith("15 ")
    );

    const trace: Partial<Plotly.Data> = {
  type: "heatmap",
  x: hours,
  y: days,
  z,
  text: hoverText,
  hoverinfo: "text",
  colorscale,
  zmin: zminValue,
  zmax: zmaxValue,
  colorbar: {
    title: {
      text: measureLabel,
      font: {
        color: "#f5f5f5",
        size: 12,
      },
      side: "right",
    },
    len: 0.8,          // her grafikte ayni dikey uzunluk
    thickness: 18,     // her grafikte ayni genislik
    x: 1.02,           // hep ayni konum
    xanchor: "left",
    tickfont: {
      color: "#f5f5f5",
      size: selectedMeasure === "comfort_condition" ? 8 : 10,
    },
    outlinewidth: 0,
    bgcolor: "rgba(0,0,0,0)",
    tickmode: colorbarTickVals ? "array" : "auto",
    tickvals: colorbarTickVals,
    ticktext: colorbarTickText,
  },
};


    const layout: Partial<Plotly.Layout> = {
  width: 900,   // her grafikte ayni genislik
  height: 600,  // senin div yüksekliğinle uyumlu
  margin: { l: 60, r: 160, t: 10, b: 40 }, // sag marj sabit ve genis
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  xaxis: {
    title: "Hour of Day",
    tickmode: "array",
    tickvals: xTickVals,
    ticktext: xTickText,
    showgrid: false,
    zeroline: false,
    color: "#f5f5f5",
    showline: true,
    mirror: "all",
    linecolor: "#000000",
    linewidth: 1,
  },
  yaxis: {
    title: "Day of Year",
    tickmode: "array",
    tickvals: yTickVals,
    ticktext: yTickVals,
    showgrid: false,
    zeroline: false,
    color: "#f5f5f5",
    automargin: false,
    showline: true,
    mirror: "all",
    linecolor: "#000000",
    linewidth: 1,
  },
};


    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
    };

    const plotElement: any = plotRef.current;
    if (plotElement && plotElement.data) {
      Plotly.react(plotRef.current, [trace] as any, layout, config);
    } else {
      Plotly.newPlot(plotRef.current, [trace] as any, layout, config);
    }
  }, [heatmapData, loading, selectedMeasure, csvGlobalMin, csvGlobalMax]);

  if (loading) {
    return <div>Veriler yukleniyor</div>;
  }

  if (error) {
    return <div>Hata olustu {error}</div>;
  }

  if (!csvData || !heatmapData) {
    return <div>Gosterilecek veri bulunamadi</div>;
  }

  const availableMeasureOptions = defaultMeasureOptions.filter((m) =>
    resolveMeasurePath(m.key)
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
            Measure
          </div>
          <select
            value={selectedMeasure}
            onChange={(e) => setSelectedMeasure(e.target.value)}
            style={{
              backgroundColor: "#333333",
              color: "#f5f5f5",
              borderRadius: "4px",
              border: "1px solid #555555",
              padding: "4px 8px",
              minWidth: "150px",
            }}
          >
            {availableMeasureOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
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
            Condition
          </div>
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            style={{
              backgroundColor: "#333333",
              color: "#f5f5f5",
              borderRadius: "4px",
              border: "1px solid #555555",
              padding: "4px 8px",
              minWidth: "200px",
            }}
          >
            {conditionOptions.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={plotRef} style={{ width: "100%", height: "600px" }} />
    </div>
  );
};

export default ConditionHeatmap;