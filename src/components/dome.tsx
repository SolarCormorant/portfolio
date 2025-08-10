import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";

/** ===== Types & Defaults ===== */

type Season = "annual" | "winter" | "spring" | "summer" | "autumn";
type ProjectionKey = "3D" | "ortho" | "stereo";

interface SolarAnalysisProps {
  epwUrl?: string;                 // "/data/ist.epw"
  skyDomeXlsUrl?: string;          // "/data/skydome.xls"
  domeObjUrl3D?: string;           // "/data/3D.obj"
  domeObjUrlOrtho?: string;        // "/data/ortho.obj"
  domeObjUrlStereo?: string;       // "/data/stereo.obj"
  radiationRoseXlsUrl?: string;    // "/data/radiation_rose.xls"
  radXlsUrl?: string;              // "/data/rad.xls"
  radObjUrl?: string;              // "/data/rad.obj"
  radSurfaceXlsUrl?: string;       // "/data/radiation_surface.xls"
}

const TEXT_COLOR = "#839496";
const PALETTE = "Sunset"; // Plotly built-in palette
const HEATMAP_OPTIONS = [
  { label: "ExtHorzRad", value: "ExtHorzRad" },
  { label: "ExtDirRad", value: "ExtDirRad" },
  { label: "HorzIRSky", value: "HorzIRSky" },
  { label: "DirNormRad", value: "DirNormRad" },
  { label: "DifHorzRad", value: "DifHorzRad" },
];
const PROJECTIONS: ProjectionKey[] = ["3D", "ortho", "stereo"];
const SEASONS: Season[] = ["annual", "winter", "spring", "summer", "autumn"];

/** ===== Helpers ===== */

const EPW_COLS = [
  "Year","Month","Day","Hour","Minute","Index","DryBulb","DewPoint","RelHum","AtmosPressure",
  "ExtHorzRad","ExtDirRad","HorzIRSky","GloHorzRad","DirNormRad","DifHorzRad","GloHorzIllum",
  "DirNormIllum","DifHorzIllum","ZenLum","WindDir","WindSpd","TotSkyCvr","OpaqSkyCvr",
  "Visibility","CeilingHgt","PresWeathObs","PresWeathCodes","PrecipWtr","AerosolOptDepth",
  "SnowDepth","DaysLastSnow","Albedo","Rain","RainQuantity"
] as const;
type EpwRecord = Record<(typeof EPW_COLS)[number], number> & { monthDay: string };

function parseEPW(text: string): EpwRecord[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const dataLines = lines.filter(l => /(^\s*\d{4}\s*,)/.test(l) || l.split(",").length >= EPW_COLS.length);
  const out: EpwRecord[] = [];
  for (const l of dataLines) {
    const parts = l.split(",").map(s => s.trim());
    if (parts.length < EPW_COLS.length) continue;
    const rec: any = {};
    EPW_COLS.forEach((k, i) => {
      const v = Number(parts[i]);
      rec[k] = Number.isFinite(v) ? v : 0;
    });
    const mm = String(rec["Month"]).padStart(2, "0");
    const dd = String(rec["Day"]).padStart(2, "0");
    rec.monthDay = `${mm}-${dd}`;
    out.push(rec as EpwRecord);
  }
  return out;
}

interface MeshData { vertices: number[][]; faces: number[][]; }
// OBJ parser + n-gon triangulation (fan)
function parseOBJ(objText: string): MeshData {
  const vertices: number[][] = [];
  const faces: number[][] = [];
  for (const raw of objText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === "v" && parts.length >= 4) {
      vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (parts[0] === "f" && parts.length >= 4) {
      const idxs = parts.slice(1).map(tok => (parseInt(tok.split("/")[0], 10) - 1));
      if (idxs.length === 3) {
        faces.push([idxs[0], idxs[1], idxs[2]]);
      } else if (idxs.length > 3) {
        for (let k = 1; k < idxs.length - 1; k++) faces.push([idxs[0], idxs[k], idxs[k + 1]]);
      }
    }
  }
  return { vertices, faces };
}

/** ===== Exported wrapper (BrowserOnly) ===== */

const SolarAnalysis: React.FC<SolarAnalysisProps> = ({
  epwUrl = "/data/ist.epw",
  skyDomeXlsUrl = "/data/skydome.xls",
  domeObjUrl3D = "/data/3D.obj",
  domeObjUrlOrtho = "/data/ortho.obj",
  domeObjUrlStereo = "/data/stereo.obj",
  radiationRoseXlsUrl = "/data/radiation_rose.xls",
  radXlsUrl = "/data/rad.xls",
  radObjUrl = "/data/rad.obj",
  radSurfaceXlsUrl = "/data/radiation_surface.xls",
}) => {
  return (
    <BrowserOnly fallback={<div>Loading Solar Analysis…</div>}>
      {() => (
        <ClientSolarAnalysis
          epwUrl={epwUrl}
          skyDomeXlsUrl={skyDomeXlsUrl}
          domeObjUrl3D={domeObjUrl3D}
          domeObjUrlOrtho={domeObjUrlOrtho}
          domeObjUrlStereo={domeObjUrlStereo}
          radiationRoseXlsUrl={radiationRoseXlsUrl}
          radXlsUrl={radXlsUrl}
          radObjUrl={radObjUrl}
          radSurfaceXlsUrl={radSurfaceXlsUrl}
        />
      )}
    </BrowserOnly>
  );
};

export default SolarAnalysis;

/** ===== Client-Only Impl ===== */

const ClientSolarAnalysis: React.FC<SolarAnalysisProps> = (props) => {
  const {
    epwUrl, skyDomeXlsUrl,
    domeObjUrl3D, domeObjUrlOrtho, domeObjUrlStereo,
    radiationRoseXlsUrl, radXlsUrl, radObjUrl, radSurfaceXlsUrl,
  } = props;

  const plotRefHeat = useRef<HTMLDivElement>(null);
  const plotRefDome = useRef<HTMLDivElement>(null);
  const plotRefRose = useRef<HTMLDivElement>(null);
  const plotRefRad = useRef<HTMLDivElement>(null);
  const plotRefRadLine = useRef<HTMLDivElement>(null);

  const [Plotly, setPlotly] = useState<any>(null);
  const [XLSX, setXLSX] = useState<any>(null);

  const [epw, setEpw] = useState<EpwRecord[]>([]);
  const [domeMesh, setDomeMesh] = useState<MeshData | null>(null);
  const [domeSeasonVals, setDomeSeasonVals] = useState<number[] | null>(null);
  const [radMesh, setRadMesh] = useState<MeshData | null>(null);
  const [radVals, setRadVals] = useState<number[] | null>(null);
  const [roseDf, setRoseDf] = useState<any[] | null>(null);
  const [radSurfaceDf, setRadSurfaceDf] = useState<any[] | null>(null);

  const [proj, setProj] = useState<ProjectionKey>("3D");
  const [season, setSeason] = useState<Season>("annual");
  const [tilt, setTilt] = useState<number>(90);
  const [heatVar, setHeatVar] = useState<string>("ExtHorzRad");

  const [error, setError] = useState<string | null>(null);

  // libs
  useEffect(() => {
    (async () => {
      try {
        const [p, x] = await Promise.all([import("plotly.js-dist"), import("xlsx")]);
        setPlotly(p);
        setXLSX(x);
      } catch {
        setError("Plotly/XLSX yüklenemedi");
      }
    })();
  }, []);

  // EPW
  useEffect(() => {
    if (!Plotly) return;
    (async () => {
      try {
        const res = await fetch(epwUrl!);
        if (!res.ok) throw new Error("EPW fetch failed");
        const text = await res.text();
        setEpw(parseEPW(text));
      } catch (e: any) {
        setError(`EPW yüklenemedi: ${e.message || e}`);
      }
    })();
  }, [Plotly, epwUrl]);

  // Dome xls + obj
  const domeObjUrl = useMemo(
    () => ({ "3D": domeObjUrl3D!, "ortho": domeObjUrlOrtho!, "stereo": domeObjUrlStereo! } as Record<ProjectionKey, string>),
    [domeObjUrl3D, domeObjUrlOrtho, domeObjUrlStereo]
  );

  useEffect(() => {
    if (!XLSX || !Plotly) return;
    (async () => {
      try {
        const resX = await fetch(skyDomeXlsUrl!);
        if (!resX.ok) throw new Error("skydome.xls fetch failed");
        const ab = await resX.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[String(proj)];
        if (!ws) throw new Error(`Sheet '${proj}' not found in skydome.xls`);
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        const header = rows[0] as string[];
        const sIdx = header.findIndex(h => String(h).toLowerCase() === season);
        const vals = rows.slice(1).map(r => Number(r[sIdx]) || 0);
        setDomeSeasonVals(vals);

        const resO = await fetch(domeObjUrl[proj]);
        if (!resO.ok) throw new Error(`${proj}.obj fetch failed`);
        const text = await resO.text();
        setDomeMesh(parseOBJ(text));
      } catch (e: any) {
        setError(`Dome yüklenemedi: ${e.message || e}`);
      }
    })();
  }, [XLSX, Plotly, skyDomeXlsUrl, proj, season, domeObjUrl]);

  // Radiation rose
  useEffect(() => {
    if (!XLSX) return;
    (async () => {
      try {
        const res = await fetch(radiationRoseXlsUrl!);
        if (!res.ok) throw new Error("radiation_rose.xls fetch failed");
        const ab = await res.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[String(season)];
        if (!ws) throw new Error(`Sheet '${season}' not found in radiation_rose.xls`);
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        const header = rows[0] as string[]; // [Angle, 0,10,...,90]
        const data = rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [String(h), r[i]])));
        setRoseDf(data);
      } catch (e: any) {
        setError(`Radiation rose yüklenemedi: ${e.message || e}`);
      }
    })();
  }, [XLSX, radiationRoseXlsUrl, season]);

  // rad.xls + rad.obj (season ile kontrol)
  useEffect(() => {
    if (!XLSX) return;
    (async () => {
      try {
        const [rx, ro] = await Promise.all([fetch(radXlsUrl!), fetch(radObjUrl!)]);
        if (!rx.ok) throw new Error("rad.xls fetch failed");
        if (!ro.ok) throw new Error("rad.obj fetch failed");
        const ab = await rx.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        const header = rows[0] as string[];
        const sIdx = header.findIndex(h => String(h).toLowerCase() === season);
        const vals = rows.slice(1).map(r => Number(r[sIdx]) || 0);
        setRadVals(vals.flatMap(v => [v, v, v])); // Dash'teki np.repeat(..., 3)
        const text = await ro.text();
        setRadMesh(parseOBJ(text));
      } catch (e: any) {
        setError(`rad mesh yüklenemedi: ${e.message || e}`);
      }
    })();
  }, [XLSX, radXlsUrl, radObjUrl, season]);

  // radiation_surface.xls (Sheet2) — season ile filtre
  useEffect(() => {
    if (!XLSX) return;
    (async () => {
      try {
        const res = await fetch(radSurfaceXlsUrl!);
        if (!res.ok) throw new Error("radiation_surface.xls fetch failed");
        const ab = await res.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets["Sheet2"] || wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        const [header, ...rest] = rows as [string[], ...any[][]];
        const idx = {
          Facade: header.findIndex(h => String(h).toLowerCase() === "facade"),
          Value: header.findIndex(h => String(h).toLowerCase() === "value"),
          Hour: header.findIndex(h => String(h).toLowerCase() === "hour"),
          Date: header.findIndex(h => String(h).toLowerCase() === "date"),
        };
        const data = rest.map(r => ({
          Facade: r[idx.Facade],
          Value: Number(r[idx.Value]) || 0,
          Hour: r[idx.Hour],
          Date: String(r[idx.Date]).toLowerCase(),
        })).filter(x => x.Date === String(season));
        setRadSurfaceDf(data);
      } catch (e: any) {
        setError(`radiation_surface yüklenemedi: ${e.message || e}`);
      }
    })();
  }, [XLSX, radSurfaceXlsUrl, season]);

  /** ===== DRAW ===== */

  const drawHeatmap = useCallback(() => {
    if (!Plotly || !plotRefHeat.current || !epw.length) return;
    const byDay: Record<string, (number|null)[]> = {};
    for (const r of epw) {
      const key = r.monthDay; // MM-DD
      if (!byDay[key]) byDay[key] = new Array(24).fill(null);
      // EPW Hour bazen 24 olabilir → 0 olarak kabul et
      const hrRaw = Number(r["Hour"]);
      const hr = Math.max(0, Math.min(23, (hrRaw === 24 ? 0 : hrRaw)));
      byDay[key][hr] = (r as any)[heatVar] ?? null;
    }
    const days = Object.keys(byDay).sort(); // 01-01 .. 12-31
    const z = days.map(d => byDay[d]);
    const xVals = Array.from({length:24}, (_,h)=> h);
    const xTickText = xVals.map(h => String(h).padStart(2,"0"));

    Plotly.react(plotRefHeat.current, [{
      type: "heatmap",
      z, x: xVals, y: days,
      colorscale: PALETTE,
      colorbar: { title: heatVar, tickfont: { color: TEXT_COLOR } },
      hovertemplate: "%{y} - %{x}:00<br>"+heatVar+": %{z}<extra></extra>",
    }], {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: TEXT_COLOR },
      margin: { l: 20, r: 20, t: 20, b: 20 }, height: 420,
      xaxis: { title: "Hour", tickmode: "array", tickvals: xVals, ticktext: xTickText, gridcolor: "#586e75" },
      yaxis: { title: "Date (MM-DD)", type: "category", gridcolor: "#586e75" },
    }, { displaylogo: false, responsive: true });
  }, [Plotly, epw, heatVar]);

  const drawDome = useCallback(() => {
    if (!Plotly || !plotRefDome.current || !domeMesh || !domeSeasonVals) return;
    const v = domeMesh.vertices; const f = domeMesh.faces;

    // per-face -> per-vertex average if needed
    let intensity: number[];
    if (domeSeasonVals.length === v.length) {
      intensity = domeSeasonVals;
    } else if (domeSeasonVals.length === f.length) {
      const accum = new Array(v.length).fill(0);
      const count = new Array(v.length).fill(0);
      for (let fi = 0; fi < f.length; fi++) {
        const val = domeSeasonVals[fi] ?? 0;
        const tri = f[fi];
        for (const vid of tri) { accum[vid] += val; count[vid]++; }
      }
      intensity = accum.map((s,i)=> count[i] ? s / count[i] : 0);
    } else {
      intensity = new Array(v.length).fill(0);
      for (let i=0; i<Math.min(v.length, domeSeasonVals.length); i++) intensity[i] = domeSeasonVals[i] ?? 0;
    }

    const trace: any = {
      type: "mesh3d",
      x: v.map(p=>-p[0]), y: v.map(p=>-p[1]), z: v.map(p=> p[2]),
      i: f.map(t=>t[0]), j: f.map(t=>t[1]), k: f.map(t=>t[2]),
      intensity,
      colorscale: PALETTE,
      showscale: true,
      flatshading: true,
      colorbar: { title: "kWh/m²" },
      hovertemplate: "Solar Radiation %{intensity} kWh/m²<extra></extra>",
    };

    const layout: any = {
      scene: {
        xaxis: { visible: false }, yaxis: { visible: false }, zaxis: { visible: false },
        aspectratio: proj === "3D" ? { x:2, y:2, z:1 } : { x:2, y:2, z:0.1 },
        camera: proj === "3D"
          ? { up:{x:0,y:0,z:3}, center:{x:0,y:0,z:-0.30}, eye:{x:0,y:2.25,z:1} }
          : { up:{x:0,y:0,z:3}, center:{x:0,y:0,z:0}, eye:{x:0,y:0,z:1.3} },
      },
      height: 520,
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    };

    Plotly.react(plotRefDome.current, [trace], layout, { displaylogo:false, responsive:true });
  }, [Plotly, domeMesh, domeSeasonVals, proj]);

  const drawRose = useCallback(() => {
    if (!Plotly || !plotRefRose.current || !roseDf) return;
    const r = roseDf.map(row => Number(row[String(tilt)]) || 0);
    const theta = roseDf.map(row => row["Angle"]);
    const trace:any = {
      type: "barpolar",
      r, theta,
      marker: { colorscale: PALETTE, color: r },
      hovertemplate: "Solar Radiation %{r} kWh/m²<extra></extra>",
    };
    Plotly.react(plotRefRose.current, [trace], {
      height: 520,
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: TEXT_COLOR },
      polar: { angularaxis: { rotation: 90, direction: "clockwise" } }, // 0° up
    }, { displaylogo:false, responsive:true });
  }, [Plotly, roseDf, tilt]);

  const drawRadMesh = useCallback(() => {
    if (!Plotly || !plotRefRad.current || !radMesh || !radVals) return;
    const v = radMesh.vertices; const f = radMesh.faces;
    const trace:any = {
      type: "mesh3d",
      x: v.map(p=>-p[0]), y: v.map(p=>-p[1]), z: v.map(p=>p[2]),
      i: f.map(t=>t[0]), j: f.map(t=>t[1]), k: f.map(t=>t[2]),
      intensity: radVals,
      colorscale: PALETTE,
      showscale: true,
      colorbar: { title: "kWh/m²" },
    };
    Plotly.react(plotRefRad.current, [trace], {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      scene: { xaxis:{visible:false}, yaxis:{visible:false}, zaxis:{visible:false}, aspectratio:{x:3.6,y:2.16,z:0.4} },
      height: 520,
    }, { displaylogo:false, responsive:true });
  }, [Plotly, radMesh, radVals]);

  const drawRadLines = useCallback(() => {
    if (!Plotly || !plotRefRadLine.current || !radSurfaceDf) return;
    const wallTypes = ["North West","South West","North East","South East"];
    const colors: Record<string,string> = { "North West": "#0b938f", "South West":"#d45c80", "North East":"#8CB6AA", "South East":"#E0A9A6" };
    const traces = wallTypes.map(name => ({
      type: "scatter", mode: "lines", name,
      x: radSurfaceDf.filter(r=>r.Facade===name).map(r=>r.Hour),
      y: radSurfaceDf.filter(r=>r.Facade===name).map(r=>r.Value),
      line: { color: colors[name] },
      hovertemplate: "Hour: %{x}:00<br>Solar Radiation %{y} kWh/m²<extra></extra>",
    }));
    Plotly.react(plotRefRadLine.current, traces as any, {
      paper_bgcolor:'white', plot_bgcolor:'white',
      title: { text: "Solar Radiation on Surfaces", x: 0.5 },
      xaxis: { title: "Hour of Day", showline:true, showgrid:false, linecolor:'rgb(204,204,204)', linewidth:2 },
      yaxis: { title: "Solar Irradiance (kWh/m²)", showline:true, showgrid:false, linecolor:'rgb(204,204,204)', linewidth:2 },
      margin: { l:100, r:20, t:60, b:40 },
      showlegend: true,
      height: 520,
    }, { displaylogo:false, responsive:true });
  }, [Plotly, radSurfaceDf]);

  // redraws
  useEffect(() => { drawHeatmap(); }, [drawHeatmap]);
  useEffect(() => { drawDome(); }, [drawDome]);
  useEffect(() => { drawRose(); }, [drawRose]);
  useEffect(() => { drawRadMesh(); }, [drawRadMesh]);
  useEffect(() => { drawRadLines(); }, [drawRadLines]);

  /** ===== LAYOUT (as requested) =====
   * Row 1: Heatmap Variable (full width)
   * Row 2: Heatmap (full width)
   * Row 3: Surface Tilt + Season + Projection (one row, 3 cols)
   * Row 4: Dome + Rose (one row, 2 cols)
   * Row 5: City Mesh (full width)
   * (Optional) Facade lines (full width)
   */

  return (
    <div className="solar-analysis" style={{ width: "100%" }}>
      {/* Row 1: Heatmap Variable */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ color: TEXT_COLOR, fontWeight: 600 }}>Heatmap Variable</label>
          <select value={heatVar} onChange={(e)=>setHeatVar(e.target.value)} style={{ width: "100%" }}>
            {HEATMAP_OPTIONS.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: Heatmap */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
        <div ref={plotRefHeat} style={{ width: "100%", height: 420, border: "1px solid #dee2e6", borderRadius: 8 }} />
      </div>

      {/* Row 3: Surface Tilt + Season + Projection */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ color: TEXT_COLOR, fontWeight: 600 }}>Surface Tilt (°)</label>
          <input type="range" min={0} max={90} step={10} value={tilt} onChange={(e)=>setTilt(parseInt(e.target.value))} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ color: TEXT_COLOR, fontWeight: 600 }}>Season</label>
          <select value={season} onChange={(e)=>setSeason(e.target.value as Season)} style={{ width: "100%" }}>
            {SEASONS.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: TEXT_COLOR, fontWeight: 600 }}>Projection</label>
          <select value={proj} onChange={(e)=>setProj(e.target.value as ProjectionKey)} style={{ width: "100%" }}>
            {PROJECTIONS.map(p=> <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Row 4: Dome + Rose */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
        <div ref={plotRefDome} style={{ width: "100%", height: 520, border: "1px solid #dee2e6", borderRadius: 8 }} />
        <div ref={plotRefRose} style={{ width: "100%", height: 520, border: "1px solid #dee2e6", borderRadius: 8 }} />
      </div>

      {/* Row 5: City Mesh */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div ref={plotRefRad} style={{ width: "100%", height: 520, border: "1px solid #dee2e6", borderRadius: 8 }} />
      </div>

      {/* Optional: Facade lines */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginTop: 16 }}>
        <div ref={plotRefRadLine} style={{ width: "100%", height: 520, border: "1px solid #dee2e6", borderRadius: 8 }} />
      </div>

      {error && <div style={{ marginTop: 12, color: "#b00020", background: "#ffe8e8", padding: "8px 10px", borderRadius: 6 }}>{error}</div>}
    </div>
  );
};
