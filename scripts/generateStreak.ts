import { SVGRenderer, Card } from "./renderer.js";
import { formatNumber, escapeXml } from "./utils.js";
import { theme } from "./theme.js";

const FIRE_ICON = `<path d="M8 0c-.2 0-.4 0-.6.1C5.1 1.5 3 3.9 3 6.5A4.5 4.5 0 007.5 11c2.5 0 4.5-2 4.5-4.5 0-3.3-2.5-5.9-4-6.5zm-.2 8.7c-.8 0-1.5-.7-1.5-1.5 0-.7.4-1.2 1-1.4v.9c0 .3.2.5.5.5.3 0 .5-.2.5-.5v-1.8c.8.3 1.5 1.1 1.5 2.1 0 .9-.8 1.7-2 1.7z" fill="${theme.textOrange}"/>`;

interface StreakResult {
  totalContributions: number;
  currentStreak: number;
  currentStart: string;
  currentEnd: string;
  longestStreak: number;
  longestStart: string;
  longestEnd: string;
}

export function calculateStreaks(contributions: Record<string, number>, tzOffset: number): StreakResult {
  const dates = Object.keys(contributions).sort();
  let totalContributions = 0;

  // Filter out days with contributions
  const activeDates = dates.filter((d) => {
    const count = contributions[d] || 0;
    totalContributions += count;
    return count > 0;
  });

  if (activeDates.length === 0) {
    return {
      totalContributions: 0,
      currentStreak: 0,
      currentStart: "",
      currentEnd: "",
      longestStreak: 0,
      longestStart: "",
      longestEnd: "",
    };
  }

  // Calculate Longest Streak
  let longestStreak = 0;
  let longestStart = "";
  let longestEnd = "";

  let currentTemp = 0;
  let tempStart = "";
  let prevTime = 0;

  activeDates.forEach((dateStr) => {
    const currTime = new Date(dateStr + "T00:00:00Z").getTime();
    if (prevTime === 0) {
      currentTemp = 1;
      tempStart = dateStr;
    } else {
      const diffDays = Math.round((currTime - prevTime) / 86400000);
      if (diffDays === 1) {
        currentTemp++;
      } else {
        if (currentTemp > longestStreak) {
          longestStreak = currentTemp;
          longestStart = tempStart;
          longestEnd = activeDates[activeDates.indexOf(dateStr) - 1];
        }
        currentTemp = 1;
        tempStart = dateStr;
      }
    }
    prevTime = currTime;
  });

  // Check end of loop for longest
  if (currentTemp > longestStreak) {
    longestStreak = currentTemp;
    longestStart = tempStart;
    longestEnd = activeDates[activeDates.length - 1];
  }

  // Calculate Current Streak
  // Calculate relative to current local date
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const localTime = new Date(utc + 3600000 * tzOffset);

  const todayStr = localTime.toISOString().split("T")[0];
  
  const yesterday = new Date(localTime);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let currentStreak = 0;
  let currentStart = "";
  let currentEnd = "";

  const isActiveToday = contributions[todayStr] && contributions[todayStr] > 0;
  const isActiveYesterday = contributions[yesterdayStr] && contributions[yesterdayStr] > 0;

  if (isActiveToday || isActiveYesterday) {
    let checkDateStr = isActiveToday ? todayStr : yesterdayStr;
    currentEnd = checkDateStr;
    currentStreak = 0;

    while (contributions[checkDateStr] && contributions[checkDateStr] > 0) {
      currentStreak++;
      currentStart = checkDateStr;
      
      // Move 1 day back
      const d = new Date(checkDateStr + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      checkDateStr = d.toISOString().split("T")[0];
    }
  }

  return {
    totalContributions,
    currentStreak,
    currentStart,
    currentEnd,
    longestStreak,
    longestStart,
    longestEnd,
  };
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[parseInt(parts[1], 10) - 1];
  const day = parseInt(parts[2], 10);
  const year = parts[0];
  return `${month} ${day}, ${year}`;
}

export function generateStreakSvg(data: any, tzOffset: number): string {
  const result = calculateStreaks(data.contributions || {}, tzOffset);
  const renderer = new SVGRenderer(495, 195);
  const card = new Card(495, 195, "GitHub Streak Statistics");

  const totalRange = result.totalContributions > 0 
    ? `${formatDateLabel(Object.keys(data.contributions).sort()[0])} - Present` 
    : "No activity recorded";

  const currentRange = result.currentStreak > 0
    ? `${formatDateLabel(result.currentStart)} - ${formatDateLabel(result.currentEnd)}`
    : "No active streak";

  const longestRange = result.longestStreak > 0
    ? `${formatDateLabel(result.longestStart)} - ${formatDateLabel(result.longestEnd)}`
    : "No historic streak";

  const bodyContent = `
  <!-- Grid columns -->
  <g transform="translate(0, 20)">
    <!-- Column 1: Total contributions -->
    <g transform="translate(10, 0)">
      <text class="text-mute bold" x="65" y="10" text-anchor="middle">Total Contributions</text>
      <text class="title bold mono" x="65" y="45" font-size="28px" fill="${theme.text}" text-anchor="middle">
        ${formatNumber(result.totalContributions)}
      </text>
      <text class="text-mute mono" x="65" y="75" text-anchor="middle" font-size="9px">
        ${escapeXml(totalRange)}
      </text>
    </g>
    
    <!-- Divider -->
    <line x1="160" y1="0" x2="160" y2="90" stroke="${theme.border}" stroke-width="1" stroke-dasharray="4,4" />
    
    <!-- Column 2: Current Streak -->
    <g transform="translate(160, 0)">
      <svg class="fade-in" x="25" y="-12" viewBox="0 0 16 16" width="22" height="22">
        ${FIRE_ICON}
      </svg>
      <text class="text-mute bold" x="70" y="10" text-anchor="middle" fill="${theme.textOrange}">Current Streak</text>
      <text class="title bold mono" x="70" y="45" font-size="28px" fill="${theme.textOrange}" text-anchor="middle">
        ${result.currentStreak} <tspan font-size="14px" font-weight="normal">days</tspan>
      </text>
      <text class="text-mute mono" x="70" y="75" text-anchor="middle" font-size="9px">
        ${escapeXml(currentRange)}
      </text>
    </g>
    
    <!-- Divider -->
    <line x1="315" y1="0" x2="315" y2="90" stroke="${theme.border}" stroke-width="1" stroke-dasharray="4,4" />
    
    <!-- Column 3: Longest Streak -->
    <g transform="translate(315, 0)">
      <text class="text-mute bold" x="65" y="10" text-anchor="middle">Longest Streak</text>
      <text class="title bold mono" x="65" y="45" font-size="28px" fill="${theme.text}" text-anchor="middle">
        ${result.longestStreak} <tspan font-size="14px" font-weight="normal">days</tspan>
      </text>
      <text class="text-mute mono" x="65" y="75" text-anchor="middle" font-size="9px">
        ${escapeXml(longestRange)}
      </text>
    </g>
  </g>
  `;

  return renderer.render(card.render(bodyContent));
}
