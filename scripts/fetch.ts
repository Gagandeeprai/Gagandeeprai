import fs from "fs";
import path from "path";
import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import { getLocalDateString } from "./utils.js";

// Load configuration
const USERNAME = "Gagandeeprai";
const TZ_OFFSET = parseFloat(process.env.TIMEZONE_OFFSET || "5.5"); // IST Default
const CACHE_DIR = path.join(process.cwd(), "cache");
const CACHE_FILE = path.join(CACHE_DIR, "analytics.json");

// Ensure Cache Directory Exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface UserProfile {
  name: string;
  login: string;
  followers: number;
  following: number;
  starsGiven: number;
  starsReceived: number;
  publicRepos: number;
  totalCommits: number;
  totalIssues: number;
  totalPRs: number;
}

interface LanguageInfo {
  name: string;
  color: string;
  bytes: number;
  percentage: number;
}

interface AnalyticsDatabase {
  lastUpdated: string;
  user: UserProfile;
  languages: LanguageInfo[];
  contributions: Record<string, number>; // date YYYY-MM-DD -> count
  calendar: {
    weeks: Array<{
      contributionDays: Array<{
        date: string;
        contributionCount: number;
        contributionLevel: number;
      }>;
    }>;
    months: Array<{
      name: string;
      year: number;
      firstDay: string;
      totalWeeks: number;
    }>;
  };
  productiveTime: Record<number, number>; // hour 0-23 -> count
}


async function run() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.error("Error: GITHUB_TOKEN or GH_TOKEN environment variable is required.");
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  console.log(`Starting fetch pipeline for user: ${USERNAME} (TZ Offset: ${TZ_OFFSET})`);

  try {
    // 1. Fetch main GraphQL bundle (user profile, repos, and recent contributions calendar)
    console.log("Fetching profile, repository, and calendar details via GraphQL...");
    const gqlResponse: any = await graphqlWithAuth(`
      query($username: String!) {
        user(login: $username) {
          name
          login
          followers { totalCount }
          following { totalCount }
          starredRepositories { totalCount }
          repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes {
              name
              isFork
              isArchived
              stargazerCount
              forkCount
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node {
                    name
                    color
                  }
                }
              }
            }
          }
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                  contributionLevel
                }
              }
              months {
                name
                year
                firstDay
                totalWeeks
              }
            }
          }
        }
      }
    `, { username: USERNAME });

    const userNode = gqlResponse.user;
    const repoNodes = userNode.repositories.nodes || [];

    // 2. Fetch all-time issues and PRs via GraphQL search (exceeds individual collection limits)
    console.log("Fetching all-time PR and Issue counts via Search API...");
    const prSearch: any = await graphqlWithAuth(`
      query($query: String!) {
        search(query: $query, type: ISSUE, first: 1) {
          issueCount
        }
      }
    `, { query: `author:${USERNAME} type:pr` });

    const issueSearch: any = await graphqlWithAuth(`
      query($query: String!) {
        search(query: $query, type: ISSUE, first: 1) {
          issueCount
        }
      }
    `, { query: `author:${USERNAME} type:issue` });

    // 3. Fetch all-time commit counts using REST search API (most robust and reliable method)
    console.log("Fetching all-time Commits via REST Search API...");
    let totalCommits = 0;
    try {
      const commitSearchRes = await octokit.rest.search.commits({
        q: `author:${USERNAME}`,
      });
      totalCommits = commitSearchRes.data.total_count;
    } catch (err) {
      console.warn("Failed to fetch all-time commits count via Search API. Falling back to contribution calendar total.", err);
      totalCommits = userNode.contributionsCollection.contributionCalendar.totalContributions;
    }

    // 4. Parse Repository Languages (calculate total bytes, exclude forks and archived repositories)
    console.log("Analyzing language sizes across non-fork, non-archived repositories...");
    const languageBytes: Record<string, { color: string; bytes: number }> = {};
    let totalLanguageBytes = 0;
    let starsReceived = 0;

    repoNodes.forEach((repo: any) => {
      // Aggregate stars received
      if (!repo.isFork) {
        starsReceived += repo.stargazerCount || 0;
      }

      // Aggregate languages only for active, owned repositories
      if (repo.isFork || repo.isArchived) return;

      const langEdges = repo.languages?.edges || [];
      langEdges.forEach((edge: any) => {
        const name = edge.node.name;
        const color = edge.node.color || "#cccccc";
        const size = edge.size || 0;

        if (!languageBytes[name]) {
          languageBytes[name] = { color, bytes: 0 };
        }
        languageBytes[name].bytes += size;
        totalLanguageBytes += size;
      });
    });

    const languages: LanguageInfo[] = Object.keys(languageBytes)
      .map((name) => {
        const info = languageBytes[name];
        return {
          name,
          color: info.color,
          bytes: info.bytes,
          percentage: totalLanguageBytes > 0 ? (info.bytes / totalLanguageBytes) * 100 : 0,
        };
      })
      .sort((a, b) => b.bytes - a.bytes);

    // 5. Consolidate and Merge Contributions Calendar with existing local cache database
    console.log("Processing and caching daily contributions calendar...");
    let contributionsCache: Record<string, number> = {};

    const isRebuild = process.argv.includes("--rebuild");

    // Load current cache if exists (and --rebuild is not specified)
    if (fs.existsSync(CACHE_FILE) && !isRebuild) {
      try {
        const cachedDb: AnalyticsDatabase = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
        contributionsCache = cachedDb.contributions || {};
      } catch (e) {
        console.warn("Could not read analytics cache database, starting fresh.");
      }
    } else if (isRebuild) {
      console.log("Rebuild flag active. Skipping cached contributions for a clean fetch.");
    }

    // Merge recent calendar days
    const calendarWeeks = userNode.contributionsCollection.contributionCalendar.weeks || [];
    calendarWeeks.forEach((week: any) => {
      const days = week.contributionDays || [];
      days.forEach((day: any) => {
        contributionsCache[day.date] = day.contributionCount;
      });
    });

    // 6. Approximate Productive Time (commit/event distribution by hour)
    console.log("Approximating productive hours from user event timeline...");
    const productiveTime: Record<number, number> = {};
    for (let i = 0; i < 24; i++) productiveTime[i] = 0;

    try {
      const eventsRes = await octokit.rest.activity.listPublicEventsForUser({
        username: USERNAME,
        per_page: 100,
      });

      eventsRes.data.forEach((evt) => {
        if (evt.type === "PushEvent" && evt.created_at) {
          const dt = new Date(evt.created_at);
          // Convert to local time based on offset
          const utcTime = dt.getTime() + dt.getTimezoneOffset() * 60000;
          const localTime = new Date(utcTime + 3600000 * TZ_OFFSET);
          const hour = localTime.getHours();
          // Count commits inside push event or default to 1
          const commitCount = (evt.payload as any)?.commits?.length || 1;
          productiveTime[hour] = (productiveTime[hour] || 0) + commitCount;
        }
      });
    } catch (err) {
      console.warn("Could not retrieve user events for productive time calculation, writing zero counts.", err);
    }

    // Construct profile database object
    const userProfile: UserProfile = {
      name: userNode.name || USERNAME,
      login: userNode.login,
      followers: userNode.followers.totalCount,
      following: userNode.following.totalCount,
      starsGiven: userNode.starredRepositories.totalCount,
      starsReceived,
      publicRepos: userNode.repositories.nodes.filter((r: any) => !r.isFork).length,
      totalCommits,
      totalIssues: issueSearch.search.issueCount,
      totalPRs: prSearch.search.issueCount,
    };

    const finalDatabase: AnalyticsDatabase = {
      lastUpdated: new Date().toISOString(),
      user: userProfile,
      languages,
      contributions: contributionsCache,
      calendar: {
        weeks: calendarWeeks.map((week: any) => ({
          contributionDays: (week.contributionDays || []).map((day: any) => ({
            date: day.date,
            contributionCount: day.contributionCount,
            contributionLevel: day.contributionLevel === "NONE" ? 0 :
                               day.contributionLevel === "FIRST_QUARTILE" ? 1 :
                               day.contributionLevel === "SECOND_QUARTILE" ? 2 :
                               day.contributionLevel === "THIRD_QUARTILE" ? 3 : 4
          }))
        })),
        months: (userNode.contributionsCollection.contributionCalendar.months || []).map((m: any) => ({
          name: m.name,
          year: m.year,
          firstDay: m.firstDay,
          totalWeeks: m.totalWeeks
        }))
      },
      productiveTime,
    };

    // Save database
    fs.writeFileSync(CACHE_FILE, JSON.stringify(finalDatabase, null, 2), "utf-8");
    console.log(`Successfully harvested profile analytics database. Saved to ${CACHE_FILE}`);
  } catch (error) {
    console.error("Execution failed during data fetching workflow:", error);
    process.exit(1);
  }
}

run();
