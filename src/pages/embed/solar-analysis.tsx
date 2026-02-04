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
