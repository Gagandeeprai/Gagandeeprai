import { SVGRenderer, Card, Widgets } from "./renderer.js";
import { theme } from "./theme.js";

export function generateActivitySvg(data: any): string {
  const productiveTime = data.productiveTime || {};
  const renderer = new SVGRenderer(495, 195);
  const card = new Card(495, 195, "Productive Time (Local Hour Distribution)");

  // Prepare 24-hour histogram dataset
  const dataset: Array<{ label: string; value: number }> = [];
  for (let hour = 0; hour < 24; hour++) {
    const value = productiveTime[hour] || 0;
    // Only display label for even hours to prevent visual crowding
    const label = hour % 2 === 0 ? String(hour).padStart(2, "0") : "";
    dataset.push({ label, value });
  }

  // Render using visual primitives
  const chartX = 15;
  const chartY = 15;
  const chartWidth = 440;
  const chartHeight = 100;
  const bodyContent = Widgets.renderBarHistogram(chartX, chartY, chartWidth, chartHeight, dataset, theme.accent);

  return renderer.render(card.render(bodyContent));
}
