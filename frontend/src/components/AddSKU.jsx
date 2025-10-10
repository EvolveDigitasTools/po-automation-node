import React, { useState, useEffect, useRef } from "react";

const AddSKU = () => {
  const API_URL = import.meta.env.VITE_FRONTEND_URL;

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
    // 🔥 Use EventSource (SSE) instead of fetch
    const eventSource = new EventSource(`${API_URL}/submit-skus-stream?payload=${encodeURIComponent(JSON.stringify(payload))}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.progress && data.total) {
        const percent = Math.round((data.progress / data.total) * 100);
        setProgress(percent); // ✅ Real progress
      }

      if (data.done) {
        setProgress(100);
        setUploadReport(data);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        eventSource.close();
        setIsUploading(false);
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection error");
      eventSource.close();
      setIsUploading(false);
    };

  } catch (err) {
    console.error("Submit failed:", err);
    alert("An unexpected error occurred");
    setIsUploading(false);
  }
};


  return (<>
    <div>
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
          id="productCategory"
          type="text" 
          value={productCategory} 
          readOnly />

        <label>Created By *</label>
        <input 
          id="createdBy"
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
            <div className="row-group">
              <strong>Inserted:</strong>
              <span className="badge inserted-badge">{uploadReport.inserted.length}</span>
              <ol>{uploadReport.inserted.map(sku => <li key={sku}>{sku}</li>)}</ol>
            </div>
          )}

          {uploadReport?.skipped?.length > 0 && (
            <div className="row-group">
              <strong>Skipped:</strong>
              <span className="badge skipped-badge">{uploadReport.skipped.length}</span>
              <ol>{uploadReport.skipped.map(sku => <li key={sku}>{sku}</li>)}</ol>
            </div>
          )}

          {uploadReport?.errors?.length > 0 && (
            <div className="row-group errors-rows">
              <strong>Errors:</strong>
              <span className="badge errors-badge">{uploadReport.errors.length}</span>
              <ol>
                {uploadReport.errors.map(e => (
                  <li key={e.skuCode}>
                    {e.skuCode}: {e.error}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
    </div>
    </>
  );
};

export default AddSKU;
