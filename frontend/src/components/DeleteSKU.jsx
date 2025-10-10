import React, { useState } from "react";

const DeleteSKU = () => {
  const API_URL = import.meta.env.VITE_FRONTEND_URL;

  const [skuCode, setSkuCode] = useState("");
  const [skuInfo, setSkuInfo] = useState(null);
  const [deleteReport, setDeleteReport] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch SKU info when SKU code changes
  const fetchSkuInfo = async () => {
    if (!skuCode) return;
    try {
      const res = await fetch(`${API_URL}/get-sku-info?skuCode=${encodeURIComponent(skuCode)}`);
      const data = await res.json();
      setSkuInfo(data.sku || null);
    } catch (err) {
      console.error("Failed to fetch SKU info:", err);
      setSkuInfo(null);
    }
  };

  // Delete SKU
  const deleteSku = () => {
  if (!skuCode) return alert("Please enter SKU Code");
  setIsDeleting(true);

  const eventSource = new EventSource(`${API_URL}/delete-sku/${skuCode}`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.done) {
      setDeleteReport(data);
      setSkuCode("");
      eventSource.close();
      setIsDeleting(false);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    setIsDeleting(false);
    alert("Delete failed");
  };
};


  return (
    <>
      <div className="delete-sku-container">
        
        
        <h2>Delete Existing SKU</h2>
        <div className="delete-form">
            <div className="form-title">
                <label>SKU Code *</label>
            </div>
            <input
            className="enter-sku-input"
            type="text"
            value={skuCode}
            onChange={e => setSkuCode(e.target.value)}
            onBlur={fetchSkuInfo}
            placeholder="Enter SKU Code"
            />

            {skuInfo && (
            <div className="sku-info">
                <h3>SKU Details</h3>
                <table border="1">
                <tbody>
                    {Object.entries(skuInfo).map(([key, val]) => (
                    <tr key={key}>
                        <td><strong>{key}</strong></td>
                        <td>{val}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            )}
        </div>

        <button
          className="deleteBtn"
          onClick={deleteSku}
          disabled={isDeleting || !skuInfo}
        >
          {isDeleting ? "Deleting..." : "Delete SKU"}
        </button>

        {deleteReport && (
          <div className="delete-report">
            {deleteReport.deleted && <p>Deleted: {deleteReport.deleted}</p>}
            {deleteReport.notFound && <p>Not Found: {deleteReport.notFound}</p>}
            {deleteReport.error && <p style={{ color: "red" }}>Error: {deleteReport.error}</p>}
          </div>
        )}
      </div>
    </>
  );
};

export default DeleteSKU;
