import { SVGRenderer, Card, Widgets } from "./renderer.js";

export function generateContributionsSvg(data: any): string {
  const calendar = data.calendar || { weeks: [], months: [] };
  const weeks = calendar.weeks || [];

  const renderer = new SVGRenderer(820, 160);
  const card = new Card(820, 160, "Contributions Calendar");

  // Dynamically compute month header labels and column alignments
  const months: Array<{ name: string; col: number }> = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let lastMonthName = "";

  weeks.forEach((week: any, colIdx: number) => {
    const firstDay = week.contributionDays?.[0];
    if (firstDay && firstDay.date) {
      // Parse UTC at midnight to prevent timezone shifting
      const dt = new Date(firstDay.date + "T00:00:00Z");
      const mName = monthNames[dt.getUTCMonth()];
      if (mName !== lastMonthName) {
        // Enforce spacing between labels to prevent overlapping text (needs at least 3 cols)
        if (months.length === 0 || colIdx - months[months.length - 1].col >= 3) {
          months.push({ name: mName, col: colIdx });
          lastMonthName = mName;
        }
      }
    }
  });

  // Render Grid Calendar using helper
  const gridX = 40;
  const gridY = 25;
  const gridContent = Widgets.renderGridCalendar(gridX, gridY, weeks, months);

  return renderer.render(card.render(gridContent));
}
