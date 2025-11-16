import React, { useEffect, useState } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import * as XLSX from "xlsx";
import "/src/css/scatter.css";

interface DataRow {
  [key: string]: any;
}

type ShelfTab = "interior" | "exterior";

interface SelectionState {
  x: number | null;
  y: number | null;
  wwr: number | null;
}

const bruteInteriorFile = "/data/thesis/brute_enfinalic.xlsx";
const bruteExteriorFile = "/data/thesis/brute_enfinaldis.xlsx";

const metricOptions = [
  { key: "Heating", label: "Heating" },
  { key: "Cooling", label: "Cooling" },
  { key: "Artificial_Lighting", label: "Artificial Lighting" },
  { key: "UDI-f", label: "UDI f (%)" },
  { key: "UDI-a", label: "UDI a (%)" },
  { key: "UDI-e", label: "UDI e (%)" },
];

// her metric için tonlu palette
const metricPalettes: Record<string, string[]> = {
  Cooling: ["#dceeff", "#a6cee3", "#6baed6", "#3182bd", "#08519c"],
  Heating: ["#fee0d2", "#fc9272", "#fb6a4a", "#de2d26", "#a50f15"],
  Artificial_Lighting: ["#ffe5d9", "#fdc5b4", "#f4a384", "#ec7a53", "#d1492e"],
  "UDI-f": ["#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#43a2ca"],
  "UDI-a": ["#fff7bc", "#fee391", "#fec44f", "#fe9929", "#d95f0e"],
  "UDI-e": ["#f3e5f5", "#e1bee7", "#ce93d8", "#ab47bc", "#7b1fa2"],
};

// metric mapte yoksa kullanılacak yedek renkler
const fallbackColors = ["#f9c74f", "#f9844a", "#f8961e", "#f3722c", "#f94144"];

// excel okuma
const loadWorkbookData = async (url: string): Promise<DataRow[]> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}`);
  }

  const ab = await res.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });

  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];

  const json = XLSX.utils.sheet_to_json<DataRow>(sheet, {
    defval: null,
  });

  return json;
};

const uniqueValues = (arr: any[]) => {
  const clean = arr.filter((v) => v !== null && v !== undefined && v !== "");
  return Array.from(new Set(clean));
};

const ShelfMatrix: React.FC = () => {
  const [tab, setTab] = useState<ShelfTab>("interior");

  const [dataInterior, setDataInterior] = useState<DataRow[]>([]);
  const [dataExterior, setDataExterior] = useState<DataRow[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selection, setSelection] = useState<SelectionState>({
    x: null,
    y: null,
    wwr: null,
  });

  const [metric, setMetric] = useState<string>("UDI-a");

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [intData, extData] = await Promise.all([
          loadWorkbookData(bruteInteriorFile),
          loadWorkbookData(bruteExteriorFile),
        ]);
        setDataInterior(intData);
        setDataExterior(extData);
      } catch (err: any) {
        setError(err?.message || "Error while loading data");
        setDataInterior([]);
        setDataExterior([]);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const activeData = tab === "interior" ? dataInterior : dataExterior;

  const xValues = uniqueValues(activeData.map((r) => r["x"]));
  const yValues = uniqueValues(activeData.map((r) => r["y"]));
  const wwrValues = uniqueValues(activeData.map((r) => r["WWR_Ratio"]));

  // tab ya da data değişince seçimleri o dosyada var olan bir kombinasyona çek
  useEffect(() => {
    if (!activeData.length) return;

    const firstRow = activeData[0];

    const defaultX = Number(firstRow["x"]);
    const defaultY = Number(firstRow["y"]);
    const defaultWWR = Number(firstRow["WWR_Ratio"]);

    setSelection((prev) => {
      const nextX =
        prev.x !== null && xValues.includes(prev.x) ? prev.x : defaultX;
      const nextY =
        prev.y !== null && yValues.includes(prev.y) ? prev.y : defaultY;
      const nextWWR =
        prev.wwr !== null && wwrValues.includes(prev.wwr)
          ? prev.wwr
          : defaultWWR;

      return {
        x: nextX,
        y: nextY,
        wwr: nextWWR,
      };
    });
    // eslint disable because xValues yValues wwrValues zaten aktif datadan türemiş durumda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, dataInterior, dataExterior]);

  const handleSelectChange = (key: keyof SelectionState, value: string) => {
    const num = Number(value);
    setSelection((prev) => ({
      ...prev,
      [key]: isNaN(num) ? null : num,
    }));
  };

  const filteredData =
    selection.x === null || selection.y === null || selection.wwr === null
      ? []
      : activeData.filter(
          (row) =>
            Number(row["x"]) === selection.x &&
            Number(row["y"]) === selection.y &&
            Number(row["WWR_Ratio"]) === selection.wwr
        );

  const heightKey = tab === "interior" ? "Int_Height" : "Ext_Height";
  const depthKey = tab === "interior" ? "Int_Depth" : "Ext_Depth";
  const rotationKey = tab === "interior" ? "Int_Rotation" : "Ext_Rotation";

  const heights = uniqueValues(filteredData.map((r) => r[heightKey])).sort(
    (a: any, b: any) => Number(a) - Number(b)
  );

  const depthCategories = uniqueValues(
    filteredData.map((r) => r[depthKey])
  ).sort((a: any, b: any) => Number(a) - Number(b));

  const rotationValues = uniqueValues(
    filteredData.map((r) => r[rotationKey])
  ).sort((a: any, b: any) => Number(a) - Number(b));

  const hasData =
    filteredData.length > 0 &&
    heights.length > 0 &&
    depthCategories.length > 0 &&
    rotationValues.length > 0;

let yRange: [number, number] | undefined = undefined;

if (hasData) {
  if (["UDI-f", "UDI-a", "UDI-e"].includes(metric)) {
    // UDI değerleri daima yüzde
    yRange = [0, 100];
  } else {
    // diğer metrikler için otomatik min max
    const vals = filteredData.map((r) => Number(r[metric]));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    yRange = [min, max];
  }
}

  return (
    <BrowserOnly fallback={<div>Loading matrix view...</div>}>
      {() => {
        const Plot = require("react-plotly.js").default;

        if (loading) {
          return <p>Data is loading...</p>;
        }

        if (error) {
          return <p>{error}</p>;
        }

        if (!activeData.length) {
          return <p>No data is available</p>;
        }

        if (!hasData || !yRange) {
          return (
            <div>
              <Controls
                tab={tab}
                setTab={setTab}
                selection={selection}
                xValues={xValues}
                yValues={yValues}
                wwrValues={wwrValues}
                metric={metric}
                setMetric={setMetric}
                onSelectChange={handleSelectChange}
              />
              <p>Bu seçimler ile matrix için veri bulunmuyor</p>
            </div>
          );
        }

        const traces: any[] = [];
        const layout: any = {
          margin: { t: 80, l: 90, r: 140, b: 80 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          annotations: [] as any[],
          legend: {
            title: {
              text:
                tab === "interior"
                  ? "Interior shelf rotation"
                  : "Exterior shelf rotation",
            },
            x: 1.02,
            y: 0.5,
            xanchor: "left",
            yanchor: "middle",
          },
          // tek ortak y ekseni
          yaxis: {
            domain: [0.10, 0.92],
            tickfont: { size: 10, color: "#555555" },
            showgrid: true,
            gridcolor: "rgba(0,0,0,0.08)",
            zeroline: false,
            range: yRange,
          },
        };

        const gridRows = 1;
        const gridCols = heights.length;
        const colWidth = 1 / gridCols;

        let subplotIndex = 0;

        const metricLabel =
          metricOptions.find((m) => m.key === metric)?.label || metric;

        heights.forEach((h, colIndex) => {
          const subsetHeight = filteredData.filter(
            (r) => r[heightKey] === h
          );

          subplotIndex += 1;
          const axisSuffix = subplotIndex === 1 ? "" : String(subplotIndex);
          const xAxisName = "xaxis" + axisSuffix;

          const colPos = colIndex;
          const x0 = colPos * colWidth + 0.02;
          const x1 = (colPos + 1) * colWidth - 0.02;

          layout[xAxisName] = {
            domain: [x0, x1],
            type: "category",
            categoryorder: "array",
            categoryarray: depthCategories.map(String),
            tickfont: { size: 10, color: "#555555" },
            showgrid: false,
            zeroline: false,
          };

          rotationValues.forEach((rotVal, rotIndex) => {
            const subset = subsetHeight.filter(
              (r) => r[rotationKey] === rotVal
            );

            if (!subset.length) return;

            const x = subset.map((r) => String(r[depthKey]));
            const yVals = subset.map((r) => Number(r[metric]));

            const palette = metricPalettes[metric] || fallbackColors;
            const color = palette[rotIndex % palette.length];

            traces.push({
              type: "bar",
              x,
              y: yVals,
              marker: {
                color,
                line: { width: 0 },
              },
              name: `${rotVal}`,
              legendgroup: "rotation",
              showlegend: colIndex === 0,
              xaxis: "x" + axisSuffix,
              yaxis: "y",
              hovertemplate:
                `Depth: %{x} <br>${metricLabel}: %{y}<br>` +
                `${heightKey}: ${h}<br>` +
                `Rotation: ${rotVal}<extra></extra>`,
            });
          });
        });

        // sütun etiketleri
        heights.forEach((h, colIndex) => {
          const xCenter = (colIndex + 0.5) * colWidth;

          layout.annotations.push({
            text: `${heightKey} = ${h}`,
            xref: "paper",
            yref: "paper",
            x: xCenter,
            y: 1.04,
            showarrow: false,
            font: { size: 12, color: "#333333" },
          });
        });

        // üst başlık metrik adı
        layout.annotations.push({
          text: metricLabel,
          xref: "paper",
          yref: "paper",
          x: 0,
          y: 1.10,
          xanchor: "left",
          showarrow: false,
          font: { size: 13, color: "#333333" },
        });

        // ortak x eksen etiketi
        layout.annotations.push({
          text:
            tab === "interior"
              ? "Interior shelf depth (m)"
              : "Exterior shelf depth (m)",
          xref: "paper",
          yref: "paper",
          x: 0.5,
          y: -0.02,
          showarrow: false,
          font: { size: 12, color: "#333333" },
        });

        return (
          <div>
            <Controls
              tab={tab}
              setTab={setTab}
              selection={selection}
              xValues={xValues}
              yValues={yValues}
              wwrValues={wwrValues}
              metric={metric}
              setMetric={setMetric}
              onSelectChange={handleSelectChange}
            />

            <Plot
              data={traces}
              layout={layout}
              config={{
                responsive: true,
                displayModeBar: false,
                displaylogo: false,
              }}
              style={{ width: "100%", height: "520px" }}
            />
          </div>
        );
      }}
    </BrowserOnly>
  );
};

interface ControlsProps {
  tab: ShelfTab;
  setTab: (t: ShelfTab) => void;
  selection: SelectionState;
  xValues: any[];
  yValues: any[];
  wwrValues: any[];
  metric: string;
  setMetric: (m: string) => void;
  onSelectChange: (key: keyof SelectionState, value: string) => void;
}

const Controls: React.FC<ControlsProps> = ({
  tab,
  setTab,
  selection,
  xValues,
  yValues,
  wwrValues,
  metric,
  setMetric,
  onSelectChange,
}) => {
  return (
    <>
      <div className="view-tabs">
        <button
          className={tab === "interior" ? "view-tab active" : "view-tab"}
          onClick={() => setTab("interior")}
        >
          Interior shelf
        </button>
        <button
          className={tab === "exterior" ? "view-tab active" : "view-tab"}
          onClick={() => setTab("exterior")}
        >
          Exterior shelf
        </button>
      </div>

      <div className="controls">
        <div className="field">
          <label>Room x</label>
          <select
            className="select"
            value={selection.x !== null ? selection.x : ""}
            onChange={(e) => onSelectChange("x", e.target.value)}
          >
            {xValues.map((v) => (
              <option key={String(v)} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Room y</label>
          <select
            className="select"
            value={selection.y !== null ? selection.y : ""}
            onChange={(e) => onSelectChange("y", e.target.value)}
          >
            {yValues.map((v) => (
              <option key={String(v)} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>WWR ratio</label>
          <select
            className="select"
            value={selection.wwr !== null ? selection.wwr : ""}
            onChange={(e) => onSelectChange("wwr", e.target.value)}
          >
            {wwrValues.map((v) => (
              <option key={String(v)} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Metric</label>
          <select
            className="select"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {metricOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
};

export default ShelfMatrix;
