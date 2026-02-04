import React from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";

export default function EmbedSolarAnalysis() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#1a1a1a",
        overflow: "hidden",
        padding: "40px 60px",
        boxSizing: "border-box",
      }}
    >
      <BrowserOnly fallback={<div>Loading...</div>}>
        {() => {
          const SolarAnalysisMesh =
            require("@site/src/components/3D/solar_analysis_mesh").default;
          return <SolarAnalysisMesh />;
        }}
      </BrowserOnly>
    </div>
  );
}
