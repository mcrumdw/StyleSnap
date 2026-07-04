import { Route, Routes } from "react-router-dom";
import { Home } from "./routes/Home";
import { KitchenSink } from "./routes/KitchenSink";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/kitchen-sink" element={<KitchenSink />} />
    </Routes>
  );
}
