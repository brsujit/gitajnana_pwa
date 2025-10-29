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

    // 🧹 Clean keys
    data = data.map(row => {
      const cleaned = {};
      for (const key in row) {
        const cleanKey = key.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        cleaned[cleanKey] = row[key];
      }
      return cleaned;
    });

    // 🧩 Group by district
    const districts = {};
    data.forEach(row => {
      const d = row["DISTRICT"]?.trim() || "Unknown";
      if (!districts[d]) districts[d] = [];
      districts[d].push(row);
    });

    const sortedDistricts = Object.keys(districts).sort((a, b) => a.localeCompare(b));

    // 📄 Create portrait PDF (A4)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // 🏷️ Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("STATE LEVEL GITA CHANTING COMPETITION REPORT", 14, 15);
    doc.setFontSize(10);
    doc.text("District-wise Summary", 14, 21);

    // 🧾 Define headers
    const headers = [
      "District",
      "Block",
      "Place",
      "Date",
      "GROUP A",
      "GROUP B",
      "GROUP C",
      "GROUP D",
      "Total"
    ];

    const { autoTable } = doc;
    const tableBody = [];

    // 🧮 Grand totals
    let grandA = 0, grandB = 0, grandC = 0, grandD = 0, grandTotal = 0;

    for (const district of sortedDistricts) {
      const rows = districts[district];
      if (district === "Unknown") continue;

      rows.sort((a, b) => (a["BLOCK"] || "").localeCompare(b["BLOCK"] || ""));

      let distA = 0, distB = 0, distC = 0, distD = 0, distTotal = 0;

      rows.forEach((r, i) => {
        const a = Number(r["GROUP A"] || 0);
        const b = Number(r["GROUP B"] || 0);
        const c = Number(r["GROUP C"] || 0);
        const d = Number(r["GROUP D"] || 0);
        const total = Number(r["TOTAL NO OF PARTICIPANTS"] || 0);

        distA += a;
        distB += b;
        distC += c;
        distD += d;
        distTotal += total;

        grandA += a;
        grandB += b;
        grandC += c;
        grandD += d;
        grandTotal += total;

        tableBody.push([
          i === 0 ? district : "",
          r["BLOCK"] || "",
          r["PLACE"] || "",
          r["DATE OF COMPETITION"]
            ? new Date(r["DATE OF COMPETITION"]).toLocaleDateString()
            : "",
          a || "",
          b || "",
          c || "",
          d || "",
          total || ""
        ]);
      });

      // 🟩 District Summary Row
      tableBody.push([
        `${district} Summary`,
        "",
        "",
        "",
        distA.toString(),
        distB.toString(),
        distC.toString(),
        distD.toString(),
        distTotal.toString()
      ]);
    }

    // 🟦 State Total Row
    tableBody.push([
      "STATE TOTAL",
      "",
      "",
      "",
      grandA.toString(),
      grandB.toString(),
      grandC.toString(),
      grandD.toString(),
      grandTotal.toString()
    ]);

    // 🧾 Render Table
    doc.autoTable({
      startY: 28,
      head: [headers],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        cellPadding: 1.2
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: "bold"
      },
      bodyStyles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 28 }, // District
        1: { cellWidth: 25 }, // Block
        2: { cellWidth: 30 }, // Place
        3: { cellWidth: 18 }, // Date
        4: { cellWidth: 14 }, // A
        5: { cellWidth: 14 }, // B
        6: { cellWidth: 14 }, // C
        7: { cellWidth: 14 }, // D
        8: { cellWidth: 18 }  // Total
      },
      margin: { top: 25, left: 10, right: 10, bottom: 15 },
      didParseCell: function (data) {
        const cellText = data.cell.raw;
        if (typeof cellText === "string" && cellText.includes("Summary")) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [220, 220, 220];
        }
      }
    });

    // 📄 Footer Page Numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, 200, 287, { align: "right" });
    }

    // 💾 Save PDF
    doc.save("Gitajnana_Report.pdf");
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
