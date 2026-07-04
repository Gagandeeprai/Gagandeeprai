import { theme } from "./theme.js";
import { escapeXml } from "./utils.js";

export class SVGRenderer {
  private width: number;
  private height: number;
  private styles: string;

  constructor(width: number, height: number, customStyles: string = "") {
    this.width = width;
    this.height = height;
    this.styles = `
      svg {
        background-color: transparent;
      }
      .card-bg {
        fill: ${theme.bg};
        stroke: ${theme.border};
        stroke-width: 1px;
      }
      .title {
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-weight: 600;
        font-size: 16px;
        fill: ${theme.accent};
        animation: fadeIn 0.8s ease-in-out;
      }
      .text-main {
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 13px;
        fill: ${theme.text};
      }
      .text-mute {
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 11px;
        fill: ${theme.textMuted};
      }
      .mono {
        font-family: "JetBrains Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      }
      .bold {
        font-weight: 700;
      }
      .fade-in {
        animation: fadeIn 0.6s ease-in-out forwards;
      }
      .grow-bar {
        transform-origin: left;
        animation: scaleX 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleX {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
      ${customStyles}
    `;
  }

  /**
   * Render SVG string with specified inner body content.
   */
  public render(body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" fill="none">
  <style>
    ${this.styles.trim().replace(/\n/g, "\n    ")}
  </style>
  ${body}
</svg>`;
  }
}

export class Card {
  private width: number;
  private height: number;
  private title: string;
  private iconSvg: string;

  constructor(width: number, height: number, title: string, iconSvg: string = "") {
    this.width = width;
    this.height = height;
    this.title = title;
    this.iconSvg = iconSvg;
  }

  public render(content: string): string {
    const escapedTitle = escapeXml(this.title);
    return `<!-- Card Container -->
  <rect class="card-bg" x="0.5" y="0.5" width="${this.width - 1}" height="${this.height - 1}" rx="8" />
  
  <!-- Header Title -->
  <g transform="translate(25, 35)">
    ${this.iconSvg ? `${this.iconSvg}\n    <text class="title" x="25" y="5">${escapedTitle}</text>` : `<text class="title" x="0" y="5">${escapedTitle}</text>`}
  </g>
  
  <!-- Inner Canvas -->
  <g transform="translate(25, 55)">
    ${content}
  </g>`;
  }
}

export class Widgets {
  /**
   * Renders a horizontal bar with percentage completion.
   */
  public static renderProgressBar(
    label: string,
    percentage: number,
    color: string,
    valueLabel: string,
    y: number,
    width: number = 300
  ): string {
    const cleanLabel = escapeXml(label);
    const cleanVal = escapeXml(valueLabel);
    return `
    <g transform="translate(0, ${y})">
      <text class="text-main" x="0" y="0">${cleanLabel}</text>
      <text class="text-mute mono" x="${width}" y="0" text-anchor="end">${cleanVal}</text>
      <rect x="0" y="8" width="${width}" height="6" rx="3" fill="#1f242c" />
      <rect class="grow-bar" x="0" y="8" width="${(width * (percentage / 100)).toFixed(1)}" height="6" rx="3" fill="${color}" />
    </g>`;
  }

  /**
   * Renders a circular donut chart with a legend.
   */
  public static renderDonutChart(
    x: number,
    y: number,
    radius: number,
    strokeWidth: number,
    items: Array<{ percentage: number; color: string; label: string }>
  ): string {
    const list: string[] = [];
    const size = radius * 2 + strokeWidth * 2;
    const center = radius + strokeWidth;
    const circumference = 2 * Math.PI * radius;
    
    let accumulatedPercentage = 0;
    
    list.push(`<!-- Circular Chart Graph -->
    <g transform="translate(${x}, ${y})">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#1f242c" stroke-width="${strokeWidth}" />`);

    items.forEach((item) => {
      if (item.percentage <= 0) return;
      const strokeDashArray = `${((item.percentage / 100) * circumference).toFixed(1)} ${circumference.toFixed(1)}`;
      const strokeDashOffset = (-1 * (accumulatedPercentage / 100) * circumference).toFixed(1);
      
      list.push(`      <circle class="fade-in" cx="${center}" cy="${center}" r="${radius}" fill="none" 
        stroke="${item.color}" stroke-width="${strokeWidth}" 
        stroke-dasharray="${strokeDashArray}" stroke-dashoffset="${strokeDashOffset}" 
        transform="rotate(-90 ${center} ${center})" />`);
      
      accumulatedPercentage += item.percentage;
    });

    list.push(`    </g>`);

    // Legend
    list.push(`    <!-- Legend Column -->
    <g transform="translate(${x + size + 25}, ${y + 15})">`);
    items.forEach((item, index) => {
      const legY = index * 20;
      const cleanLabel = escapeXml(item.label);
      const valStr = `${item.percentage.toFixed(1)}%`;
      list.push(`      <g transform="translate(0, ${legY})">
        <rect x="0" y="-8" width="10" height="10" rx="2" fill="${item.color}" />
        <text class="text-main" x="18" y="0">${cleanLabel}</text>
        <text class="text-mute mono" x="150" y="0">${valStr}</text>
      </g>`);
    });
    list.push(`    </g>`);

    return list.join("\n");
  }

  /**
   * Renders a vertical histogram for hourly/daily activity.
   */
  public static renderBarHistogram(
    x: number,
    y: number,
    width: number,
    height: number,
    data: Array<{ label: string; value: number }>,
    accentColor: string
  ): string {
    const list: string[] = [];
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barWidth = Math.floor(width / data.length);
    const chartOffset = 18; // offset from bottom for labels

    list.push(`<!-- Bar Chart Histogram -->
    <g transform="translate(${x}, ${y})">`);

    data.forEach((item, index) => {
      const barHeight = Math.round((item.value / maxVal) * (height - chartOffset - 5));
      const barX = index * barWidth + Math.floor((barWidth - 6) / 2); // 6px width bar centered
      const barY = height - chartOffset - barHeight;

      const cleanLabel = escapeXml(item.label);
      list.push(`      <!-- Bar ${cleanLabel} -->
      <g class="fade-in" style="animation-delay: ${index * 20}ms">
        <rect x="${barX}" y="${barY}" width="8" height="${barHeight}" rx="2" fill="${accentColor}" />
        <text class="text-mute mono" x="${barX + 4}" y="${height - 2}" text-anchor="middle">${cleanLabel}</text>
      </g>`);
    });

    list.push(`    </g>`);
    return list.join("\n");
  }

  /**
   * Renders a 53-week grid contribution calendar.
   */
  public static renderGridCalendar(
    x: number,
    y: number,
    weeks: Array<{
      contributionDays: Array<{
        date: string;
        contributionCount: number;
        contributionLevel: number;
      }>;
    }>,
    months: Array<{ name: string; col: number }>
  ): string {
    const list: string[] = [];
    list.push(`<!-- Contribution Grid Calendar -->
    <g transform="translate(${x}, ${y})">`);

    // Month headers
    months.forEach((m) => {
      const mx = m.col * 14;
      const cleanMonth = escapeXml(m.name);
      list.push(`      <text class="text-mute" x="${mx}" y="-6">${cleanMonth}</text>`);
    });

    // Week labels
    const daysOfWeek = ["Mon", "Wed", "Fri"];
    daysOfWeek.forEach((d, idx) => {
      const dy = idx * 28 + 24; // Align to Mon, Wed, Fri rows (1, 3, 5 indexes)
      const cleanDay = escapeXml(d);
      list.push(`      <text class="text-mute" x="-28" y="${dy}">${cleanDay}</text>`);
    });

    // Drawing Grid Squares
    weeks.forEach((week, colIdx) => {
      const wx = colIdx * 14;
      week.contributionDays.forEach((day, rowIdx) => {
        const wy = rowIdx * 14;
        let color = theme.gridColors[0];
        const level = Math.min(day.contributionLevel, 4);
        color = theme.gridColors[level];
        const count = day.contributionCount;
        
        list.push(`      <rect class="fade-in" x="${wx}" y="${wy}" width="10" height="10" rx="2" fill="${color}"
        title="${day.date}: ${count} contributions">
          <title>${day.date}: ${count} contributions</title>
        </rect>`);
      });
    });

    list.push(`    </g>`);
    return list.join("\n");
  }
}
