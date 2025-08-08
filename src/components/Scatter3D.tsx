import React, { useEffect, useState } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import * as XLSX from "xlsx";

// Excel dosyasındaki sütun adları
const colNames = [
  "x",
  "y",
  "z",
  "WWR",
  "Interior Shelf",
  "Interior Shelf Rotation Angle",
  "Interior Shelf Height (m)",
  "Interior Shelf Depth (m)",
  "Exterior Shelf",
  "Exterior Shelf Rotation Angle",
  "Exterior Shelf Height (m)",
  "Exterior Shelf Depth (m)",
  "Cooling Load (kWh)",
  "Heating Load (kWh)",
  "UDI-a (%)",
  "Artificial Lighting Load (kWh)",
  "UDI-a (secondary) (%)",
];

interface DataRow {
  [key: string]: any;
}

const Scatter3D: React.FC = () => {
  const [dataDF, setDataDF] = useState<DataRow[]>([]);
  const [dataPF, setDataPF] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);

  const widths = ["5"];
  const lengths = ["5", "7", "9"];
  const heights = ["3"];
  const wwrs = ["05", "09"];

  const [selected, setSelected] = useState({
    width: "5",
    length: "5",
    height: "3",
    wwr: "05",
  });

  const filename = `${selected.width}x${selected.length}x${selected.height}x${selected.wwr}.xlsx`;

  // Dropdown stilleri
  const selectStyle: React.CSSProperties = {
    fontFamily: "Jost, sans-serif",
    fontSize: "1rem",
    padding: "0.25rem 1rem",
    minWidth: "8rem",
    lineHeight: "1.2",
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/data/thesis/${filename}`);
        const ab = await res.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });

        const dfJson = XLSX.utils.sheet_to_json<DataRow>(wb.Sheets["df"], {
          header: colNames,
          range: 1,
          defval: null,
        });
        const pfJson = XLSX.utils.sheet_to_json<DataRow>(wb.Sheets["pf"], {
          header: colNames,
          range: 1,
          defval: null,
        });

        setDataDF(dfJson);
        setDataPF(pfJson);
      } catch (error) {
        console.error("Error loading Excel:", error);
        setDataDF([]);
        setDataPF([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filename]);

  const handleChange = (key: keyof typeof selected, value: string) => {
    setSelected((prev) => ({ ...prev, [key]: value }));
  };

  const hoverTemplate =
    "Cooling: %{x}<br>Heating: %{y}<br>Light: %{z}<br>UDI-a: %{customdata}%";

  // Search Space veri aralıkları
  const xVals = dataDF.map((d) => d["Cooling Load (kWh)"] as number);
  const yVals = dataDF.map((d) => d["Heating Load (kWh)"] as number);
  const zVals = dataDF.map(
    (d) => d["Artificial Lighting Load (kWh)"] as number
  );
  const xRange = xVals.length
    ? ([Math.min(...xVals), Math.max(...xVals)] as [number, number])
    : undefined;
  const yRange = yVals.length
    ? ([Math.min(...yVals), Math.max(...yVals)] as [number, number])
    : undefined;
  const zRange = zVals.length
    ? ([Math.min(...zVals), Math.max(...zVals)] as [number, number])
    : undefined;

  const hasData = dataDF.length > 0 || dataPF.length > 0;

  return (
    <BrowserOnly fallback={<div>Loading 3D Scatter...</div>}>
      {() => {
        // SSR sırasında yüklenmez; sadece browser'da import edilir
        const Plot = require("react-plotly.js").default;

        return (
          <div>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                marginBottom: "1rem",
                alignItems: "center",
              }}
            >
              <div>
                <label style={{ marginRight: "0.5rem", fontFamily: "Jost, sans-serif" }}>
                  Room Width:
                </label>
                <select
                  style={selectStyle}
                  value={selected.width}
                  onChange={(e) => handleChange("width", e.target.value)}
                >
                  {widths.map((w) => (
                    <option key={w} value={w}>
                      {w} m
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ marginRight: "0.5rem", fontFamily: "Jost, sans-serif" }}>
                  Room Depth:
                </label>
                <select
                  style={selectStyle}
                  value={selected.length}
                  onChange={(e) => handleChange("length", e.target.value)}
                >
                  {lengths.map((l) => (
                    <option key={l} value={l}>
                      {l} m
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ marginRight: "0.5rem", fontFamily: "Jost, sans-serif" }}>
                  Room Height:
                </label>
                <select
                  style={selectStyle}
                  value={selected.height}
                  onChange={(e) => handleChange("height", e.target.value)}
                >
                  {heights.map((h) => (
                    <option key={h} value={h}>
                      {h} m
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ marginRight: "0.5rem", fontFamily: "Jost, sans-serif" }}>
                  WWR:
                </label>
                <select
                  style={selectStyle}
                  value={selected.wwr}
                  onChange={(e) => handleChange("wwr", e.target.value)}
                >
                  {wwrs.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : hasData ? (
              <Plot
                useResizeHandler
                data={[
                  {
                    name: "Search Space",
                    type: "scatter3d",
                    mode: "markers",
                    x: dataDF.map((d) => d["Cooling Load (kWh)"]),
                    y: dataDF.map((d) => d["Heating Load (kWh)"]),
                    z: dataDF.map((d) => d["Artificial Lighting Load (kWh)"]),
                    customdata: dataDF.map((d) => d["UDI-a (%)"]),
                    hovertemplate: hoverTemplate,
                    marker: {
                      symbol: "square",
                      color: dataDF.map((d) => d["UDI-a (%)"]),
                      colorscale: "Viridis",
                      colorbar: { title: { text: "UDI-a (%)" } },
                    },
                    showscale: true,
                  },
                  {
                    name: "Pareto Front",
                    type: "scatter3d",
                    mode: "markers",
                    x: dataPF.map((d) => d["Cooling Load (kWh)"]),
                    y: dataPF.map((d) => d["Heating Load (kWh)"]),
                    z: dataPF.map((d) => d["Artificial Lighting Load (kWh)"]),
                    customdata: dataPF.map((d) => d["UDI-a (%)"]),
                    hovertemplate: hoverTemplate,
                    marker: {
                      symbol: "cross",
                      color: dataPF.map((d) => d["UDI-a (%)"]),
                      colorscale: "Viridis",
                    },
                    showscale: false,
                  },
                ]}
                layout={{
                  autosize: true,
                  paper_bgcolor: "rgba(0,0,0,0)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                  margin: { t: 30, l: 0, r: 0, b: 0 },
                  scene: {
                    bgcolor: "rgba(0,0,0,0)",
                    xaxis: {
                      title: { text: "Cooling Load (kWh)", font: { color: "#444" } },
                      ...(xRange && { range: xRange, autorange: false }),
                    },
                    yaxis: {
                      title: { text: "Heating Load (kWh)", font: { color: "#444" } },
                      ...(yRange && { range: yRange, autorange: false }),
                    },
                    zaxis: {
                      title: { text: "Lighting Load (kWh)", font: { color: "#444" } },
                      ...(zRange && { range: zRange, autorange: false }),
                    },
                  },
                  legend: {
                    orientation: "h",
                    x: 0.5,
                    xanchor: "center",
                    y: 1.05,
                    yanchor: "bottom",
                  },
                }}
                config={{ responsive: true, displayModeBar: false, displaylogo: false }}
                style={{ width: "100%", height: "600px" }}
              />
            ) : (
              <p>No data available</p>
            )}
          </div>
        );
      }}
    </BrowserOnly>
  );
};

export default Scatter3D;
