import React from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";

export default function EmbedDaylight() {
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
          const MeshUDIWithLines =
            require("@site/src/components/3D/daylight/mesh_UDI_with_lines").default;
          return (
            <MeshUDIWithLines
              moduleObjFilePath="/3D/daylight/module_2_1.obj"
              contextObjFilePath="/3D/daylight/module_2_1_context.obj"
              linesObjFilePath="/3D/daylight/lines.obj"
              moduleObjectiveCsvFilePath="/3D/daylight/master.csv"
            />
          );
        }}
      </BrowserOnly>
    </div>
  );
}
