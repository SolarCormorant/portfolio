import React, { useState, useEffect, useCallback, useRef } from "react";
import * as Plotly from "plotly.js-dist";
import * as XLSX from "xlsx";

const UTCIExcelMeshVisualization = ({
  excelFilePath = "/utci_data.csv", // CSV formatını tercih edin
  objFilePath = "/mesh.obj",
  contextObjFilePath = "/context.obj",
  contextColor = "#9e9e9e", // <<— YENİ: Tek renk
  contextOpacity = 0.25, // <<— YENİ: Opaklık
  onSelectionChange,
}) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [meshData, setMeshData] = useState<any | null>(null);
  const [contextMeshData, setContextMeshData] = useState<any | null>(null); // <<— YENİ
  const [excelData, setExcelData] = useState<any | null>(null);
  const [intensityData, setIntensityData] = useState<number[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableHours, setAvailableHours] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const plotRef = useRef<HTMLDivElement | null>(null);

  // Excel/CSV dosyasını yükle ve parse et
  const loadExcelData = useCallback(async (filePath: string) => {
    try {
      if (filePath.endsWith(".csv")) {
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`CSV dosyası yüklenemedi: ${response.status}`);
        }
        const csvText = await response.text();
        const lines = csvText.trim().split("\n");

        const headerLine = lines[0].split(",");
        const headers = headerLine.map((h) => h.trim());

        const dateTimeMap: Record<string, Record<string, number>> = {};
        const dates = new Set<string>();
        const hours = new Set<string>();

        for (let i = 1; i < headers.length; i++) {
          const header = headers[i];
          if (!header) continue;

          const parts = header.replace(",", " ").trim().split(/\s+/);
          if (parts.length >= 3) {
            const date = `${parts[0]} ${parts[1]}`;
            const hour = parts[2];

            dates.add(date);
            hours.add(hour);

            if (!dateTimeMap[date]) {
              dateTimeMap[date] = {};
            }
            dateTimeMap[date][hour] = i;
          }
        }

        const dataRows: number[][] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",").map((v) => parseFloat(v.trim()));
          dataRows.push(row);
        }

        return {
          headers,
          dataRows,
          dateTimeMap,
          dates: Array.from(dates).sort(),
          hours: Array.from(hours).sort(),
        };
      }

      // Excel (xlsx)
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Excel dosyası yüklenemedi: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
        cellNF: false,
        cellText: false,
      });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const range = XLSX.utils.decode_range(worksheet["!ref"] as string);
      const headers: string[] = [];
      const dataRows: number[][] = [];

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
        headers.push(cell ? String(cell.v).trim() : "");
      }

      for (let R = 1; R <= range.e.r; ++R) {
        const row: number[] = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
          row.push(cell ? parseFloat(cell.v as any) : 0);
        }
        dataRows.push(row);
      }

      const dateTimeMap: Record<string, Record<string, number>> = {};
      const dates = new Set<string>();
      const hours = new Set<string>();

      for (let i = 1; i < headers.length; i++) {
        const header = headers[i];
        if (!header) continue;

        const parts = header.replace(/[,\t]/, " ").trim().split(/\s+/);
        if (parts.length >= 3) {
          const date = `${parts[0]} ${parts[1]}`;
          const hour = parts[2];

          dates.add(date);
          hours.add(hour);

          if (!dateTimeMap[date]) {
            dateTimeMap[date] = {};
          }
          dateTimeMap[date][hour] = i;
        }
      }

      return {
        headers,
        dataRows,
        dateTimeMap,
        dates: Array.from(dates).sort(),
        hours: Array.from(hours).sort(),
      };
    } catch (err) {
      console.error("Excel/CSV yükleme hatası:", err);

      // Basit test datası
      const testDates = ["03 Mar", "03 Jun", "03 Sep"];
      const testHours = ["08:00", "12:00", "16:00", "20:00"];
      const dateTimeMap: Record<string, Record<string, number>> = {};

      let colIndex = 1;
      for (const date of testDates) {
        dateTimeMap[date] = {};
        for (const hour of testHours) {
          dateTimeMap[date][hour] = colIndex++;
        }
      }

      const dataRows: number[][] = [];
      for (let i = 0; i < 50; i++) {
        const row: number[] = [i];
        for (let j = 1; j <= 12; j++) {
          row.push(Math.random() * 0.2);
        }
        dataRows.push(row);
      }

      return {
        headers: [
          "",
          "03 Mar 08:00",
          "03 Mar 12:00",
          "03 Mar 16:00",
          "03 Mar 20:00",
          "03 Jun 08:00",
          "03 Jun 12:00",
          "03 Jun 16:00",
          "03 Jun 20:00",
          "03 Sep 08:00",
          "03 Sep 12:00",
          "03 Sep 16:00",
          "03 Sep 20:00",
        ],
        dataRows,
        dateTimeMap,
        dates: testDates,
        hours: testHours,
      };
    }
  }, []);

  // OBJ dosyasını yükle
  const loadObjData = useCallback(async (filePath: string) => {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`OBJ dosyası yüklenemedi: ${response.status}`);
    }
    return await response.text();
  }, []);

  // OBJ parse et
  const parseObjData = useCallback((objContent: string) => {
    const vertices: number[][] = [];
    const faces: number[][] = [];

    const lines = objContent.split("\n");

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
        const faceIndices = parts
          .slice(1)
          .map((idx) => parseInt(idx.split("/")[0]) - 1);
        if (faceIndices.length === 3) {
          faces.push(faceIndices);
        } else if (faceIndices.length === 4) {
          faces.push([faceIndices[0], faceIndices[1], faceIndices[2]]);
          faces.push([faceIndices[0], faceIndices[2], faceIndices[3]]);
        }
      }
    }

    return { vertices, faces };
  }, []);

  // Seçilen tarih ve saate göre intensity değerlerini al
  const getIntensityValues = useCallback(
    (date: string, hour: string) => {
      if (!excelData || !date || !hour) {
        const faceCount = meshData?.faces.length || 50;
        return Array.from({ length: faceCount }, () => Math.random() * 0.2);
      }

      const columnIndex = excelData.dateTimeMap[date]?.[hour];
      if (columnIndex === undefined) {
        console.warn(`No data for ${date} ${hour}`);
        return [];
      }

      const values: number[] = [];
      for (let row of excelData.dataRows) {
        const value = parseFloat(row[columnIndex]);
        if (!isNaN(value)) values.push(value);
      }

      const faceCount = meshData?.faces.length || values.length;
      if (values.length === faceCount) return values;
      if (values.length < faceCount) {
        const result: number[] = [];
        for (let i = 0; i < faceCount; i++) result.push(values[i % values.length]);
        return result;
      }
      return values.slice(0, faceCount);
    },
    [excelData, meshData]
  );

  // Mesh'i render et
  const renderMesh = useCallback(() => {
    if (!plotRef.current || !meshData || !selectedDate || !selectedHour || loading)
      return;

    const intensity = getIntensityValues(selectedDate, selectedHour);
    if (intensity.length === 0) return;

    setIntensityData(intensity);

    const minVal = Math.min(0);
    const maxVal = Math.max(1);

    // Ana (renkli) mesh
    const mainTrace: Partial<Plotly.Data> = {
      type: "mesh3d",
      x: meshData.vertices.map((v: number[]) => v[0]),
      y: meshData.vertices.map((v: number[]) => v[1]),
      z: meshData.vertices.map((v: number[]) => v[2]),
      i: meshData.faces.map((f: number[]) => f[0]),
      j: meshData.faces.map((f: number[]) => f[1]),
      k: meshData.faces.map((f: number[]) => f[2]),
      intensitymode: "cell",
      intensity: intensity,
      colorscale: [
        [0, "#440154"],
        [0.2, "#31688e"],
        [0.4, "#35b779"],
        [0.6, "#fde725"],
        [0.8, "#f46d43"],
        [1, "#a50026"],
      ],
      cmin: minVal,
      cmax: maxVal,
      showscale: true,
      colorbar: {
        title: "UTCI Value",
        titleside: "right",
        len: 0.8,
        thickness: 20,
        tickformat: ".4f",
      },
      flatshading: false,
      lighting: { ambient: 0.7, diffuse: 0.8, specular: 0.2 },
    };

    // Context mesh (tek renk)
    const contextTrace: Partial<Plotly.Data> | null =
      contextMeshData &&
      ({
        type: "mesh3d",
        x: contextMeshData.vertices.map((v: number[]) => v[0]),
        y: contextMeshData.vertices.map((v: number[]) => v[1]),
        z: contextMeshData.vertices.map((v: number[]) => v[2]),
        i: contextMeshData.faces.map((f: number[]) => f[0]),
        j: contextMeshData.faces.map((f: number[]) => f[1]),
        k: contextMeshData.faces.map((f: number[]) => f[2]),
        intensitymode: "none",
        color: contextColor,
        opacity: contextOpacity,
        showscale: false,
        flatshading: true,
        lighting: { ambient: 0.6, diffuse: 0.5, specular: 0.1 },
      } as Partial<Plotly.Data>);

    const layout: Partial<Plotly.Layout> = {
      scene: {
        aspectmode: "data",
        camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } },
        xaxis: { title: " ", showticklabels: false, showgrid: false },
        yaxis: { title: " ", showticklabels: false, showgrid: false },
        zaxis: { title: " ", showticklabels: false, showgrid: false },
        bgcolor: "rgba(0,0,0,0)",
      },
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 60 },
      title: {
        text: `UTCI Thermal Analysis - ${selectedDate} at ${selectedHour}`,
        font: { size: 16 },
      },
      paper_bgcolor: "rgba(0,0,0,0)",
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
    };

    const traces = contextTrace ? [contextTrace, mainTrace] : [mainTrace];

    Plotly.newPlot(plotRef.current as any, traces as any, layout, config);

    if (onSelectionChange) onSelectionChange(selectedDate, selectedHour, intensity);
  }, [
    meshData,
    contextMeshData,
    selectedDate,
    selectedHour,
    getIntensityValues,
    onSelectionChange,
    loading,
    contextColor,
    contextOpacity,
  ]);

  // Dosyaları yükle
  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      setError("");

      try {
        // Excel
        const excel = await loadExcelData(excelFilePath);
        setExcelData(excel);
        setAvailableDates(excel.dates);
        setAvailableHours(excel.hours);
        if (excel.dates.length > 0) setSelectedDate(String(excel.dates[0]));
        if (excel.hours.length > 0) setSelectedHour(String(excel.hours[0]));

        // Ana OBJ (veya test mesh)
        try {
          const objData = await loadObjData(objFilePath);
          const parsed = parseObjData(objData);
          setMeshData(parsed);
        } catch (objError) {
          console.log("OBJ bulunamadı, test mesh oluşturuluyor...");
          const dataRowCount = excel.dataRows.length;
          const gridSize = Math.ceil(Math.sqrt(dataRowCount / 2));

          const vertices: number[][] = [];
          const faces: number[][] = [];

          for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
              vertices.push([
                (i / gridSize) * 2 - 1,
                (j / gridSize) * 2 - 1,
                Math.sin(i * 0.5) * Math.cos(j * 0.5) * 0.2,
              ]);
            }
          }

          for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
              const v1 = i * (gridSize + 1) + j;
              const v2 = v1 + 1;
              const v3 = v1 + gridSize + 1;
              const v4 = v3 + 1;

              faces.push([v1, v2, v3]);
              faces.push([v2, v4, v3]);

              if (faces.length >= dataRowCount) break;
            }
            if (faces.length >= dataRowCount) break;
          }

          setMeshData({ vertices, faces: faces.slice(0, dataRowCount) });
        }

        // Context OBJ yükleme (varsa)
        if (contextObjFilePath) {
          try {
            const ctxObj = await loadObjData(contextObjFilePath);
            const ctxParsed = parseObjData(ctxObj);
            setContextMeshData(ctxParsed);
          } catch (e) {
            console.warn("Context OBJ yüklenemedi, yok sayılıyor:", e);
            setContextMeshData(null);
          }
        } else {
          setContextMeshData(null);
        }
      } catch (err: any) {
        setError(`Hata: ${err.message}`);
        console.error("Dosya yükleme hatası:", err);
      }

      setLoading(false);
    };

    loadFiles();
  }, [
    excelFilePath,
    objFilePath,
    contextObjFilePath,
    loadExcelData,
    loadObjData,
    parseObjData,
  ]);

  // Render'ı tetikle
  useEffect(() => {
    renderMesh();
  }, [renderMesh]);

  const stats =
    intensityData.length > 0
      ? {
          min: Math.min(...intensityData).toFixed(4),
          max: Math.max(...intensityData).toFixed(4),
          avg: (
            intensityData.reduce((a, b) => a + b, 0) / intensityData.length
          ).toFixed(4),
        }
      : null;

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "400px",
        }}
      >
        <div style={{ fontSize: "18px" }}>
          Excel ve mesh dosyaları yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h3
          style={{
            fontSize: "22px",
            fontWeight: "bold",
            marginBottom: "20px",
            color: "#333",
          }}
        >
          UTCI Excel Data Visualization
        </h3>

        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              backgroundColor: "#fee",
              color: "#c00",
              borderRadius: "4px",
            }}
          >
            {error}
          </div>
        )}

        {/* ⬇⬇⬇ BURADA dropdownları scatter sayfasındaki gibi yaptım ⬇⬇⬇ */}
        <div className="controls">
          <div className="field">
            <label>Tarih Seçin</label>
            <select
              className="select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Saat Seçin</label>
            <select
              className="select"
              value={selectedHour}
              onChange={(e) => setSelectedHour(e.target.value)}
            >
              {availableHours.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* ⬆⬆⬆ Buradaki .controls + .field + .select senin scatter ile aynı yapı ⬆⬆⬆ */}

        <div
          style={{
            padding: "12px",
            backgroundColor: "#e3f2fd",
            borderRadius: "4px",
            fontSize: "13px",
            color: "#1565c0",
          }}
        >
          <strong>Veri Bilgisi</strong>
          <br />
          • Toplam {availableDates.length} tarih, {availableHours.length} saat
          <br />
          • Mesh: {meshData?.faces.length || 0} yüzey
          <br />
          • Seçilen: {selectedDate} {selectedHour}
          <br />
          {stats && (
            <>
              • Değer aralığı: {stats.min} - {stats.max}
              <br />
              • Ortalama: {stats.avg}
            </>
          )}
        </div>
      </div>

      <div
        ref={plotRef}
        style={{
          width: "100%",
          height: "600px",
          border: "1px solid rgba(0,0,0,0)",
          borderRadius: "8px",
          backgroundColor: "rgba(0,0,0,0)",
        }}
      />
    </div>
  );
};

export default UTCIExcelMeshVisualization;
