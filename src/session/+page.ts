export const load = async ({ fetch }) => {
  const response = await fetch("/api/report");
  if (!response.ok) throw new Error("Cannot load report.json");
  return { report: await response.json() };
};
