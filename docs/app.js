// ========= CONFIG ===========
const SHEET_URL =
  "https://api.allorigins.win/raw?url=" +
  encodeURIComponent(
    "https://script.google.com/macros/s/AKfycbybyg1IjkS-bA-uQPQB11C3ZuvxzZLhfBWwiCso4398jSJEFExMmatA6deH8zlEO42xeg/exec"
  );

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
      table.innerHTML = "<tr><td>Error loading data</td></tr>";
      return;
    }

    if (!allData.length) {
      table.innerHTML = "<tr><td>No data found</td></tr>";
    } else {
      const headers = Object.keys(allData[0]);
      let html = "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
      allData.forEach(r => {
        html +=
          "<tr>" +
          headers.map(h => `<td>${r[h] ?? ""}</td>`).join("") +
          "</tr>";
      });
      table.innerHTML = html;
    }

    // ✅ set automatic SL NO & YEAR after load
    const slInput = document.getElementById("slno");
    const yearInput = document.getElementById("year");
    if (slInput) slInput.value = getNextSerialNumber();
    if (yearInput) yearInput.value = getCurrentYear();

  } catch (err) {
    console.error(err);
    table.innerHTML = "<tr><td>Error loading data</td></tr>";
  }
}

// ========= AUTO SERIAL NUMBER & YEAR ===========
function getNextSerialNumber() {
  if (!allData || allData.length === 0) return 1;
  const nums = allData
    .map(r => Number(r["SL NO"] || 0))
    .filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

// ========= ADD RECORD ===========
async function addRecord(e) {
  e.preventDefault();
  const record = Object.fromEntries(new FormData(e.target).entries());

  // 🧮 Auto-generate SL NO & YEAR
  record["SL NO"] = getNextSerialNumber();
  record["YEAR OF COMPETITION"] = getCurrentYear();

  try {
    await fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({ action: "add", record }),
      headers: { "Content-Type": "application/json" },
    });
    alert(`Record #${record["SL NO"]} added successfully for ${record["YEAR OF COMPETITION"]}!`);
    e.target.reset();
    await loadData();
  } catch (err) {
    console.error(err);
    alert("Error adding record");
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
      headers.forEach((h, i) => (record[h] = vals[i]?.replace(/"/g, "").trim()));
      await fetch(SHEET_URL, {
        method: "POST",
        body: JSON.stringify({ action: "add", record }),
        headers: { "Content-Type": "application/json" },
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
    } catch {
      console.error("Invalid JSON:", text);
      alert("Could not load data for PDF!");
      return;
    }

    if (!data.length) return alert("No data available!");

    // 🧹 clean headers
    data = data.map(row => {
      const cleaned = {};
      for (const key in row)
        cleaned[key.replace(/\n/g, " ").replace(/\s+/g, " ").trim()] = row[key];
      return cleaned;
    });

    const districts = {};
    data.forEach(row => {
      const d = row["DISTRICT"]?.trim() || "Unknown";
      if (!districts[d]) districts[d] = [];
      districts[d].push(row);
    });
    const sortedDistricts = Object.keys(districts).sort((a, b) => a.localeCompare(b));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text("Gitajnana Examination – District-wise Participants Report", 14, 15);
    doc.setFontSize(10);

    let y = 25;
    let totalA = 0, totalB = 0, totalC = 0, totalD = 0, totalP = 0;

    for (const district of sortedDistricts) {
      const rows = districts[district];
      if (district === "Unknown") continue;
      rows.sort((a, b) => (a["BLOCK"] || "").localeCompare(b["BLOCK"] || ""));

      doc.setFont(undefined, "bold");
      doc.text(`District: ${district}`, 14, y);
      doc.setFont(undefined, "normal");
      y += 5;

      const headers = [
        "District","Block","Place","Date of Competition",
        "GROUP A","GROUP B","GROUP C","GROUP D","TOTAL NO OF PARTICIPANTS","District Total"
      ];

      const tableBody = rows.map((r, i) => {
        totalA += Number(r["GROUP A"] || 0);
        totalB += Number(r["GROUP B"] || 0);
        totalC += Number(r["GROUP C"] || 0);
        totalD += Number(r["GROUP D"] || 0);
        totalP += Number(r["TOTAL NO OF PARTICIPANTS"] || 0);
        return [
          i === 0 ? r["DISTRICT"] || "" : "",
          r["BLOCK"] || "",
          r["PLACE"] || "",
          r["DATE OF COMPETITION"]
            ? new Date(r["DATE OF COMPETITION"]).toLocaleDateString()
            : "",
          r["GROUP A"] || "",
          r["GROUP B"] || "",
          r["GROUP C"] || "",
          r["GROUP D"] || "",
          r["TOTAL NO OF PARTICIPANTS"] || "",
          "",
        ];
      });

      const total = rows.reduce(
        (sum, r) => sum + Number(r["TOTAL NO OF PARTICIPANTS"] || 0),
        0
      );
      tableBody.push(["", "", "", "", "", "", "", "", "District Total", total.toString()]);

      doc.autoTable({
        startY: y,
        head: [headers],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle" },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
        pageBreak: "avoid",
      });

      y = doc.lastAutoTable.finalY + 10;
      if (y > 180) {
        doc.addPage();
        y = 25;
      }
    }

    // STATE SUMMARY
    doc.addPage();
    doc.setFontSize(14);
    doc.text("STATE SUMMARY", 130, 20);
    doc.setFontSize(10);
    const summaryData = [
      ["Total Districts", sortedDistricts.length],
      ["Total Participants", totalP],
      ["Group A Total", totalA],
      ["Group B Total", totalB],
      ["Group C Total", totalC],
      ["Group D Total", totalD],
    ];
    doc.autoTable({
      startY: 30,
      head: [["Description", "Total"]],
      body: summaryData,
      theme: "grid",
      styles: { fontSize: 10, halign: "center" },
      headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: "bold" },
      bodyStyles: { fontStyle: "bold" },
    });

    doc.save("Gitajnana_District_Report.pdf");
  } catch (err) {
    console.error(err);
    alert("Failed to generate PDF!");
  }
});

// ========= INIT ===========
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("importBtn").addEventListener("click", importCSV);
  document.getElementById("dataForm").addEventListener("submit", addRecord);
  loadData();
});
