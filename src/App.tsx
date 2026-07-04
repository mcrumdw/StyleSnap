import { Link, Route, Routes } from "react-router-dom";
import { Button } from "./components/Button";
import { EmptyState } from "./components/EmptyState";
import { KitchenSink } from "./routes/KitchenSink";

function Home() {
  return (
    <main className="mx-auto max-w-container px-6 py-12">
      <EmptyState
        heading="Nothing snapped yet"
        message="Drop a capture to begin. (Import arrives in Phase 1.)"
        action={
          <Link to="/kitchen-sink">
            <Button variant="secondary">View kitchen sink</Button>
          </Link>
        }
      />
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/kitchen-sink" element={<KitchenSink />} />
    </Routes>
  );
}
