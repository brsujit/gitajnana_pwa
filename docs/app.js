document.getElementById("pdfBtn").addEventListener("click", async () => {
  const district = prompt("Enter District name for report:");
  if (!district) return;

  const res = await fetch(SHEET_URL);
  const data = await res.json();
  const filtered = data.filter(r =>
    (r.DISTRICT || "").toLowerCase() === district.toLowerCase()
  );

  if (!filtered.length) {
    alert("No records found for this district!");
    return;
  }

  // Calculate total participants
  let total = filtered.reduce(
    (sum, r) => sum + Number(r["TOTAL NO OF PARTICIPANTS"] || 0),
    0
  );

  // Generate PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.text(`Gitajnana Examination Report - ${district}`, 14, 15);
  doc.setFontSize(12);
  doc.text(`Total Participants: ${total}`, 14, 25);

  // Prepare table data
  const headers = Object.keys(filtered[0]);
  const body = filtered.map(r => headers.map(h => r[h]));

  doc.autoTable({
    startY: 35,
    head: [headers],
    body: body,
    styles: { fontSize: 8 },
  });

  doc.save(`Gitajnana_Report_${district}.pdf`);
});
