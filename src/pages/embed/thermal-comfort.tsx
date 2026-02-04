import React from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";

export default function EmbedThermalComfort() {
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
          const ThermalComfortMesh =
            require("@site/src/components/3D/outdoor_comfort/ThermalComfortMesh").default;
          return <ThermalComfortMesh />;
        }}
      </BrowserOnly>
    </div>
  );
}
