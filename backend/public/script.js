const API_URL = "http://localhost:4000";

let vendorsData = [];

// Fetch vendors and populate dropdowns
async function loadVendors() {
  const res = await fetch(`${API_URL}/vendors`);
  vendorsData = await res.json();

  let vendorCode = document.getElementById("vendorCode");
  let companyName = document.getElementById("companyName");

  vendorCode.innerHTML = `<option value="">Select Vendor</option>`;
  companyName.innerHTML = `<option value="">Select Company</option>`;

  vendorsData.forEach(v => {
    vendorCode.innerHTML += `<option value="${v.vendorCode}">${v.vendorCode}</option>`;
    companyName.innerHTML += `<option value="${v.companyName}">${v.companyName}</option>`;
  });
}

// When vendorCode changes → set companyName + productCategory
document.getElementById("vendorCode").addEventListener("change", function () {
  let selectedVendor = vendorsData.find(v => v.vendorCode === this.value);

  if (selectedVendor) {
    document.getElementById("companyName").value = selectedVendor.companyName;
    document.getElementById("productCategory").value = selectedVendor.productCategory;
  } else {
    document.getElementById("companyName").value = "";
    document.getElementById("productCategory").value = "";
  }
});

// When companyName changes → set vendorCode + productCategory
document.getElementById("companyName").addEventListener("change", function () {
  let selectedVendor = vendorsData.find(v => v.companyName === this.value);

  if (selectedVendor) {
    document.getElementById("vendorCode").value = selectedVendor.vendorCode;
    document.getElementById("productCategory").value = selectedVendor.productCategory;
  } else {
    document.getElementById("vendorCode").value = "";
    document.getElementById("productCategory").value = "";
  }
});

let uploadedData = [];

// Upload SKU file and preview
async function uploadFile() {
  const fileInput = document.getElementById("skuFile");
  const formData = new FormData();
  formData.append("skuFile", fileInput.files[0]);

  const res = await fetch(`${API_URL}/upload-sku`, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  uploadedData = data.preview;

  // render preview
  let table = document.getElementById("previewTable");
  table.innerHTML = "";
  if (uploadedData.length > 0) {
    let headers = Object.keys(uploadedData[0]);
    let thead = "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
    let rows = uploadedData.map(row =>
      "<tr>" + headers.map(h => `<td>${row[h]}</td>`).join("") + "</tr>"
    ).join("");
    table.innerHTML = thead + rows;
  }
}

// Submit SKUs
async function submitSkus() {
  try {
    const vendorCode = document.getElementById("vendorCode").value;
    const companyName = document.getElementById("companyName").value;
    const productCategory = document.getElementById("productCategory").value;
    const createdBy = document.getElementById("createdBy").value;

    if (!vendorCode) {
      alert("Please select a Vendor Code before submitting.");
      return;
    }

    if (uploadedData.length === 0) {
      alert("No SKUs uploaded. Please upload an Excel file first.");
      return;
    }

    const payload = {
      vendorCode,
      companyName,
      productCategory,
      createdBy,
      skus: uploadedData
    };

    const res = await fetch(`${API_URL}/submit-skus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.ok) {
      alert(result.message);
      // Optionally clear file input and preview table after success
      document.getElementById("skuFile").value = "";
      document.getElementById("previewTable").innerHTML = "";
      uploadedData = [];
    } else {
      alert(`Error: ${result.message}`);
    }

  } catch (error) {
    console.error("Error submitting SKUs:", error);
    alert("An unexpected error occurred while submitting SKUs.");
  }
}


loadVendors();
