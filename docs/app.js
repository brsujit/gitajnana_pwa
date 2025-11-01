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
      console.error("Invalid JSON from server:", text);
      alert("Could not load data for PDF!");
      return;
    }

    if (!data.length) {
      alert("No data available!");
      return;
    }

    // Normalize keys (remove newlines, collapse spaces)
    data = data.map((row) => {
      const cleaned = {};
      for (const key in row) {
        const cleanKey = key.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        cleaned[cleanKey] = row[key];
      }
      return cleaned;
    });

    // Group rows by DISTRICT
    const districts = {};
    data.forEach((row) => {
      const district = (row["DISTRICT"] || "Unknown").toString().trim();
      if (!districts[district]) districts[district] = [];
      districts[district].push(row);
    });

    const sortedDistricts = Object.keys(districts).sort((a, b) =>
      a.localeCompare(b)
    );

    // Count unique venues
    const uniqueVenues = new Set();
    const uniqueDistricts = new Set();
    const uniqueBlocks = new Set();


    // Prepare totals
    let stateTotals = { A: 0, B: 0, C: 0, D: 0, total: 0 };
    const tableBody = [];

    // Build rows district by district
    for (const district of sortedDistricts) {
      const rows = districts[district];
      if (!rows || rows.length === 0 || district === "Unknown") continue;

      // Sort by BLOCK or PLACE if you prefer
      rows.sort((a, b) =>
        (a["BLOCK"] || "").toString().localeCompare((b["BLOCK"] || "").toString())
      );

      // For each venue row
      rows.forEach((r, i) => {
        const A = Number(r["GROUP A"] || r["GROUP\n A"] || 0) || 0;
        const B = Number(r["GROUP B"] || r["GROUP\n B"] || 0) || 0;
        const C = Number(r["GROUP C"] || r["GROUP\n C"] || 0) || 0;
        const D = Number(r["GROUP D"] || r["GROUP\n D"] || 0) || 0;
        const total = Number(r["TOTAL NO OF PARTICIPANTS"] || r["TOTAL \nNO OF\nPARTICIPANTS"] || 0) || 0;

        stateTotals.A += A;
        stateTotals.B += B;
        stateTotals.C += C;
        stateTotals.D += D;
        stateTotals.total += total;

        // Collect venue name safely (handle header variations)
        const venueRaw =
          r["VENUE"] ??
          r["VENUE "] ??
          r["VENUE\n"] ??
          r["Venue"] ??
          r["place"] ??
          "";
        const venue = venueRaw ? String(venueRaw).trim() : "";
        if (venue) uniqueVenues.add(venue);
        uniqueDistricts.add(district);
        if (r["BLOCK"]) uniqueBlocks.add(r["BLOCK"].toString().trim());


        tableBody.push([
          (i + 1).toString(),
          i === 0 ? district : "",
          r["BLOCK"] || r["BLOCK "] || "",
          venue || r["PLACE"] || "",
          r["DATE OF COMPETITION"]
            ? new Date(r["DATE OF COMPETITION"]).toLocaleDateString("en-IN")
            : (r["DATE"] ? new Date(r["DATE"]).toLocaleDateString("en-IN") : ""),
          A || "",
          B || "",
          C || "",
          D || "",
          total || ""
        ]);
      });

      // District summary row (plain strings, not objects)
      const dA = rows.reduce((s, rr) => s + (Number(rr["GROUP A"] || rr["GROUP\n A"] || 0) || 0), 0);
      const dB = rows.reduce((s, rr) => s + (Number(rr["GROUP B"] || rr["GROUP\n B"] || 0) || 0), 0);
      const dC = rows.reduce((s, rr) => s + (Number(rr["GROUP C"] || rr["GROUP\n C"] || 0) || 0), 0);
      const dD = rows.reduce((s, rr) => s + (Number(rr["GROUP D"] || rr["GROUP\n D"] || 0) || 0), 0);
      const dTotal = rows.reduce((s, rr) => s + (Number(rr["TOTAL NO OF PARTICIPANTS"] || rr["TOTAL \nNO OF\nPARTICIPANTS"] || 0) || 0), 0);

      tableBody.push([
        "",
        "",
        "",
        "Summary",
        "",
        dA || "",
        dB || "",
        dC || "",
        dD || "",
        dTotal || ""
      ]);
    }

    // Debug: log uniqueVenues count & sample (remove later)
    console.log("Unique Venues Count:", uniqueVenues.size);
    // console.log("Unique Venues List:", Array.from(uniqueVenues).slice(0, 50));

    // State total row using uniqueVenues
    tableBody.push([
      "",
      "",
      "",
      `STATE TOTAL (${uniqueDistricts.size} Dists, ${uniqueBlocks.size} Blocks, ${uniqueVenues.size} Venues)`,
      "",
      stateTotals.A || "",
      stateTotals.B || "",
      stateTotals.C || "",
      stateTotals.D || "",
      stateTotals.total || ""
    ]);

    // Create PDF (A4 portrait)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("7TH ODISHA STATE LEVEL GEETA CHANTING COMPETITION 2025", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    // Table headers (use smaller set to fit portrait)
    const headers = ["SL. NO.", "District", "Block", "Venue", "Date", "A", "B", "C", "D", "Total"];

    // Render table
    doc.autoTable({
  startY: 22,
  head: [headers],
  body: tableBody,
  theme: "grid",
  styles: {
    fontSize: 8,
    cellPadding: 1,
    halign: "center",
    valign: "middle"
  },
  headStyles: {
    fillColor: [230, 230, 230],
    textColor: [0, 0, 0],
    fontStyle: "bold"
  },
  columnStyles: {
    1: { halign: "left" }, // District
    2: { halign: "left" }, // Block
    3: { halign: "left" }, // Venue
    4: { halign: "left" }  // Date
  },
  margin: { left: 4, right: 6, top: 25 },
  tableWidth: "wrap",
  pageBreak: "auto",

  // 🖤 Highlight Summary + State Total rows
  didParseCell: function (data) {
    const row = data.row;
    const cell = data.cell;

    // Make district names bold and black
    if (data.column.index === 1 && data.cell.text && data.cell.text[0].trim() !== "") {
    data.cell.styles.fontStyle = "bold";
    data.cell.styles.textColor = [0, 0, 0];
}

    // Detect "Summary" rows or the final "STATE TOTAL"
    const isSummaryRow =
      row.raw &&
      (String(row.raw[3]).includes("Summary") ||
        String(row.raw[3]).includes("STATE TOTAL"));

    if (isSummaryRow) {
      cell.styles.fontStyle = "bold";
      cell.styles.textColor = [0, 0, 0];
      cell.styles.fillColor = [240, 240, 240]; // optional background
    }
  }
});

    // Footer: page numbers and generated date
    const pageCount = doc.internal.getNumberOfPages();
    const today = new Date().toLocaleDateString("en-GB"); // dd/mm/yyyy
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.text(`Generated: ${today}`, 10, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Page ${p} of ${pageCount}`, doc.internal.pageSize.getWidth() - 10, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    }

    doc.save("GCC_Report_Venues.pdf");
  } catch (err) {
    console.error("PDF generation error:", err);
    alert("Failed to generate PDF! See console for details.");
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
