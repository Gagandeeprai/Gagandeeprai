import { SVGRenderer, Card } from "./renderer.js";
import { formatNumber, escapeXml } from "./utils.js";

const ICONS = {
  commit: `<path d="M10.8 2.5a8.3 8.3 0 100 16.6 8.3 8.3 0 000-16.6zM2.5 10.8c0-4.6 3.7-8.3 8.3-8.3 1.9 0 3.7.6 5.1 1.8L4.3 15.9a8.2 8.2 0 01-1.8-5.1zm8.3 8.3a8.2 8.2 0 01-5.1-1.8l11.6-11.6c1.2 1.4 1.8 3.2 1.8 5.1 0 4.6-3.7 8.3-8.3 8.3z" fill="currentColor"/>`,
  star: `<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z" fill="currentColor"/>`,
  pr: `<path d="M7.177 3.007L7.175 3h-.002a2.25 2.25 0 10-1.673 0h-.002l-.002.007v7.986l-.002.007a2.25 2.25 0 101.678 0v-7.99zM4.75 2.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm0 11.5a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm8.5-6a2.25 2.25 0 10-1.673 0h-.002l-.002.007v3.236a.75.75 0 001.5 0V7.757h.002z" fill="currentColor"/>`,
  issue: `<path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="currentColor"/><path fill-rule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" fill="currentColor"/>`,
  repo: `<path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25a.25.25 0 11-.5 0 .25.25 0 01.5 0z" fill="currentColor"/>`,
  user: `<path fill-rule="evenodd" d="M10.5 5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM12 5a4 4 0 11-8 0 4 4 0 018 0zm-7 7a3 3 0 00-3 3 .75.75 0 01-1.5 0 4.5 4.5 0 014.5-4.5h6a4.5 4.5 0 014.5 4.5.75.75 0 01-1.5 0 3 3 0 00-3-3H5z" fill="currentColor"/>`
};

export function generateStatsSvg(data: any): string {
  const user = data.user;
  const renderer = new SVGRenderer(495, 195);
  const card = new Card(
    495,
    195,
    `${user.name || user.login}'s GitHub Stats`,
    `<svg class="title" x="0" y="-12" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true">${ICONS.repo}</svg>`
  );

  const stats = [
    { label: "Total Commits", value: user.totalCommits, icon: ICONS.commit },
    { label: "Total PRs", value: user.totalPRs, icon: ICONS.pr },
    { label: "Total Issues", value: user.totalIssues, icon: ICONS.issue },
    { label: "Stars Received", value: user.starsReceived, icon: ICONS.star },
    { label: "Public Repositories", value: user.publicRepos, icon: ICONS.repo },
    { label: "Followers", value: user.followers, icon: ICONS.user },
  ];

  // Draw 2 columns of stats to make the card clean and compact
  const leftCol = stats.slice(0, 3);
  const rightCol = stats.slice(3, 6);

  const renderCol = (items: typeof stats, startX: number) => {
    return items.map((item, idx) => {
      const y = idx * 30 + 10;
      const cleanLabel = escapeXml(item.label);
      const cleanVal = formatNumber(item.value);
      return `
    <g transform="translate(${startX}, ${y})">
      <svg class="text-mute" x="0" y="-12" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
        ${item.icon}
      </svg>
      <text class="text-main" x="22" y="0">${cleanLabel}:</text>
      <text class="text-main bold mono" x="180" y="0" text-anchor="start">${cleanVal}</text>
    </g>`;
    }).join("");
  };

  const bodyContent = `
  <!-- Left column -->
  ${renderCol(leftCol, 10)}
  
  <!-- Right column -->
  ${renderCol(rightCol, 240)}
  `;

  return renderer.render(card.render(bodyContent));
}
