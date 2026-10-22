import { useEffect, useState } from "react";
import { api } from "./api/client";

type Health = { status: string; database: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Health>("/health")
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  let apiStatus = "checking...";
  if (error) apiStatus = `error: ${error}`;
  else if (health) apiStatus = `${health.status}, database ${health.database}`;

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Job Tracker</h1>
      <p className="mt-2 text-slate-600">API: {apiStatus}</p>
    </main>
  );
}