import React, { useEffect, useState } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import * as XLSX from "xlsx";
import "/src/css/scatter.css";
import DataTable from "./thesis_pareto_table_hover";

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

interface ParallelPlotProps {
  data: DataRow[];
  onFilterChange: (indices: number[] | null) => void;
}

const ParallelPlot: React.FC<ParallelPlotProps> = ({ data, onFilterChange }) => {
  const Plot = require("react-plotly.js").default;

  const safeData = Array.isArray(data) ? data : [];

  const dim = (label: string, key: string) => ({
    label,
    values: safeData.map((row) => (row[key] as number) ?? 0),
      labelfont: {
    color: "rgba(255,191,0,0.9)",
    size: 12,
  },

  // 💛 Eksen üzerindeki sayıların rengi
  tickfont: {
    color: "rgba(255,191,0,0.9)",
    size: 11,
  },

  });

  const dimensions = [
    dim("Interior Shelf Height (m)", "Interior Shelf Height (m)"),
    dim("Interior Shelf Depth (m)", "Interior Shelf Depth (m)"),
    dim("Exterior Shelf Height (m)", "Exterior Shelf Height (m)"),
    dim("Exterior Shelf Depth (m)", "Exterior Shelf Depth (m)"),
    dim("Cooling Load (kWh)", "Cooling Load (kWh)"),
    dim("Heating Load (kWh)", "Heating Load (kWh)"),
    dim("UDI-a (%)", "UDI-a (%)"),
    dim("Artificial Lighting Load (kWh)", "Artificial Lighting Load (kWh)"),
  ];

  return (
    <Plot
data={[
  {
    type: "parcoords",
    line: {
      color: safeData.map((row) => (row["UDI-a (%)"] as number) ?? 0),
      colorscale: "Viridis",
    },

    dimensions,

    // 💛 eksen label yazıları
    labelfont: {
      color: "rgba(255,191,0,0.9)",
      size: 12,
    },

    // 💛 eksen üzerindeki sayılar
    tickfont: {
      color: "rgba(255,191,0,0.9)",
      size: 11,
    },

    // isteğe bağlı: üstte görünen min max range yazıları
    rangefont: {
      color: "rgba(255,191,0,0.9)",
      size: 11,
    },
  } as any,
]}
      layout={{
  uirevision: "parallel",
  autosize: true,
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  // eksen yazıları kesilmesin diye kenarlardan daha çok boşluk
  margin: { t: 60, l: 90, r: 90, b: 40 },
}}

      config={{
        responsive: true,
        displayModeBar: false,
        displaylogo: false,
      }}
      style={{ width: "100%", height: "480px" }}
      onUpdate={(fig: any) => {
        const parData = fig?.data?.[0];
        const dims = parData?.dimensions;
        if (!Array.isArray(dims)) {
          onFilterChange(null);
          return;
        }

        const activeRanges: {
          dimIndex: number;
          ranges: [number, number][];
        }[] = [];

        dims.forEach((d: any, dimIndex: number) => {
          const cr = d.constraintrange;
          if (cr == null) return;

          if (Array.isArray(cr[0])) {
            activeRanges.push({ dimIndex, ranges: cr });
          } else {
            activeRanges.push({ dimIndex, ranges: [cr] });
          }
        });

        if (activeRanges.length === 0) {
          onFilterChange(null);
          return;
        }

        const indices: number[] = [];
        const length = safeData.length;

        for (let i = 0; i < length; i++) {
          let ok = true;
          for (const ar of activeRanges) {
            const v = dims[ar.dimIndex].values[i] as number;
            let inside = false;
            for (const [min, max] of ar.ranges) {
              if (v >= min && v <= max) {
                inside = true;
                break;
              }
            }
            if (!inside) {
              ok = false;
              break;
            }
          }
          if (ok) indices.push(i);
        }

        onFilterChange(indices.length > 0 ? indices : null);
      }}
    />
  );
};

const Scatter3D: React.FC = () => {
  const [dataDF, setDataDF] = useState<DataRow[]>([]);
  const [dataPF, setDataPF] = useState<DataRow[]>([]);
  const [dataObjective, setDataObjective] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [filteredIndices, setFilteredIndices] = useState<number[] | null>(null);
  const [viewMode, setViewMode] = useState<"scatter" | "parallel">("scatter");

  const widths = ["5"];
  const lengths = ["5", "7", "9"];
  const heights = ["3"];
  const wwrs = ["05", "09"];
  const objectives = ["Pareto Front", "Cooling", "Heating", "UDI-a", "Artificial Lighting"];

  const objectiveSheetMap: Record<string, string> = {
    Cooling: "Cooling",
    Heating: "Heating",
    "UDI-a": "UDI-a",
    "Artificial Lighting": "AL",
  };

  const objectiveColorMap: Record<string, string> = {
    Cooling: "#00BFFF",
    Heating: "#FF073A",
    "UDI-a": "#FFD700",
    "Artificial Lighting": "#FF8C00",
  };

  const [selected, setSelected] = useState({
    width: "5",
    length: "5",
    height: "3",
    wwr: "05",
    objective: "UDI-a",
  });

  const filename = `${selected.width}x${selected.length}x${selected.height}x${selected.wwr}.xlsx`;

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

        let objectiveJson: DataRow[] = [];

        if (selected.objective !== "Pareto Front") {
          const objectiveSheetName = objectiveSheetMap[selected.objective];
          const objectiveSheet = wb.Sheets[objectiveSheetName];
          objectiveJson = objectiveSheet
            ? XLSX.utils.sheet_to_json<DataRow>(objectiveSheet, {
                header: colNames,
                range: 1,
                defval: null,
              })
            : [];
        }

        setDataDF(dfJson);
        setDataPF(pfJson);
        setDataObjective(objectiveJson);
      } catch {
        setDataDF([]);
        setDataPF([]);
        setDataObjective([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filename, selected.objective]);

  const handleChange = (key: keyof typeof selected, value: string) => {
    setSelected((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (key === "objective") {
      setFilteredIndices(null);
      setSelectedRowIndex(null);
    }
  };

  const hoverTemplate =
    "Cooling: %{x}<br>Heating: %{y}<br>Light: %{z}<br>UDI-a: %{customdata}%";

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

  const tableData =
    selected.objective === "Pareto Front" ? dataPF : dataObjective;

  const filteredData =
    filteredIndices && tableData.length
      ? filteredIndices
          .map((i) => tableData[i])
          .filter((row): row is DataRow => !!row)
      : tableData;

  const hasFilter = !!(filteredIndices && filteredIndices.length);

  const paretoForScatter =
    selected.objective === "Pareto Front" ? filteredData : dataPF;

  const objectiveForScatter =
    selected.objective !== "Pareto Front" ? filteredData : dataObjective;

  const hasData =
    dataDF.length > 0 || dataPF.length > 0 || dataObjective.length > 0;

  return (
    <BrowserOnly fallback={<div>Loading 3D Scatter...</div>}>
      {() => {
        const Plot = require("react-plotly.js").default;

        return (
          <div>
            <div className="controls">
              {Object.entries({
                width: widths,
                length: lengths,
                height: heights,
                wwr: wwrs,
                objective: objectives,
              }).map(([key, values]) => (
                <div key={key} className="field">
                  <label>
                    {key === "objective"
                      ? "Objective"
                      : `Room ${key.charAt(0).toUpperCase() + key.slice(1)}`}
                    {key !== "wwr" && key !== "objective" && ":"}
                  </label>
                  <select
                    className="select"
                    value={selected[key as keyof typeof selected]}
                    onChange={(e) =>
                      handleChange(
                        key as keyof typeof selected,
                        e.target.value
                      )
                    }
                  >
                    {(values as string[]).map((v) => (
                      <option key={v} value={v}>
                        {key === "wwr" || key === "objective" ? v : `${v} m`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="view-tabs">
              <button
                className={
                  viewMode === "scatter" ? "view-tab active" : "view-tab"
                }
                onClick={() => setViewMode("scatter")}
              >
                Scatter
              </button>
              <button
                className={
                  viewMode === "parallel" ? "view-tab active" : "view-tab"
                }
                onClick={() => setViewMode("parallel")}
              >
                Parallel Coordinates
              </button>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : hasData ? (
              <>
                <div
                  style={{
                    display: viewMode === "scatter" ? "block" : "none",
                  }}
                >
                  <Plot
                    useResizeHandler
                    data={[
                      ...(hasFilter
                        ? []
                        : [
                            {
                              name: "Search Space",
                              type: "scatter3d",
                              mode: "markers",
                              x: dataDF.map((d) => d["Cooling Load (kWh)"]),
                              y: dataDF.map((d) => d["Heating Load (kWh)"]),
                              z: dataDF.map(
                                (d) => d["Artificial Lighting Load (kWh)"]
                              ),
                              customdata: dataDF.map(
                                (d) => d["UDI-a (%)"]
                              ),
                              hovertemplate: hoverTemplate,
                              marker: {
                                symbol: "square",
                                color: dataDF.map(
                                  (d) => d["UDI-a (%)"]
                                ),
                                colorscale: "Viridis",
                              },
                              showscale: false,
                            },
                          ]),
                      {
                        name: "UDI-a scale",
                        type: "scatter3d",
                        mode: "markers",
                        x: dataDF.map((d) => d["Cooling Load (kWh)"]),
                        y: dataDF.map((d) => d["Heating Load (kWh)"]),
                        z: dataDF.map(
                          (d) => d["Artificial Lighting Load (kWh)"]
                        ),
                        customdata: dataDF.map((d) => d["UDI-a (%)"]),
                        hoverinfo: "skip",
                        showlegend: false,
                        marker: {
                          symbol: "square",
                          size: 1,
                          opacity: 0,
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
                        x: paretoForScatter.map(
                          (d) => d["Cooling Load (kWh)"]
                        ),
                        y: paretoForScatter.map(
                          (d) => d["Heating Load (kWh)"]
                        ),
                        z: paretoForScatter.map(
                          (d) => d["Artificial Lighting Load (kWh)"]
                        ),
                        customdata: paretoForScatter.map(
                          (d) => d["UDI-a (%)"]
                        ),
                        hovertemplate: hoverTemplate,
                        marker: {
                          symbol: "cross",
                          color: paretoForScatter.map(
                            (d) => d["UDI-a (%)"]
                          ),
                          colorscale: "Viridis",
                        },
                        showscale: false,
                      },
                      ...(selected.objective !== "Pareto Front"
                        ? [
                            {
                              name: `${selected.objective} sheet`,
                              type: "scatter3d",
                              mode: "markers",
                              x: objectiveForScatter.map(
                                (d) => d["Cooling Load (kWh)"]
                              ),
                              y: objectiveForScatter.map(
                                (d) => d["Heating Load (kWh)"]
                              ),
                              z: objectiveForScatter.map(
                                (d) =>
                                  d["Artificial Lighting Load (kWh)"]
                              ),
                              customdata: objectiveForScatter.map(
                                (d) => d["UDI-a (%)"]
                              ),
                              hovertemplate: hoverTemplate,
                              marker: {
                                symbol: "diamond",
                                size: 8,
                                color:
                                  objectiveColorMap[selected.objective] ||
                                  "#FFFFFF",
                                opacity: 0.9,
                              },
                              showscale: false,
                            },
                          ]
                        : []),
                    ]}
                    layout={{
                      uirevision: "keep-state",
                      autosize: true,
                      paper_bgcolor: "rgba(0,0,0,0)",
                      plot_bgcolor: "rgba(0,0,0,0)",
                      margin: { t: 30, l: 0, r: 0, b: 0 },
                      scene: {
                        bgcolor: "rgba(0,0,0,0)",
                        xaxis: {
                          title: {
                            text: "Cooling Load (kWh)",
                            font: { color: "#444" },
                          },
                          range: xRange,
                          autorange: false,
                        },
                        yaxis: {
                          title: {
                            text: "Heating Load (kWh)",
                            font: { color: "#444" },
                          },
                          range: yRange,
                          autorange: false,
                        },
                        zaxis: {
                          title: {
                            text: "Lighting Load (kWh)",
                            font: { color: "#444" },
                          },
                          range: zRange,
                          autorange: false,
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
                    config={{
                      responsive: true,
                      displayModeBar: false,
                      displaylogo: false,
                    }}
                    style={{ width: "100%", height: "600px" }}
                    onClick={(event: any) => {
                      const point = event.points?.[0];
                      if (!point) return;

                      const x = point.x as number;
                      const y = point.y as number;
                      const z = point.z as number;

                      const sourceData =
                        selected.objective === "Pareto Front"
                          ? paretoForScatter
                          : objectiveForScatter;

                      if (!sourceData || sourceData.length === 0) return;

                      const idx = sourceData.findIndex(
                        (row) =>
                          row["Cooling Load (kWh)"] === x &&
                          row["Heating Load (kWh)"] === y &&
                          row["Artificial Lighting Load (kWh)"] === z
                      );

                      if (idx !== -1) {
                        setSelectedRowIndex(idx);
                      }
                    }}
                  />
                </div>

                <div
                  style={{
                    display: viewMode === "parallel" ? "block" : "none",
                  }}
                >
                  <ParallelPlot
  data={tableData}
  onFilterChange={(indices) => {
    setFilteredIndices((prev) => {
      const prevEmpty = !prev || prev.length === 0;
      const nextEmpty = !indices || indices.length === 0;

      const same =
        (prevEmpty && nextEmpty) ||
        (prev &&
          indices &&
          prev.length === indices.length &&
          prev.every((v, i) => v === indices[i]));

      // filtre değişmediyse seçimi de elleme
      if (same) {
        return prev;
      }

      // filtre gerçekten değiştiğinde hem filtreyi güncelle
      // hem de satır seçimini sıfırla
      setSelectedRowIndex(null);
      return indices || null;
    });
  }}
/>

                </div>

                <DataTable data={filteredData} selectedIndex={selectedRowIndex} />
              </>
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
