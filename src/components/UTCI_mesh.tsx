import React, { useCallback, useEffect, useRef, useState } from "react";
import BrowserOnly from '@docusaurus/BrowserOnly';
import useIsBrowser from '@docusaurus/useIsBrowser';

const DEFAULT_DATES = ["19 Mar", "20 Mar", "21 Mar", "22 Mar", "23 Mar", "24 Mar", "25 Mar"];
const DEFAULT_HOURS = Array.from({ length: 15 }, (_, i) => i + 8);

// Sample OBJ data for a simple cube
const SAMPLE_OBJ = `
v -1.0 -1.0  1.0
v  1.0 -1.0  1.0
v  1.0  1.0  1.0
v -1.0  1.0  1.0
v -1.0 -1.0 -1.0
v  1.0 -1.0 -1.0
v  1.0  1.0 -1.0
v -1.0  1.0 -1.0
f 1 2 3
f 1 3 4
f 5 8 7
f 5 7 6
f 1 5 6
f 1 6 2
f 2 6 7
f 2 7 3
f 3 7 8
f 3 8 4
f 5 1 4
f 5 4 8
`;

const UTCIMeshVisualizationInner = ({
  excelUrl = "/static/data/myExcel.xlsx",
  objUrl = "/static/data/sample.obj",     
  defaultDate = DEFAULT_DATES[0],
  defaultHour = DEFAULT_HOURS[0],
  dateLabels = DEFAULT_DATES,
  hours = DEFAULT_HOURS,
  onSelectionChange,
}) => {
  const plotRef = useRef(null);
  const [meshData, setMeshData] = useState(null);
  const [excelMatrix, setExcelMatrix] = useState([]);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedHour, setSelectedHour] = useState(defaultHour);
  const [intensityData, setIntensityData] = useState([]);
  const [loading, setLoading] = useState({ obj: true, excel: true, plotly: true });
  const [error, setError] = useState(null);
  const [useDemo, setUseDemo] = useState(false);
  const [Plotly, setPlotly] = useState(null);
  const [XLSX, setXLSX] = useState(null);

  // Dynamically import libraries only on browser
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        const [plotlyModule, xlsxModule] = await Promise.all([
          import('plotly.js-dist'),
          import('xlsx')
        ]);
        setPlotly(plotlyModule.default);
        setXLSX(xlsxModule.default);
        setLoading(p => ({ ...p, plotly: false }));
      } catch (e) {
        console.error("Failed to load libraries:", e);
        setError("Failed to load required libraries");
        setLoading(p => ({ ...p, plotly: false }));
      }
    };

    loadLibraries();
  }, []);

  const parseObjData = useCallback((objContent) => {
    const vertices = [];
    const faces = [];
    const lines = objContent.split("\n");
    
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      
      const parts = line.split(/\s+/);
      if (parts[0] === "v" && parts.length >= 4) {
        vertices.push([
          parseFloat(parts[1]), 
          parseFloat(parts[2]), 
          parseFloat(parts[3])
        ]);
      } else if (parts[0] === "f" && parts.length >= 4) {
        const idxs = parts.slice(1).map((tok) => 
          parseInt(tok.split("/")[0], 10) - 1
        );
        if (idxs.length >= 3) {
          faces.push(idxs.slice(0, 3));
        }
      }
    }
    
    return { vertices, faces };
  }, []);

  // Load OBJ data
  useEffect(() => {
    let cancelled = false;
    setLoading((p) => ({ ...p, obj: true }));
    setError(null);
    
    const loadObjData = async () => {
      try {
        let objContent = SAMPLE_OBJ;
        let usedDemo = false;
        
        if (objUrl) {
          try {
            const res = await fetch(objUrl);
            if (!res.ok) throw new Error(`OBJ fetch failed: ${res.status}`);
            objContent = await res.text();
            console.log("OBJ file loaded successfully");
          } catch (fetchError) {
            console.warn("Could not load OBJ file, using demo data:", fetchError);
            setUseDemo(true);
            usedDemo = true;
            objContent = SAMPLE_OBJ; // Ensure we use sample data
          }
        } else {
          setUseDemo(true);
          usedDemo = true;
        }
        
        if (cancelled) return;
        
        console.log("Parsing OBJ content, demo mode:", usedDemo);
        const parsed = parseObjData(objContent);
        console.log("Parsed mesh data:", parsed);
        
        setMeshData(parsed);
      } catch (e) {
        if (!cancelled) {
          console.error("OBJ loading error:", e);
          // Fallback to demo data even on parse error
          console.log("Falling back to demo data due to error");
          setUseDemo(true);
          const demoData = parseObjData(SAMPLE_OBJ);
          setMeshData(demoData);
        }
      } finally {
        if (!cancelled) setLoading((p) => ({ ...p, obj: false }));
      }
    };

    loadObjData();
    
    return () => {
      cancelled = true;
    };
  }, [objUrl, parseObjData]);

  // Load Excel data
  useEffect(() => {
    if (!excelUrl || !XLSX) {
      setLoading((p) => ({ ...p, excel: false }));
      return;
    }
    
    let cancelled = false;
    setLoading((p) => ({ ...p, excel: true }));
    
    const loadExcelData = async () => {
      try {
        console.log("Attempting to load Excel from:", excelUrl);
        const res = await fetch(excelUrl);
        
        console.log("Excel fetch response:", {
          status: res.status,
          statusText: res.statusText,
          contentType: res.headers.get("content-type"),
          url: res.url
        });
        
        if (!res.ok) {
          const responseText = await res.text();
          console.log("Error response body:", responseText.substring(0, 200));
          throw new Error(`Excel fetch failed: HTTP ${res.status} ${res.statusText}`);
        }
        
        const contentType = res.headers.get("content-type") || "";
        console.log("Content type:", contentType);
        
        if (contentType.includes("text/html")) {
          const htmlContent = await res.text();
          console.log("Received HTML instead of Excel:", htmlContent.substring(0, 200));
          throw new Error(`Received HTML page instead of Excel file. Check if file exists at: ${excelUrl}`);
        }
        
        let wb;
        
        if (excelUrl.toLowerCase().endsWith(".csv") || 
            contentType.includes("csv") || 
            contentType.includes("text/plain")) {
          const text = await res.text();
          wb = XLSX.read(text, { type: "string" });
        } else {
          const ab = await res.arrayBuffer();
          wb = XLSX.read(ab, { type: "array" });
        }
        
        if (!wb.SheetNames.length) throw new Error("Workbook has no sheets");
        
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        if (!ws) throw new Error(`Worksheet '${wsName}' not found`);
        
        const rows = XLSX.utils.sheet_to_json(ws, { 
          header: 1, 
          defval: null 
        });
        
        if (!rows.length) throw new Error("Worksheet is empty");
        
        let matrix = rows;
        
        if (rows.length > 1) {
          const firstRow = rows[0];
          const hasString = firstRow.some((c) => typeof c === "string");
          const nextRowNumeric = rows[1]?.some((c) => typeof c === "number");
          if (hasString && nextRowNumeric) {
            matrix = rows.slice(1);
          }
        }
        
        console.log("Excel data loaded successfully:", {
          rows: matrix.length,
          columns: matrix[0]?.length || 0
        });
        
        if (!cancelled) setExcelMatrix(matrix);
      } catch (e) {
        if (!cancelled) {
          console.error("Excel loading error:", e);
          setError(`Excel file could not be loaded: ${e.message || e}`);
        }
      } finally {
        if (!cancelled) setLoading((p) => ({ ...p, excel: false }));
      }
    };

    loadExcelData();
    
    return () => {
      cancelled = true;
    };
  }, [excelUrl, XLSX]);

  const computeIntensity = useCallback((dateLabel, hourVal) => {
    if (!excelMatrix?.length || !meshData?.vertices?.length) {
      // Generate demo data based on vertex positions for better visualization
      const vertexCount = meshData?.vertices?.length ?? 8;
      console.log("Generating demo data for", vertexCount, "vertices");
      return Array.from({ length: vertexCount }, (_, i) => {
        const base = 20 + Math.sin(i * 0.5 + hourVal * 0.1) * 15;
        const dateVariation = dateLabels.indexOf(dateLabel) * 2;
        return Math.max(10, base + dateVariation + Math.random() * 5);
      });
    }
    
    const dIdx = dateLabels.indexOf(dateLabel);
    const hIdx = hours.indexOf(hourVal);
    const colIndex = dIdx >= 0 && hIdx >= 0 ? dIdx * hours.length + hIdx : 0;
    
    const colValues = excelMatrix.map((row) => {
      const v = row?.[colIndex];
      const num = typeof v === "number" ? v : parseFloat(v);
      return Number.isFinite(num) ? num : 0;
    });
    
    const vCount = meshData?.vertices?.length ?? colValues.length;
    if (colValues.length === vCount) return colValues;
    if (colValues.length > vCount) return colValues.slice(0, vCount);
    
    return [...colValues, ...Array.from({ length: vCount - colValues.length }, () => 0)];
  }, [excelMatrix, meshData?.vertices?.length, dateLabels, hours]);

  const drawPlot = useCallback(() => {
    if (!plotRef.current || !meshData || !Plotly) {
      console.log("Cannot draw plot:", { 
        hasPlotRef: !!plotRef.current, 
        hasMeshData: !!meshData, 
        hasPlotly: !!Plotly,
        meshVertices: meshData?.vertices?.length,
        meshFaces: meshData?.faces?.length
      });
      return;
    }
    
    console.log("Drawing plot with mesh data:", meshData);
    const intens = computeIntensity(selectedDate, selectedHour);
    console.log("Computed intensity:", intens);
    setIntensityData(intens);
    
    const trace = {
      type: "mesh3d",
      x: meshData.vertices.map((v) => v[0]),
      y: meshData.vertices.map((v) => v[1]),
      z: meshData.vertices.map((v) => v[2]),
      i: meshData.faces.map((f) => f[0]),
      j: meshData.faces.map((f) => f[1]),
      k: meshData.faces.map((f) => f[2]),
      intensity: intens,
      colorscale: "Viridis",
      showscale: true,
      colorbar: { 
        title: "UTCI Value (°C)", 
        titleside: "right",
        x: 1.02
      },
      hovertemplate: "UTCI: %{intensity:.1f}°C<extra></extra>",
    };
    
    console.log("Plotly trace:", trace);
    
    const layout = {
      scene: { 
        aspectmode: "data", 
        camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } }, 
        bgcolor: "rgba(240,240,240,0.1)",
        xaxis: { title: "X" },
        yaxis: { title: "Y" },
        zaxis: { title: "Z" }
      },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 50, b: 0, t: 0 },
      autosize: true,
    };
    
    const config = { 
      responsive: true, 
      displayModeBar: true, 
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d']
    };
    
    Plotly.react(plotRef.current, [trace], layout, config);
    
    if (onSelectionChange) {
      onSelectionChange(selectedDate, selectedHour, intens);
    }
  }, [meshData, computeIntensity, selectedDate, selectedHour, onSelectionChange, Plotly]);

  useEffect(() => {
    drawPlot();
  }, [drawPlot]);

  useEffect(() => {
    if (!plotRef.current || !Plotly) return;
    
    const handleResize = () => {
      if (plotRef.current) {
        Plotly.Plots.resize(plotRef.current);
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [Plotly]);

  const anyLoading = loading.obj || loading.excel || loading.plotly;
  const stats = intensityData.length > 0 ? {
    min: Math.min(...intensityData).toFixed(1),
    max: Math.max(...intensityData).toFixed(1),
    avg: (intensityData.reduce((a, b) => a + b, 0) / intensityData.length).toFixed(1)
  } : null;

  return (
    <div className="w-full">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          🌡️ UTCI Mesh Visualization Controls
          {useDemo && (
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              Demo Mode
            </span>
          )}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Date: <span className="font-bold text-blue-600">{selectedDate}</span>
            </label>
            <input
              type="range"
              min={0}
              max={dateLabels.length - 1}
              value={Math.max(0, dateLabels.indexOf(selectedDate))}
              onChange={(e) => setSelectedDate(dateLabels[parseInt(e.target.value, 10)])}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{dateLabels[0]}</span>
              <span>{dateLabels[dateLabels.length - 1]}</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🕐 Hour: <span className="font-bold text-green-600">{selectedHour}:00</span>
            </label>
            <input
              type="range"
              min={hours[0]}
              max={hours[hours.length - 1]}
              value={selectedHour}
              onChange={(e) => setSelectedHour(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{hours[0]}:00</span>
              <span>{hours[hours.length - 1]}:00</span>
            </div>
          </div>
        </div>
        
        {stats && (
          <div className="mt-4 p-3 bg-white rounded border">
            <h4 className="text-sm font-medium text-gray-700 mb-2">📊 Current Statistics</h4>
            <div className="flex gap-4 text-sm">
              <span>Min: <strong className="text-blue-600">{stats.min}°C</strong></span>
              <span>Max: <strong className="text-red-600">{stats.max}°C</strong></span>
              <span>Avg: <strong className="text-green-600">{stats.avg}°C</strong></span>
            </div>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">🔍 Debug Info</h4>
          <div className="text-xs space-y-1">
            <div>Excel URL: <code className="bg-white px-1">{excelUrl || "Not provided"}</code></div>
            <div>OBJ URL: <code className="bg-white px-1">{objUrl || "Not provided"}</code></div>
            <div>Excel Data: {excelMatrix.length > 0 ? `${excelMatrix.length} rows × ${excelMatrix[0]?.length || 0} cols` : "No data"}</div>
            <div>Mesh Data: {meshData ? `${meshData.vertices.length} vertices, ${meshData.faces.length} faces` : "No mesh"}</div>
            <div>Status: {anyLoading ? "Loading..." : error ? `Error: ${error}` : "Ready"}</div>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
        <div 
          ref={plotRef} 
          style={{ width: "100%", height: "500px" }}
          className="relative"
        >
          {anyLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div className="text-gray-600">Loading data...</div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
              <div className="text-center p-4">
                <div className="text-red-600 font-medium mb-2">⚠️ Error Loading Data</div>
                <div className="text-red-500 text-sm">{error}</div>
                <div className="text-xs text-gray-500 mt-2">
                  Using demo data for visualization
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">📁 File Requirements</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <div>
            <strong>OBJ File:</strong> <code className="bg-white px-2 py-1 rounded">/static/data/sample.obj</code>
            <br />
            <span className="text-xs">3D mesh geometry with vertices and faces</span>
          </div>
          <div>
            <strong>Excel File:</strong> <code className="bg-white px-2 py-1 rounded">/static/data/myExcel.xlsx</code>
            <br />
            <span className="text-xs">UTCI data matrix (rows: vertices, cols: time)</span>
          </div>
        </div>
        <div className="border-t pt-3">
          <h5 className="font-medium text-blue-800 mb-1">ℹ️ About UTCI</h5>
          <p className="text-xs">
            The Universal Thermal Climate Index (UTCI) measures human thermal comfort 
            considering air temperature, humidity, wind speed, and solar radiation. 
            Values range from extreme cold (-40°C) to extreme heat stress (+50°C).
          </p>
        </div>
      </div>
    </div>
  );
};

const UTCIMeshVisualization = (props) => {
  const isBrowser = useIsBrowser();
  
  if (!isBrowser) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-2">🌡️ UTCI Mesh Visualization</div>
          <div className="text-sm text-gray-500">Loading interactive 3D visualization...</div>
        </div>
      </div>
    );
  }

  return (
    <BrowserOnly fallback={
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-2">🌡️ UTCI Mesh Visualization</div>
          <div className="text-sm text-gray-500">Loading interactive 3D visualization...</div>
        </div>
      </div>
    }>
      {() => <UTCIMeshVisualizationInner {...props} />}
    </BrowserOnly>
  );
};

export default UTCIMeshVisualization;