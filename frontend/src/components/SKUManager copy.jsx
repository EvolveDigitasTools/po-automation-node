import React, { useState, useEffect, useRef } from "react";

const SKUManager = () => {
  const API_URL = "http://localhost:4000";

  const [vendorsData, setVendorsData] = useState([]);
  const [vendorCode, setVendorCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [file, setFile] = useState(null);
  const [uploadedData, setUploadedData] = useState([]);
  const [uploadReport, setUploadReport] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Load vendors on mount
  useEffect(() => {
    async function loadVendors() {
      try {
        const res = await fetch(`${API_URL}/vendors`);
        const data = await res.json();
        setVendorsData(data);
      } catch (err) {
        console.error("Failed to load vendors:", err);
      }
    }
    loadVendors();
  }, []);

  // Sync selections
  const handleVendorChange = (e) => {
    const selected = vendorsData.find(v => v.vendorCode === e.target.value);
    setVendorCode(e.target.value);
    if (selected) {
      setCompanyName(selected.companyName);
      setProductCategory(selected.productCategory);
    } else {
      setCompanyName("");
      setProductCategory("");
    }
  };

  const handleCompanyChange = (e) => {
    const selected = vendorsData.find(v => v.companyName === e.target.value);
    setCompanyName(e.target.value);
    if (selected) {
      setVendorCode(selected.vendorCode);
      setProductCategory(selected.productCategory);
    } else {
      setVendorCode("");
      setProductCategory("");
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const uploadFile = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("skuFile", file);

    try {
      const res = await fetch(`${API_URL}/upload-sku`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setUploadedData(data.preview || []);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("File upload failed");
    }
  };

  const submitSkus = async () => {
    if (!vendorCode) {
      alert("Please select a Vendor Code before submitting.");
      return;
    }
    if (uploadedData.length === 0) {
      alert("No SKUs uploaded. Please upload a file first.");
      return;
    }

    setIsUploading(true);
    setProgress(0);

    const payload = { vendorCode, companyName, productCategory, createdBy, skus: uploadedData };

    try {
      const res = await fetch(`${API_URL}/submit-skus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    // Fake progress animation while waiting
    let fakeProgress = 0;
    const interval = setInterval(() => {
      fakeProgress += 10;
      setProgress((p) => Math.min(p + 10, 90));
      if (fakeProgress >= 90) clearInterval(interval);
    }, 500);

    const result = await res.json();
    clearInterval(interval);
    setProgress(100);

    if (res.ok) {
      setUploadReport(result);
      setFile(null);
      // setUploadedData([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (err) {
    console.error("Submit failed:", err);
    alert("An unexpected error occurred");
  } finally {
    setIsUploading(false);
  }
};

  return (
    <div>
      <header className="main-header">
        <div className="header-logo">
          <img src="/images/plugin-logo.png" alt="logo" />
        </div>
        <div className="header-heading">
          <h2>PO Automation</h2>
        </div>
      </header>

      <div className="sampleDownload">
        <h2>Add New SKUs</h2>
        <button
          className="downloadSheet"
          onClick={() => (window.location.href = `${API_URL}/download-sample-sku`)}
        >
          📥 Download Sample SKU Sheet
        </button>
      </div>

      <form id="skuForm">
        <label>Vendor Code *</label>
        <select 
          value={vendorCode} 
          onChange={handleVendorChange} 
          required>
          <option 
            value="">Select Vendor
          </option>
            {vendorsData.map(v => <option key={v.vendorCode} value={v.vendorCode}>{v.vendorCode}</option>)}
        </select>

        <label>Company Name *</label>
        <select 
          value={companyName} 
          onChange={handleCompanyChange} 
          required>
          <option value="">Select Company</option>
          {vendorsData.map(v => <option key={v.companyName} value={v.companyName}>{v.companyName}</option>)}
        </select>

        <label>Product Category</label>
        <input 
          type="text" 
          value={productCategory} 
          readOnly />

        <label>Created By *</label>
        <input 
          type="text" 
          name="createdBy"
          autoComplete="email"
          value={createdBy} 
          onChange={e => setCreatedBy(e.target.value)} 
          required />

        <label>Upload SKU Sheet *</label>
        <input 
          type="file" 
          accept=".xlsx,.xls,.csv" 
          onChange={handleFileChange} 
          ref={(input) => (fileInputRef.current = input)} 
          required />
        <button 
          type="button" 
          onClick={uploadFile}>
            Upload & Preview
        </button>
      </form>

      {uploadedData.length > 0 && (
        <>
          <h3>Preview Data</h3>
          <table border="1">
            <thead>
              <tr>{Object.keys(uploadedData[0]).map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {uploadedData.map((row, idx) => (
                <tr key={idx}>
                  {Object.keys(row).map(k => <td key={k}>{row[k]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <button 
        className="submitBtn" 
        onClick={submitSkus}>
          Submit
      </button>

      {isUploading && (
        <div className="progress-container">
          <progress value={progress} max="100"></progress>
          <span>{progress}%</span>
        </div>
      )}
      <div className="updated-container">
          {uploadReport?.inserted?.length > 0 && (
            <div className="inserted-rows">
              <strong>Inserted SKUs:</strong>
              <ol>{uploadReport.inserted.map(sku => <li key={sku}>{sku}</li>)}</ol>
            </div>
          )}

          {uploadReport?.skipped?.length > 0 && (
            <div className="inserted-rows">
              <strong>Skipped SKUs:</strong>
              <ol>{uploadReport.skipped.map(sku => <li key={sku}>{sku}</li>)}</ol>
            </div>
          )}

          {uploadReport?.errors?.length > 0 && (
            <div className="inserted-rows" style={{ color: "red" }}>
              <strong>Errors:</strong>
              <ol>{uploadReport.errors.map(e => <li key={e.skuCode}>{e.skuCode}: {e.error}</li>)}</ol>
            </div>
          )}
      </div>
    </div>
  );
};

export default SKUManager;
