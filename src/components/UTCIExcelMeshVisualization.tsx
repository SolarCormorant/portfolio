import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Plotly from 'plotly.js-dist';
import * as XLSX from 'xlsx';

const UTCIExcelMeshVisualization = ({
  excelFilePath = "/utci_data.csv", // CSV formatını tercih edin
  objFilePath = "/mesh_model.obj",
  onSelectionChange,
}) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [meshData, setMeshData] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [intensityData, setIntensityData] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableHours, setAvailableHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const plotRef = useRef(null);

  // Excel/CSV dosyasını yükle ve parse et
  const loadExcelData = useCallback(async (filePath) => {
    try {
      // Önce CSV olarak deneyelim
      if (filePath.endsWith('.csv')) {
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`CSV dosyası yüklenemedi: ${response.status}`);
        }
        
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        
        // İlk satır header
        const headerLine = lines[0].split(',');
        const headers = headerLine.map(h => h.trim());
        
        // Tarih ve saatleri ayır
        const dateTimeMap = {};
        const dates = new Set();
        const hours = new Set();
        
        // Header'ları parse et (index 0'ı atla)
        for (let i = 1; i < headers.length; i++) {
          const header = headers[i];
          if (!header) continue;
          
          // "03 Mar 08:00" veya "03 Mar,08:00" formatını parse et
          const parts = header.replace(',', ' ').trim().split(/\s+/);
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
        
        // Veri satırlarını al
        const dataRows = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(v => parseFloat(v.trim()));
          dataRows.push(row);
        }
        
        console.log(`CSV loaded: ${dates.size} dates, ${hours.size} hours, ${dataRows.length} data rows`);
        
        return {
          headers,
          dataRows,
          dateTimeMap,
          dates: Array.from(dates).sort(),
          hours: Array.from(hours).sort()
        };
      }
      
      // Excel dosyası ise
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Excel dosyası yüklenemedi: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Raw data olarak al
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const headers = [];
      const dataRows = [];
      
      // Header'ları al (ilk satır)
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({r: 0, c: C})];
        headers.push(cell ? String(cell.v).trim() : '');
      }
      
      // Data satırlarını al
      for (let R = 1; R <= range.e.r; ++R) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = worksheet[XLSX.utils.encode_cell({r: R, c: C})];
          row.push(cell ? parseFloat(cell.v) : 0);
        }
        dataRows.push(row);
      }
      
      // Tarih ve saatleri parse et
      const dateTimeMap = {};
      const dates = new Set();
      const hours = new Set();
      
      for (let i = 1; i < headers.length; i++) {
        const header = headers[i];
        if (!header) continue;
        
        const parts = header.replace(/[,\t]/, ' ').trim().split(/\s+/);
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
      
      console.log(`Excel loaded: ${dates.size} dates, ${hours.size} hours, ${dataRows.length} data rows`);
      console.log('Headers:', headers.slice(0, 5));
      console.log('First data row:', dataRows[0]?.slice(0, 5));
      
      return {
        headers,
        dataRows,
        dateTimeMap,
        dates: Array.from(dates).sort(),
        hours: Array.from(hours).sort()
      };
      
    } catch (err) {
      console.error('Excel/CSV yükleme hatası:', err);
      
      // Test verisi döndür
      const testDates = ['03 Mar', '03 Jun', '03 Sep'];
      const testHours = ['08:00', '12:00', '16:00', '20:00'];
      const dateTimeMap = {};
      
      let colIndex = 1;
      for (const date of testDates) {
        dateTimeMap[date] = {};
        for (const hour of testHours) {
          dateTimeMap[date][hour] = colIndex++;
        }
      }
      
      // Test data rows
      const dataRows = [];
      for (let i = 0; i < 50; i++) {
        const row = [i];
        for (let j = 1; j <= 12; j++) {
          row.push(Math.random() * 0.2);
        }
        dataRows.push(row);
      }
      
      return {
        headers: ['', '03 Mar 08:00', '03 Mar 12:00', '03 Mar 16:00', '03 Mar 20:00',
                  '03 Jun 08:00', '03 Jun 12:00', '03 Jun 16:00', '03 Jun 20:00',
                  '03 Sep 08:00', '03 Sep 12:00', '03 Sep 16:00', '03 Sep 20:00'],
        dataRows,
        dateTimeMap,
        dates: testDates,
        hours: testHours
      };
    }
  }, []);

  // OBJ dosyasını yükle
  const loadObjData = useCallback(async (filePath) => {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`OBJ dosyası yüklenemedi: ${response.status}`);
      }
      const objContent = await response.text();
      return objContent;
    } catch (err) {
      console.error('OBJ yükleme hatası:', err);
      throw err;
    }
  }, []);

  // OBJ parse et
  const parseObjData = useCallback((objContent) => {
    const vertices = [];
    const faces = [];

    const lines = objContent.split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length === 0) continue;

      if (parts[0] === 'v') {
        vertices.push([
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        ]);
      } else if (parts[0] === 'f') {
        const faceIndices = parts.slice(1).map(idx => {
          return parseInt(idx.split('/')[0]) - 1;
        });
        
        if (faceIndices.length === 3) {
          faces.push(faceIndices);
        } else if (faceIndices.length === 4) {
          faces.push([faceIndices[0], faceIndices[1], faceIndices[2]]);
          faces.push([faceIndices[0], faceIndices[2], faceIndices[3]]);
        }
      }
    }

    console.log(`Parsed OBJ: ${vertices.length} vertices, ${faces.length} faces`);
    return { vertices, faces };
  }, []);

  // Seçilen tarih ve saate göre intensity değerlerini al
  const getIntensityValues = useCallback((date, hour) => {
    if (!excelData || !date || !hour) {
      const faceCount = meshData?.faces.length || 50;
      return Array.from({ length: faceCount }, (_, i) => Math.random() * 0.2);
    }
    
    const columnIndex = excelData.dateTimeMap[date]?.[hour];
    if (columnIndex === undefined) {
      console.warn(`No data for ${date} ${hour}`);
      return [];
    }
    
    // Veri satırlarından değerleri al
    const values = [];
    for (let row of excelData.dataRows) {
      const value = parseFloat(row[columnIndex]);
      if (!isNaN(value)) {
        values.push(value);
      }
    }
    
    console.log(`Got ${values.length} values for ${date} ${hour}`);
    console.log(`Range: ${Math.min(...values).toFixed(4)} - ${Math.max(...values).toFixed(4)}`);
    
    // Face sayısına göre ayarla
    const faceCount = meshData?.faces.length || values.length;
    if (values.length === faceCount) {
      return values;
    } else if (values.length < faceCount) {
      // Değerleri tekrarla
      const result = [];
      for (let i = 0; i < faceCount; i++) {
        result.push(values[i % values.length]);
      }
      return result;
    } else {
      // Fazla değerleri kes
      return values.slice(0, faceCount);
    }
  }, [excelData, meshData]);

  // Mesh'i render et
  const renderMesh = useCallback(() => {
    if (!plotRef.current || !meshData || !selectedDate || !selectedHour || loading) return;

    const intensity = getIntensityValues(selectedDate, selectedHour);
    if (intensity.length === 0) return;
    
    setIntensityData(intensity);

    const minVal = Math.min(...intensity);
    const maxVal = Math.max(...intensity);
    const range = maxVal - minVal;
    
    console.log('=== RENDER ===');
    console.log(`Date: ${selectedDate}, Hour: ${selectedHour}`);
    console.log(`Values: ${intensity.length} for ${meshData.faces.length} faces`);
    console.log(`Range: ${minVal.toFixed(4)} - ${maxVal.toFixed(4)}`);

    const trace = {
      type: 'mesh3d',
      x: meshData.vertices.map(v => v[0]),
      y: meshData.vertices.map(v => v[1]),
      z: meshData.vertices.map(v => v[2]),
      i: meshData.faces.map(f => f[0]),
      j: meshData.faces.map(f => f[1]),
      k: meshData.faces.map(f => f[2]),
      intensitymode: 'cell',
      intensity: intensity,
      colorscale: [
        [0, '#440154'],    // Mor
        [0.2, '#31688e'],  // Mavi
        [0.4, '#35b779'],  // Yeşil
        [0.6, '#fde725'],  // Sarı
        [0.8, '#f46d43'],  // Turuncu
        [1, '#a50026']     // Kırmızı
      ],
      cmin: minVal,
      cmax: maxVal,
      showscale: true,
      colorbar: {
        title: 'UTCI Value',
        titleside: 'right',
        len: 0.8,
        thickness: 20,
        tickformat: '.4f'
      },
      flatshading: false,
      lighting: {
        ambient: 0.7,
        diffuse: 0.8,
        specular: 0.2
      }
    };

    const layout = {
      scene: {
        aspectmode: 'data',
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        },
        xaxis: { title: ' ', showticklabels: false, showgrid: false },
        yaxis: { title: ' ', showticklabels: false, showgrid: false },
        zaxis: { title: ' ', showticklabels: false, showgrid: false },
        bgcolor: 'rgba(0,0,0,0)'
      },
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 60 },
      title: {
        text: `UTCI Thermal Analysis - ${selectedDate} at ${selectedHour}<br><sub>${intensity.length} values, Range: ${minVal.toFixed(3)}-${maxVal.toFixed(3)}</sub>`,
        font: { size: 16 }
      },
      paper_bgcolor: '#rgba(0,0,0,0)'
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false
    };

    Plotly.newPlot(plotRef.current, [trace], layout, config);

    if (onSelectionChange) {
      onSelectionChange(selectedDate, selectedHour, intensity);
    }
  }, [meshData, selectedDate, selectedHour, getIntensityValues, onSelectionChange, loading]);

  // Dosyaları yükle
  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      setError("");

      try {
        // Excel dosyasını yükle
        const excel = await loadExcelData(excelFilePath);
        setExcelData(excel);
        setAvailableDates(excel.dates);
        setAvailableHours(excel.hours);
        
        // İlk değerleri seç
        if (excel.dates.length > 0) setSelectedDate(String(excel.dates[0]));
        if (excel.hours.length > 0) setSelectedHour(String(excel.hours[0]));

        // OBJ dosyasını yükle veya test mesh oluştur
        try {
          const objData = await loadObjData(objFilePath);
          const parsed = parseObjData(objData);
          setMeshData(parsed);
        } catch (objError) {
          console.log('OBJ bulunamadı, test mesh oluşturuluyor...');
          
          // Test mesh - Excel'deki satır sayısına uygun
          const dataRowCount = excel.dataRows.length;
          const gridSize = Math.ceil(Math.sqrt(dataRowCount / 2));
          
          const vertices = [];
          const faces = [];
          
          // Grid vertices
          for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
              vertices.push([
                (i / gridSize) * 2 - 1,
                (j / gridSize) * 2 - 1,
                Math.sin(i * 0.5) * Math.cos(j * 0.5) * 0.2
              ]);
            }
          }
          
          // Grid faces
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
          
          setMeshData({ 
            vertices, 
            faces: faces.slice(0, dataRowCount) 
          });
        }

      } catch (err) {
        setError(`Hata: ${err.message}`);
        console.error('Dosya yükleme hatası:', err);
      }

      setLoading(false);
    };

    loadFiles();
  }, [excelFilePath, objFilePath, loadExcelData, loadObjData, parseObjData]);

  // Render'ı tetikle
  useEffect(() => {
    renderMesh();
  }, [renderMesh]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px' 
      }}>
        <div style={{ fontSize: '18px' }}>Excel ve mesh dosyaları yükleniyor...</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ 
        backgroundColor: '#f9f9f9', 
        borderRadius: '8px', 
        padding: '20px', 
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ 
          fontSize: '22px', 
          fontWeight: 'bold', 
          marginBottom: '20px', 
          color: '#333' 
        }}>
          UTCI Excel Data Visualization
        </h3>
        
        {error && (
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            backgroundColor: '#fee', 
            color: '#c00', 
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '20px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#555', 
              marginBottom: '8px' 
            }}>
              Tarih Seçin:
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid rgba(0,0,0,0)',
                backgroundColor: 'white',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {availableDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#555', 
              marginBottom: '8px' 
            }}>
              Saat Seçin:
            </label>
            <select
              value={selectedHour}
              onChange={(e) => setSelectedHour(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid rgba(0,0,0,0)',
                backgroundColor: 'white',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {availableHours.map(hour => (
                <option key={hour} value={hour}>{hour}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '4px',
          fontSize: '13px',
          color: '#1565c0'
        }}>
          <strong>Veri Bilgisi:</strong><br/>
          • Toplam {availableDates.length} tarih, {availableHours.length} saat<br/>
          • Mesh: {meshData?.faces.length || 0} yüzey<br/>
          • Seçilen: {selectedDate} {selectedHour}<br/>
          {intensityData.length > 0 && (
            <>
              • Değer aralığı: {Math.min(...intensityData).toFixed(4)} - {Math.max(...intensityData).toFixed(4)}<br/>
              • Ortalama: {(intensityData.reduce((a,b) => a+b, 0) / intensityData.length).toFixed(4)}
            </>
          )}
        </div>
      </div>

      <div 
        ref={plotRef} 
        style={{ 
          width: '100%', 
          height: '600px', 
          border: '1px solid  rgba(0,0,0,0)', 
          borderRadius: '8px', 
          backgroundColor: 'rgba(0,0,0,0)'
        }}
      />
    </div>
  );
};

export default UTCIExcelMeshVisualization;