import { SVGRenderer, Card, Widgets } from "./renderer.js";

export function generateLanguagesSvg(data: any): string {
  const rawLangs = data.languages || [];
  const renderer = new SVGRenderer(495, 195);
  const card = new Card(495, 195, "Most Used Languages");

  // Keep top 5 languages, aggregate the rest under "Other"
  const maxLangs = 5;
  const displayLangs: Array<{ name: string; color: string; percentage: number }> = [];

  let topPercentageSum = 0;
  rawLangs.slice(0, maxLangs).forEach((lang: any) => {
    displayLangs.push({
      name: lang.name,
      color: lang.color,
      percentage: lang.percentage,
    });
    topPercentageSum += lang.percentage;
  });

  if (rawLangs.length > maxLangs) {
    const otherPercent = Math.max(100 - topPercentageSum, 0);
    if (otherPercent > 0.1) {
      displayLangs.push({
        name: "Other",
        color: "#8b949e",
        percentage: otherPercent,
      });
    }
  }

  // Draw stacked progress bars
  const width = 440;
  const bodyContent = displayLangs.map((lang, idx) => {
    const y = idx * 22;
    const valueLabel = `${lang.percentage.toFixed(1)}%`;
    return Widgets.renderProgressBar(lang.name, lang.percentage, lang.color, valueLabel, y, width);
  }).join("\n");

  return renderer.render(card.render(bodyContent));
}
