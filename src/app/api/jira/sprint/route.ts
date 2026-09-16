import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
    priority: { name: string };
    issuetype: { name: string; subtask?: boolean };
    project: { key: string };
    labels?: string[];
    customfield_10016?: number | null;
    customfield_10028?: number | null;
  };
}

export interface SprintTicket {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string;
  issueType: string;
  projectKey: string;
  points: number | null;
  url: string;
}

const FIELDS = 'summary,status,priority,issuetype,project,labels,customfield_10016,customfield_10028';

function mapIssues(issues: JiraIssue[], baseUrl: string): SprintTicket[] {
  return issues.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    statusCategory: issue.fields.status.statusCategory.key,
    priority: issue.fields.priority?.name ?? 'Medium',
    issueType: issue.fields.issuetype.name,
    projectKey: issue.fields.project.key,
    points: (issue.fields.customfield_10016 ?? issue.fields.customfield_10028) ?? null,
    url: `${baseUrl}/browse/${issue.key}`,
  }));
}

async function jiraSearch(
  baseUrl: string,
  auth: string,
  jql: string,
  fields: string[] = FIELDS.split(',')
): Promise<JiraIssue[]> {
  const res = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ jql, fields, maxResults: 100 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jira returned ${res.status}${body ? ': ' + body.slice(0, 200) : ''}`);
  }
  const data = (await res.json()) as { issues: JiraIssue[] };
  return data.issues ?? [];
}

// Sprint labels look like "Sprint-7/6" (month/day = the sprint's start date).
// Pick the most recent label that has ALREADY STARTED (date <= today) — never a
// future sprint that's merely been pre-labeled. `todayRank` is month*100+day for
// today, so a future "Sprint-7/6" (706) is skipped while we're still on 7/1 (701).
function pickCurrentSprintLabel(issues: JiraIssue[], todayRank: number): string | null {
  const re = /^sprint-(\d{1,2})\/(\d{1,2})$/i;
  let best: { label: string; rank: number } | null = null;
  for (const issue of issues) {
    for (const label of issue.fields.labels ?? []) {
      const m = label.match(re);
      if (!m) continue;
      const rank = parseInt(m[1], 10) * 100 + parseInt(m[2], 10); // month*100 + day
      if (rank > todayRank) continue; // sprint hasn't started yet — ignore
      if (!best || rank > best.rank) best = { label, rank };
    }
  }
  return best?.label ?? null;
}

const SPRINT_LABEL_RE = /^sprint-\d{1,2}\/\d{1,2}$/i;

// Keep a ticket for a status column if it belongs to the current sprint OR carries
// no sprint label at all ("non-sprint" work). A ticket tagged for a *different*
// sprint (past or future) is dropped. When we have no current sprint, keep all.
function inSprintOrUnsprinted(issue: JiraIssue, sprintLabel: string | null): boolean {
  const labels = issue.fields.labels ?? [];
  if (!sprintLabel) return true;
  if (labels.includes(sprintLabel)) return true;        // tagged this sprint
  return !labels.some((l) => SPRINT_LABEL_RE.test(l));  // else only if it has NO sprint label
}

// Demo data for when JIRA is not configured
const DEMO_TICKETS = {
  inProgress: [
    { key: 'PROJ-42', summary: 'Implement auto-approve feature for agent commands', status: 'In Progress', statusCategory: 'indeterminate', priority: 'High', issueType: 'Task', projectKey: 'PROJ', points: 5, url: 'https://jira.example.com/browse/PROJ-42' },
    { key: 'PROJ-38', summary: 'Add color-coded terminal tabs by project', status: 'In Progress', statusCategory: 'indeterminate', priority: 'Medium', issueType: 'Task', projectKey: 'PROJ', points: 3, url: 'https://jira.example.com/browse/PROJ-38' },
  ],
  sprint: [
    { key: 'PROJ-51', summary: 'Fix system prompt not applying to spawned agents', status: 'To Do', statusCategory: 'new', priority: 'High', issueType: 'Bug', projectKey: 'PROJ', points: 3, url: 'https://jira.example.com/browse/PROJ-51' },
    { key: 'PROJ-44', summary: 'Add wiki health indicator + sync-check integration', status: 'To Do', statusCategory: 'new', priority: 'Medium', issueType: 'Story', projectKey: 'PROJ', points: 8, url: 'https://jira.example.com/browse/PROJ-44' },
    { key: 'PROJ-39', summary: 'Add working directory dropdown to agent creation', status: 'To Do', statusCategory: 'new', priority: 'Low', issueType: 'Enhancement', projectKey: 'PROJ', points: 2, url: 'https://jira.example.com/browse/PROJ-39' },
  ],
  submitted: [
    { key: 'PROJ-35', summary: 'Dockerize cockpit for cloud deployment', status: 'Submitted', statusCategory: 'done', priority: 'Medium', issueType: 'Task', projectKey: 'PROJ', points: 5, url: 'https://jira.example.com/browse/PROJ-35' },
    { key: 'PROJ-32', summary: 'Update operator identity system documentation', status: 'Submitted', statusCategory: 'done', priority: 'Low', issueType: 'Documentation', projectKey: 'PROJ', points: 2, url: 'https://jira.example.com/browse/PROJ-32' },
  ],
  sprintLabel: 'Sprint-9/15',
};

export async function GET() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_TOKEN;
  const baseUrl = process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net';

  if (!email || !token) {
    return NextResponse.json(DEMO_TICKETS, { status: 200 });
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  // Scope to one board's project (env override, else PROJ) so tickets from other
  // projects (CPP, PMO, …) don't leak into the tile.
  const project = process.env.JIRA_PROJECT || 'PROJ';
  // Today as month*100+day, for "has this sprint started yet?" comparisons.
  const now = new Date();
  const todayRank = (now.getMonth() + 1) * 100 + now.getDate();

  try {
    // Verify the token is still valid — search/jql returns 200-with-nothing on bad
    // auth, which otherwise looks like "no tickets" instead of an auth failure.
    const meRes = await fetch(`${baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    if (meRes.status === 401 || meRes.status === 403) {
      return NextResponse.json(
        { error: 'Jira token expired or invalid — regenerate it at id.atlassian.com and update JIRA_TOKEN in .env.local' },
        { status: 401 }
      );
    }

    // Detect the current sprint label (env override wins, else newest STARTED
    // Sprint-M/D among this project's unresolved issues).
    let sprintLabel = process.env.JIRA_SPRINT_LABEL || null;
    if (!sprintLabel) {
      const labelScan = await jiraSearch(
        baseUrl,
        auth,
        `assignee = currentUser() AND project = "${project}" AND resolution = Unresolved ORDER BY updated DESC`,
        ['labels']
      );
      sprintLabel = pickCurrentSprintLabel(labelScan, todayRank);
    }

    // When we know the sprint, constrain every column to it so the tile mirrors
    // the board (current-sprint work only). Falls back to project-only if no
    // started sprint label is found.
    const sprintClause = sprintLabel ? ` AND labels = "${sprintLabel}"` : '';

    const [inProgressRaw, sprintIssues, submittedRaw] = await Promise.all([
      // In Progress: fetch all my PROJ in-progress, then keep this sprint + non-sprint below.
      jiraSearch(baseUrl, auth, `assignee = currentUser() AND project = "${project}" AND status = "In Progress" ORDER BY priority ASC, updated DESC`),
      // Queued strictly this sprint but not yet started (avoids duplicating the In Progress column).
      jiraSearch(baseUrl, auth, `assignee = currentUser() AND project = "${project}"${sprintClause} AND resolution = Unresolved AND status != "In Progress" ORDER BY priority ASC, updated DESC`),
      // Submitted: fetch all my PROJ submitted, then keep this sprint + non-sprint below.
      jiraSearch(baseUrl, auth, `assignee = currentUser() AND project = "${project}" AND status = "Submitted" ORDER BY updated DESC`),
    ]);

    // Exclude sub-tasks — Jira Work Management boards roll sub-tasks up under their
    // parent Task card rather than showing them as their own rows, so counting them
    // separately inflates the tile vs. the board.
    const notSubtask = (i: JiraIssue) => !i.fields.issuetype.subtask;

    // In Progress + Submitted show current-sprint work plus any unlabeled ("non-sprint")
    // tickets, but hide tickets tagged for a different sprint (e.g. the future 7/6).
    const inProgress = inProgressRaw.filter(notSubtask).filter((i) => inSprintOrUnsprinted(i, sprintLabel));
    const submitted = submittedRaw.filter(notSubtask).filter((i) => inSprintOrUnsprinted(i, sprintLabel));
    const sprint = sprintIssues.filter(notSubtask);

    return NextResponse.json({
      inProgress: mapIssues(inProgress, baseUrl),
      sprint: mapIssues(sprint, baseUrl),
      submitted: mapIssues(submitted, baseUrl),
      sprintLabel,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
