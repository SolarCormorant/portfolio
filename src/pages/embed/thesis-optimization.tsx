import React from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";

export default function EmbedThesisOptimization() {
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
          const Scatter3D =
            require("@site/src/components/Scatter3D_PCP").default;
          return <Scatter3D />;
        }}
      </BrowserOnly>
    </div>
  );
}
