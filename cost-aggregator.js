#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load pricing rates
const pricingRates = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pricing-rates.json'), 'utf8')
);

// Helper function to calculate cost from tokens
function calculateCost(provider, model, inputTokens, outputTokens) {
  let rates = null;
  
  // Extract simplified model name
  const modelKey = model
    .replace('anthropic/', '')
    .replace('openai/', '')
    .replace('google/', '')
    .toLowerCase();

  if (provider === 'anthropic') {
    // Try exact match, then fallback to haiku (most common)
    rates = pricingRates.providers.anthropic.models[modelKey] ||
            pricingRates.providers.anthropic.models['claude-haiku-4-5'];
  } else if (provider === 'openai') {
    rates = pricingRates.providers.openai.models[modelKey] ||
            pricingRates.providers.openai.models['gpt-5.1-codex'];
  } else if (provider === 'google') {
    rates = pricingRates.providers.google.models[modelKey] ||
            pricingRates.providers.google.models['gemini-2.0-flash'];
  }

  if (!rates) {
    console.error(`No rates found for ${provider}/${model}`);
    return 0;
  }

  const inputCost = (inputTokens / 1000000) * rates.inputPer1M;
  const outputCost = (outputTokens / 1000000) * rates.outputPer1M;
  return inputCost + outputCost;
}

// Helper function to determine time period
function getTimePeriod(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateAtMidnight = new Date(date);
  dateAtMidnight.setHours(0, 0, 0, 0);

  // Today
  if (dateAtMidnight.getTime() === today.getTime()) {
    return 'today';
  }

  // This week (Monday to Sunday)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  if (dateAtMidnight >= weekStart && dateAtMidnight <= today) {
    return 'week';
  }

  // This month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  if (dateAtMidnight >= monthStart && dateAtMidnight <= today) {
    return 'month';
  }

  return 'older';
}

// Read and parse JSONL files
async function readJsonlFile(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const records = [];
  for await (const line of rl) {
    if (line.trim()) {
      try {
        records.push(JSON.parse(line));
      } catch (e) {
        console.error(`Failed to parse line in ${filePath}:`, e.message);
      }
    }
  }
  return records;
}

// Main aggregation function
async function aggregateCosts() {
  const cronDir = '/Users/henry/.openclaw/cron/runs';
  const costByProvider = {
    anthropic: { today: 0, week: 0, month: 0, breakdown: [] },
    openai: { today: 0, week: 0, month: 0, breakdown: [] },
    google: { today: 0, week: 0, month: 0, breakdown: [] }
  };

  // Read all JSONL files from cron runs
  try {
    const files = fs.readdirSync(cronDir).filter(f => f.endsWith('.jsonl'));

    for (const file of files) {
      const filePath = path.join(cronDir, file);
      const records = await readJsonlFile(filePath);

      for (const record of records) {
        // Extract cost information
        if (record.usage && record.provider && record.ts) {
          const provider = record.provider.toLowerCase();
          const model = record.model || `${provider}/unknown`;
          const inputTokens = record.usage.input_tokens || 0;
          const outputTokens = record.usage.output_tokens || 0;

          const cost = calculateCost(provider, model, inputTokens, outputTokens);
          const period = getTimePeriod(record.ts);

          if (costByProvider[provider]) {
            // Add to appropriate time period
            if (period === 'today') {
              costByProvider[provider].today += cost;
              costByProvider[provider].week += cost;
              costByProvider[provider].month += cost;
            } else if (period === 'week') {
              costByProvider[provider].week += cost;
              costByProvider[provider].month += cost;
            } else if (period === 'month') {
              costByProvider[provider].month += cost;
            }

            // Add to breakdown
            costByProvider[provider].breakdown.push({
              timestamp: record.ts,
              cost: parseFloat(cost.toFixed(4)),
              tokens: inputTokens + outputTokens,
              model: model,
              jobId: record.jobId
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading cron files:', err.message);
  }

  // Round all costs to 2 decimal places
  for (const provider in costByProvider) {
    costByProvider[provider].today = parseFloat(costByProvider[provider].today.toFixed(2));
    costByProvider[provider].week = parseFloat(costByProvider[provider].week.toFixed(2));
    costByProvider[provider].month = parseFloat(costByProvider[provider].month.toFixed(2));
  }

  return costByProvider;
}

// Update data.json with cost aggregation
async function updateDashboardData() {
  const dataPath = path.join(__dirname, 'data.json');
  let data = {};

  // Load existing data
  if (fs.existsSync(dataPath)) {
    try {
      data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
      console.error('Failed to parse existing data.json:', e.message);
    }
  }

  // Aggregate costs
  const costByProvider = await aggregateCosts();

  // Update data with cost breakdown
  data.costByProvider = costByProvider;
  data.costLastUpdated = new Date().toISOString();

  // Write updated data
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log('Dashboard data updated with cost aggregation');
  console.log(JSON.stringify(costByProvider, null, 2));
}

// Run if called directly
if (require.main === module) {
  updateDashboardData().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { aggregateCosts, calculateCost, getTimePeriod };
