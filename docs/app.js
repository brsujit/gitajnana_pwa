// Replace this with your actual Web App URL from Apps Script:
const SHEET_WRITE_URL = "https://script.google.com/macros/s/AKfycbyw9CVsiEt2D6HWlNyYDiirNZuz6KjiVDXQuXTJoX0Z7Lk1iG-HFKvNRoe9Dtq4lG_X/exec"; 

document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = Object.fromEntries(new FormData(e.target).entries());
  const total = ['GROUP A', 'GROUP B', 'GROUP C', 'GROUP D']
    .map(k => parseInt(formData[k] || 0))
    .reduce((a, b) => a + b, 0);
  formData['TOTAL NO OF PARTICIPANTS'] = total;

  try {
    const res = await fetch(SHEET_WRITE_URL, {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    const result = await res.json();
    if (result.status === 'ok') alert('Data saved successfully!');
    else alert('Error: ' + result.message);
  } catch (err) {
    alert('Network error or invalid URL');
  }
});

document.getElementById('filterDistrict').addEventListener('input', (e) => {
  const filter = e.target.value.toLowerCase();
  document.querySelectorAll('#dataTable tbody tr').forEach(row => {
    const text = row.cells[0].innerText.toLowerCase();
    row.style.display = text.includes(filter) ? '' : 'none';
  });
});
