import { readFileSync } from 'fs';
import { resolve, expandUser } from 'path';

// Expand ~ to home directory
function expandHome(path: string): string {
  if (path.startsWith('~')) {
    return process.env.HOME + path.slice(1);
  }
  return path;
}

export async function GET() {
  try {
    // Read DASHBOARD.md
    const dashboardPath = expandHome('~/projects/agentic-personal/ops/DASHBOARD.md');
    const dashboardContent = readFileSync(dashboardPath, 'utf-8');

    // Parse Priority Tasks table (lines between "## Priority Tasks" and "---")
    const priorityMatch = dashboardContent.match(/## Priority Tasks.*?\n\n.*?\n\n([\s\S]*?)---/);
    const priorities = [];
    if (priorityMatch) {
      const tableRows = priorityMatch[1].split('\n').filter(line => line.trim().startsWith('|'));
      // Skip header rows and parse data rows
      for (let i = 2; i < tableRows.length && i < 5; i++) {
        const cells = tableRows[i].split('|').map(c => c.trim()).filter(c => c);
        if (cells.length >= 3) {
          priorities.push({
            rank: cells[0],
            title: cells[1],
            area: cells[2],
            status: cells[cells.length - 2],
          });
        }
      }
    }

    // Read MEMORY.md
    const memoryPath = expandHome('~/.claude/projects/-Users-joshuaminton/memory/MEMORY.md');
    const memoryContent = readFileSync(memoryPath, 'utf-8');

    // Extract key memory sections (Operator Identity)
    const lines = memoryContent.split('\n');
    const keyReminders = [];
    let inOperatorSection = false;

    for (const line of lines) {
      if (line.includes('Operator Identity')) {
        inOperatorSection = true;
        continue;
      }
      if (inOperatorSection && line.startsWith('##') && !line.includes('Operator')) {
        break;
      }
      if (inOperatorSection && line.startsWith('- [')) {
        // Extract the description part (after the link)
        const match = line.match(/\] — (.*)/);
        if (match) {
          keyReminders.push(match[1]);
        }
      }
      if (keyReminders.length >= 3) break;
    }

    return Response.json({
      priorities: priorities.slice(0, 3),
      reminders: keyReminders,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Failed to read dashboard/memory:', error);
    // Return fallback data
    return Response.json({
      priorities: [
        {
          rank: '1',
          title: 'Apply to Management Consulting Firm',
          area: 'Freelancing',
          status: 'NOT STARTED',
        },
        {
          rank: '3',
          title: 'Submit EPIC Septic VBO application',
          area: 'Freelancing',
          status: 'DRAFT READY',
        },
        {
          rank: '4',
          title: 'Add ZD-Writer + ZAA Bot to portfolio',
          area: 'Freelancing',
          status: 'DRAFTED',
        },
      ],
      reminders: [
        'Phase 12: mechanism-driven building',
        'Energy drains: swirl, ambiguity, open loops',
        'Strategic Coherence: align identity with DASHBOARD priorities',
      ],
      lastUpdated: new Date().toISOString(),
    });
  }
}
