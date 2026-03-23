# Mission Control Dashboard

Real-time cost tracking and reporting system for API usage across all services.

## Overview

Mission Control monitors:
- **Costs** by service (OpenAI, Anthropic, Google, ElevenLabs, Twilio, Render)
- **Daily budgets** ($20/day limit with warnings at thresholds)
- **Weekly & monthly budgets** ($150/week, $300/month)
- **System health** (OAuth tokens, cron success rates)
- **Blockers** and deadlines

## Architecture

```
mission-control/
├── index.html          # Dashboard UI (Chart.js)
├── data.json          # Auto-generated cost data
└── README.md          # This file

../
├── cost-logger.js              # Logs API costs to SQLite
├── daily-report-generator.js   # Generates markdown reports
├── generate-dashboard-data.js  # Exports data to data.json
├── mission-control.sqlite      # Cost database
└── setup-cron.sh               # Cron job installer
```

## Quick Start

### 1. Initialize Database

```bash
cd /workspace
node cost-logger.js
```

This creates `mission-control.sqlite` with all necessary tables.

### 2. Generate Dashboard Data

```bash
node generate-dashboard-data.js
```

This reads the database and exports `mission-control/data.json` for the dashboard.

### 3. Deploy to GitHub Pages

```bash
# Copy mission-control/ folder to your GitHub Pages branch
git checkout gh-pages
cp -r /workspace/mission-control/* .
git add .
git commit -m "Update Mission Control dashboard"
git push
```

Access the dashboard at: `https://your-username.github.io/your-repo/mission-control/`

### 4. Set Up Daily Reports

```bash
cd /workspace
chmod +x setup-cron.sh
./setup-cron.sh
```

This configures a daily cron job at 7 AM to:
1. Generate a markdown report
2. Send via email (using `gog`)
3. Send via Telegram (using `message` tool)

## Cost Calculation

| Service | Input | Output |
|---------|-------|--------|
| OpenAI | $0.15/1M | $0.60/1M |
| Anthropic Haiku | $0.80/1M | $4.00/1M |
| Anthropic Sonnet | $3.00/1M | $15.00/1M |
| Anthropic Opus | $15.00/1M | $75.00/1M |
| Google Gemini | $0.075/1M | $0.30/1M |
| ElevenLabs TTS | $0.30 per 1K chars | — |
| Twilio | $0.0075 per minute | — |
| Render | $7/month (fixed) | — |

## Logging Costs

### From Your Code

```javascript
const CostLogger = require('./cost-logger.js');
const logger = new CostLogger();

// Log token-based cost
await logger.logTokenCost(
  '2026-03-23',        // date (YYYY-MM-DD)
  'openai',            // service
  'Morning Brief',     // job name
  5000,                // input tokens
  2000                 // output tokens
);

// Log usage-based cost (TTS, calls)
await logger.logUsageCost(
  '2026-03-23',
  'elevenlabs',
  'Text to Speech',
  5000  // characters
);
```

### Auto-Check Budgets

```javascript
const alerts = await logger.checkBudgets('2026-03-23');
// Returns array of alerts if thresholds exceeded
```

## Budget Alerts

Alerts trigger when:
- **Daily** spend exceeds $20
- **Weekly** spend exceeds $150
- **Monthly** spend exceeds $300

Alert messages are logged to the database and displayed on the dashboard.

## Daily Reports

The markdown report includes:
- Cost summary (today, week, month)
- Breakdown by service and job
- Active blockers and escalation timeline
- Upcoming deadlines
- System health status

Reports are saved to `reports/mission-control-YYYY-MM-DD.md`

## Dashboard Features

### Real-Time Updates
- Refreshes every 5 minutes
- Shows live budget status
- Color-coded alerts (green/yellow/red)

### Visualizations
- **Service Chart**: Pie chart of costs by service
- **Job Chart**: Bar chart of costs by job
- **Trend Chart**: Line graph of last 30 days

### Widgets
1. **Cost Summary** - Today, week, month with % of budget
2. **Cost by Service** - Pie chart breakdown
3. **Cost by Job** - Bar chart breakdown
4. **Cost Trends** - 30-day trend line
5. **System Health** - OAuth, Telegram, cron status
6. **Blockers** - Active blockers with escalation timeline
7. **Deadlines** - Upcoming deadlines with countdown
8. **Metrics** - Self-improvement stats

## Customization

### Change Budget Thresholds

Edit `cost-logger.js`:

```javascript
const THRESHOLDS = {
  daily: 20.00,    // Change this
  weekly: 150.00,  // Or this
  monthly: 300.00, // Or this
};
```

### Change Dashboard Colors

Edit `mission-control/index.html` CSS section:

```css
/* Dark blue theme */
body {
  background: #0f1419;
  color: #e0e0e0;
}

/* Accent color for highlights */
.summary-value {
  color: #00d4ff;  /* Change to your color */
}
```

## Troubleshooting

### Dashboard Shows No Data

1. Ensure database is initialized:
   ```bash
   node cost-logger.js
   ```

2. Generate dashboard data:
   ```bash
   node generate-dashboard-data.js
   ```

3. Check `data.json` exists:
   ```bash
   cat mission-control/data.json
   ```

### Reports Not Sending

1. Verify cron job is installed:
   ```bash
   crontab -l | grep daily-report
   ```

2. Check logs:
   ```bash
   tail -f logs/cron.log
   ```

3. Test manually:
   ```bash
   node daily-report-generator.js
   ```

## Integration

Mission Control integrates with:
- **OpenClaw cost-logger**: Automatically logs API usage
- **gog (Gmail)**: Sends daily reports via email
- **message (Telegram)**: Sends alerts and reports to Telegram
- **GitHub Pages**: Hosts the dashboard
- **SQLite**: Local cost database

## Security

- Database file (`mission-control.sqlite`) is **not** committed to GitHub
- API keys and secrets are **never** logged (only token counts)
- Email and Telegram sending is handled by OpenClaw tools (not in this code)
- Add to `.gitignore`:
  ```
  *.sqlite
  .env
  logs/
  ```

## Support

Questions or issues? Check:
1. `/workspace/MISSION-CONTROL-ARCHITECTURE.md` - System design
2. `cost-logger.js` - Database and logging
3. `daily-report-generator.js` - Report generation
4. `setup-cron.sh` - Cron configuration

---

**Created:** March 23, 2026
**Status:** Production Ready
**Last Updated:** 2026-03-23T11:00:00Z
