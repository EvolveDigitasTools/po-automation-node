import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X } from "lucide-react";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  // Detect current page
  const isDeletePage = location.pathname === "/delete-skus";

  // Button text changes based on current route
  // const buttonText = isDeletePage ? "Back to Add SKUs" : "Delete SKUs";

  // Button click navigation logic
  const handleButtonClick = () => {
    if (isDeletePage) navigate("/");
    else navigate("/delete-skus");
  };

  return (
    <>
      <header className="main-header">
        <div className="header-logo">
          <img src="/images/plugin-logo.png" alt="logo" />
        </div>

        <div className="header-heading">
          <h2>PO Automation</h2>
        </div>

        <div className="header-button">
            <button
              onClick={handleButtonClick}
              title={isDeletePage ? "Back to Add SKUs" : "Delete SKUs"}
              className="delete-sku-btn"
              style={{
                backgroundColor: isDeletePage ? "#4CAF50" : "#dd272aff",
                padding: "8px 14px",
                borderRadius: "6px",
                height: "40px",
                width: "190px",
                cursor: "pointer",
                fontWeight: "bold",
                marginTop: "15px",
                marginLeft: "15px",
                transition: "0.3s",
                justifyContent: "center",
              }}
            >
              {isDeletePage ? (
                <>← Back to Add SKUs</>
              ) : (
                <>
                  <X size={18} />Delete SKUs 
                </>
              )}
            </button>
          </div>
      </header>
    </>
  );
}

export default Header;
