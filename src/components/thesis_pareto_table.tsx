import React from "react";

interface DataRow {
  [key: string]: any;
}

interface DataTableProps {
  data: DataRow[];
}

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Interior Shelf</th>
            <th>Interior Shelf Rotation Angle</th>
            <th>Interior Shelf Height (m)</th>
            <th>Interior Shelf Depth (m)</th>
            <th>Exterior Shelf</th>
            <th>Exterior Shelf Rotation Angle</th>
            <th>Exterior Shelf Height (m)</th>
            <th>Exterior Shelf Depth (m)</th>
            <th>Cooling Load (kWh)</th>
            <th>Heating Load (kWh)</th>
            <th>UDI-a (%)</th>
            <th>Artificial Lighting Load (kWh)</th>
          </tr>
        </thead>

        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              <td>{row["Interior Shelf"]}</td>
              <td>{row["Interior Shelf Rotation Angle"]}</td>
              <td>{row["Interior Shelf Height (m)"]}</td>
              <td>{row["Interior Shelf Depth (m)"]}</td>
              <td>{row["Exterior Shelf"]}</td>
              <td>{row["Exterior Shelf Rotation Angle"]}</td>
              <td>{row["Exterior Shelf Height (m)"]}</td>
              <td>{row["Exterior Shelf Depth (m)"]}</td>
              <td>{row["Cooling Load (kWh)"]}</td>
              <td>{row["Heating Load (kWh)"]}</td>
              <td>{row["UDI-a (%)"]}</td>
              <td>{row["Artificial Lighting Load (kWh)"]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
