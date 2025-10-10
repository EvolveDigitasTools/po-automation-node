import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import "./index.css";

import Header from "./components/Header";
import AddSKU from "./components/AddSKU";
import DeleteSKU from "./components/DeleteSKU";

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<AddSKU />} />
        <Route path="/delete-skus" element={<DeleteSKU />} />
      </Routes>
    </Router>
  );
}

export default App;
