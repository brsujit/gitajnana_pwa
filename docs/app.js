// ========= CONFIG ===========
const SHEET_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://script.google.com/macros/s/AKfycbybyg1IjkS-bA-uQPQB11C3ZuvxzZLhfBWwiCso4398jSJEFExMmatA6deH8zlEO42xeg/exec");
// ========= GLOBAL ===========
let allData = [];

// ========= LOAD & DISPLAY ===========
async function loadData() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "<tr><td>Loading...</td></tr>";

  try {
    const res = await fetch(SHEET_URL);
const text = await res.text();
try {
  allData = JSON.parse(text);
} catch {
  console.error("Invalid JSON from server:", text);
  document.getElementById("dataTable").innerHTML = "<tr><td>Error loading data</td></tr>";
  return;
}


    const headers = Object.keys(allData[0]);
    let html = "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
    allData.forEach(r => {
      html += "<tr>" + headers.map(h => `<td>${r[h] ?? ""}</td>`).join("") + "</tr>";
    });
    table.innerHTML = html;
  } catch (err) {
    console.error(err);
    table.innerHTML = "<tr><td>Error loading data</td></tr>";
  }
}

// ========= ADD RECORD ===========
async function addRecord(e) {
  e.preventDefault();
  const record = Object.fromEntries(new FormData(e.target).entries());
  try {
    await fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({ action: "add", record }),
      headers: { "Content-Type": "application/json" }
    });
    alert("Record added successfully!");
    e.target.reset();
    loadData();
  } catch (err) {
    console.error(err);
    alert("Error adding record");
  }
}

// ========= EXPORT CSV ===========
async function exportCSV() {
  try {
    const res = await fetch(SHEET_URL);
    const data = await res.json();
    if (!data.length) return alert("No data to export!");

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map(r => headers.map(h => `"${r[h] || ""}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Gitajnana_Data.csv";
    a.click();
  } catch (err) {
    console.error(err);
    alert("Export failed!");
  }
}

// ========= IMPORT CSV ===========
async function importCSV() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";

  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const [headerLine, ...lines] = text.split("\n").filter(l => l.trim());
    const headers = headerLine.split(",").map(h => h.trim());

    for (const line of lines) {
      const vals = line.split(",");
      if (!vals.length) continue;
      const record = {};
      headers.forEach((h, i) => record[h] = vals[i]?.replace(/"/g, "").trim());
      await fetch(SHEET_URL, {
        method: "POST",
        body: JSON.stringify({ action: "add", record }),
        headers: { "Content-Type": "application/json" }
      });
    }

    alert("CSV imported successfully!");
    loadData();
  };

  input.click();
}

// ========= PDF REPORT ===========
document.getElementById("pdfBtn").addEventListener("click", async () => {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON:", text);
      alert("Could not load data for PDF!");
      return;
    }

    if (!data.length) {
      alert("No data available!");
      return;
    }

    // 🧹 Normalize keys (remove newlines, trim spaces)
    data = data.map(row => {
      const cleaned = {};
      for (const key in row) {
        const cleanKey = key.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        cleaned[cleanKey] = row[key];
      }
      return cleaned;
    });

    // Group by District
    const districts = {};
    data.forEach(row => {
      const district = row["DISTRICT"] || row["District"] || "Unknown";
      if (!districts[district]) districts[district] = [];
      districts[district].push(row);
    });

    // Create PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Gitajnana Examination – District-wise Participants Report", 14, 15);
    doc.setFontSize(10);

    let y = 25;

    for (const [district, rows] of Object.entries(districts)) {
      // Prepare data for measurement
      const headers = [
        "District",
        "Place",
        "Date of Competition",
        "GROUP A",
        "GROUP B",
        "GROUP C",
        "GROUP D",
        "TOTAL NO OF PARTICIPANTS",
        "District Total"
      ];

      const tableBody = rows.map(r => [
        r["DISTRICT"] || "",
        r["PLACE"] || "",
        r["DATE OF COMPETITION"]
          ? new Date(r["DATE OF COMPETITION"]).toLocaleDateString()
          : "",
        r["GROUP A"] || "",
        r["GROUP B"] || "",
        r["GROUP C"] || "",
        r["GROUP D"] || "",
        r["TOTAL NO OF PARTICIPANTS"] || "",
        ""
      ]);

      const total = rows.reduce(
        (sum, r) => sum + Number(r["TOTAL NO OF PARTICIPANTS"] || 0),
        0
      );
      tableBody.push(["", "", "", "", "", "", "", "District Total", total.toString()]);

      // ✳️ Estimate table height before drawing
      const tempDoc = new jsPDF({ orientation: "landscape" });
      tempDoc.autoTable({
        head: [headers],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8 },
      });
      const estimatedHeight = tempDoc.lastAutoTable.finalY - 10; // rough estimate

      // If not enough space, add new page before drawing this district
      if (y + estimatedHeight > 185) {
        doc.addPage();
        y = 25;
      }

      // 🟦 District heading
      doc.setFont(undefined, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`District: ${district}`, 14, y);
      doc.setFont(undefined, "normal");
      y += 5;

      // Draw actual table
      doc.autoTable({
        startY: y,
        head: [headers],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle" },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold"
        },
        bodyStyles: {
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
      });

      y = doc.lastAutoTable.finalY + 10;
      if (y > 185) {
        doc.addPage();
        y = 25;
      }
    }

    doc.save("Gitajnana_District_Report.pdf");
  } catch (err) {
    console.error(err);
    alert("Failed to generate PDF!");
  }
});

// ========= INIT ===========
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("importBtn").addEventListener("click", importCSV);
  document.getElementById("exportBtn").addEventListener("click", exportCSV);
  document.getElementById("pdfBtn").addEventListener("click", generatePDF);
  document.getElementById("dataForm").addEventListener("submit", addRecord);
});

window.addEventListener("load", loadData);
