"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require('crypto');
const USAGE_FILE = 'usage.json';
const SCHEMA_VERSION = 1;
const MAX_RECORDS = 20_000;
const RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}
function tokenFields(raw = {}) {
    const input = finite(raw.prompt_tokens ?? raw.input_tokens);
    const output = finite(raw.completion_tokens ?? raw.output_tokens);
    const total = finite(raw.total_tokens) || input + output;
    const cached = finite(raw.cached_tokens ?? raw.prompt_tokens_details?.cached_tokens ?? raw.input_tokens_details?.cache_read_tokens);
    const reasoning = finite(raw.reasoning_tokens ?? raw.completion_tokens_details?.reasoning_tokens);
    return { input, output, total, cached, reasoning };
}
function estimateText(value) {
    if (value == null)
        return 0;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    // A deterministic local estimate for providers that do not report usage.
    // It is intentionally labelled as estimated in every API/UI surface.
    return Math.max(0, Math.ceil(text.length / 4));
}
function mergeUsage(base = {}, next = {}) {
    const left = tokenFields(base);
    const right = tokenFields(next);
    return {
        prompt_tokens: Math.max(left.input, right.input),
        completion_tokens: Math.max(left.output, right.output),
        total_tokens: Math.max(left.total, right.total, Math.max(left.input, right.input) + Math.max(left.output, right.output)),
        cached_tokens: Math.max(left.cached, right.cached),
        reasoning_tokens: Math.max(left.reasoning, right.reasoning),
    };
}
function normalizeUsage(raw, messages = [], output = '') {
    const exact = tokenFields(raw || {});
    if (exact.total > 0)
        return { ...exact, source: 'reported' };
    const input = messages.reduce((sum, message) => sum + estimateText(message.content) + 4, 0);
    const outputTokens = estimateText(output);
    return { input, output: outputTokens, total: input + outputTokens, cached: 0, reasoning: 0, source: 'estimated' };
}
function ledger(store) {
    const value = store.read(USAGE_FILE, { version: SCHEMA_VERSION, records: [] });
    if (Array.isArray(value))
        return { version: SCHEMA_VERSION, records: value };
    return { version: SCHEMA_VERSION, records: Array.isArray(value.records) ? value.records : [] };
}
async function recordUsage(store, input) {
    const now = new Date().toISOString();
    const normalized = input.usage || normalizeUsage(input.rawUsage, input.messages, input.output);
    const record = {
        id: `use_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        timestamp: input.timestamp || now,
        finishedAt: input.finishedAt || now,
        providerId: String(input.providerId || 'unknown'),
        providerName: String(input.providerName || input.providerId || 'Unknown'),
        model: String(input.model || 'unknown'),
        mode: input.mode === 'agent' ? 'agent' : 'chat',
        status: input.status === 'error' || input.status === 'cancelled' ? input.status : 'success',
        errorCode: input.errorCode ? String(input.errorCode).slice(0, 80) : null,
        workspaceId: input.workspaceId || null,
        projectId: input.projectId || null,
        conversationId: input.conversationId || null,
        runId: input.runId || null,
        interactionId: input.interactionId || input.runId || input.conversationId || null,
        step: finite(input.step),
        durationMs: finite(input.durationMs),
        inputTokens: finite(normalized.input),
        outputTokens: finite(normalized.output),
        totalTokens: finite(normalized.total) || finite(normalized.input) + finite(normalized.output),
        cachedTokens: finite(normalized.cached),
        reasoningTokens: finite(normalized.reasoning),
        source: normalized.source === 'reported' ? 'reported' : 'estimated',
    };
    await store.mutate(USAGE_FILE, current => {
        const state = Array.isArray(current) ? { version: SCHEMA_VERSION, records: current } : current;
        const cutoff = Date.now() - RETENTION_MS;
        state.version = SCHEMA_VERSION;
        state.records = [record, ...(state.records || [])]
            .filter(item => Date.parse(item.timestamp || '') >= cutoff)
            .slice(0, MAX_RECORDS);
        return state;
    }, { version: SCHEMA_VERSION, records: [] });
    return record;
}
function localParts(timestamp, offsetMinutes) {
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed))
        return { date: '0000-00-00', hour: 0 };
    const local = new Date(parsed - offsetMinutes * 60_000);
    return {
        date: local.toISOString().slice(0, 10),
        hour: local.getUTCHours(),
    };
}
function dateRange(days, offsetMinutes) {
    const end = new Date(Date.now() - offsetMinutes * 60_000);
    end.setUTCHours(0, 0, 0, 0);
    const out = [];
    for (let index = days - 1; index >= 0; index -= 1) {
        out.push(new Date(end.getTime() - index * 86_400_000).toISOString().slice(0, 10));
    }
    return out;
}
function summarizeRows(rows, days, offsetMinutes) {
    const dailyMap = new Map();
    const modelMap = new Map();
    const providerMap = new Map();
    const hours = Array.from({ length: 24 }, () => 0);
    const interactionIds = new Set();
    let inputTokens = 0, outputTokens = 0, totalTokens = 0, cachedTokens = 0, reasoningTokens = 0;
    let reportedTokens = 0, estimatedTokens = 0, errors = 0, durationMs = 0, durationCount = 0;
    for (const row of rows) {
        const { date, hour } = localParts(row.timestamp, offsetMinutes);
        const daily = dailyMap.get(date) || { date, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, errors: 0, models: {} };
        daily.inputTokens += finite(row.inputTokens);
        daily.outputTokens += finite(row.outputTokens);
        daily.totalTokens += finite(row.totalTokens);
        daily.requests += 1;
        if (row.status !== 'success')
            daily.errors += 1;
        daily.models[row.model] = finite(daily.models[row.model]) + finite(row.totalTokens);
        dailyMap.set(date, daily);
        const modelKey = String(row.model || 'unknown');
        const model = modelMap.get(modelKey) || { name: modelKey, totalTokens: 0, inputTokens: 0, outputTokens: 0, requests: 0 };
        model.totalTokens += finite(row.totalTokens);
        model.inputTokens += finite(row.inputTokens);
        model.outputTokens += finite(row.outputTokens);
        model.requests += 1;
        modelMap.set(modelKey, model);
        const providerKey = String(row.providerId || 'unknown');
        const provider = providerMap.get(providerKey) || { id: providerKey, name: row.providerName || providerKey, totalTokens: 0, requests: 0, errors: 0 };
        provider.totalTokens += finite(row.totalTokens);
        provider.requests += 1;
        if (row.status !== 'success')
            provider.errors += 1;
        providerMap.set(providerKey, provider);
        inputTokens += finite(row.inputTokens);
        outputTokens += finite(row.outputTokens);
        totalTokens += finite(row.totalTokens);
        cachedTokens += finite(row.cachedTokens);
        reasoningTokens += finite(row.reasoningTokens);
        if (row.source === 'reported')
            reportedTokens += finite(row.totalTokens);
        else
            estimatedTokens += finite(row.totalTokens);
        if (row.status !== 'success')
            errors += 1;
        if (row.durationMs) {
            durationMs += finite(row.durationMs);
            durationCount += 1;
        }
        hours[hour] += finite(row.totalTokens) || 1;
        interactionIds.add(String(row.interactionId || row.runId || row.conversationId || row.id));
    }
    const dailyDates = dateRange(days, offsetMinutes);
    const daily = dailyDates.map(date => dailyMap.get(date) || { date, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, errors: 0, models: {} });
    const models = [...modelMap.values()].filter(item => item.totalTokens > 0).sort((a, b) => b.totalTokens - a.totalTokens).map(item => ({ ...item, share: totalTokens ? item.totalTokens / totalTokens : 0 }));
    const providers = [...providerMap.values()].sort((a, b) => b.totalTokens - a.totalTokens).map(item => ({ ...item, share: totalTokens ? item.totalTokens / totalTokens : 0 }));
    const activeDates = new Set(rows.map(row => localParts(row.timestamp, offsetMinutes).date));
    const today = dateRange(1, offsetMinutes)[0];
    let currentStreak = 0;
    for (let cursor = new Date(`${today}T00:00:00.000Z`); activeDates.has(cursor.toISOString().slice(0, 10)); cursor = new Date(cursor.getTime() - 86_400_000))
        currentStreak += 1;
    let longestStreak = 0, running = 0, previous = '';
    for (const date of [...activeDates].sort()) {
        const adjacent = previous && Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === 86_400_000;
        running = adjacent ? running + 1 : 1;
        longestStreak = Math.max(longestStreak, running);
        previous = date;
    }
    const peakHour = hours.reduce((best, value, index) => value > hours[best] ? index : best, 0);
    return {
        totals: {
            inputTokens, outputTokens, totalTokens, cachedTokens, reasoningTokens,
            requests: rows.length, messages: interactionIds.size, sessions: interactionIds.size,
            activeDays: activeDates.size, errors, successRate: rows.length ? (rows.length - errors) / rows.length : 1,
            averagePerActiveDay: activeDates.size ? Math.round(totalTokens / activeDates.size) : 0,
            averageDurationMs: durationCount ? Math.round(durationMs / durationCount) : 0,
            reportedTokens, estimatedTokens, reportedShare: totalTokens ? reportedTokens / totalTokens : 0,
            currentStreak, longestStreak, peakHour,
        },
        daily, models, providers,
    };
}
function usageSummary(store, options = {}) {
    const all = ledger(store).records;
    const offsetMinutes = Math.max(-840, Math.min(840, Number(options.offsetMinutes) || 0));
    const requestedRange = String(options.range || '30');
    const days = requestedRange === 'all'
        ? Math.max(1, Math.min(400, all.length ? Math.ceil((Date.now() - Date.parse(all[all.length - 1].timestamp)) / 86_400_000) + 1 : 30))
        : Math.max(1, Math.min(365, Number.parseInt(requestedRange, 10) || 30));
    const startDate = dateRange(days, offsetMinutes)[0];
    const rows = all.filter(row => localParts(row.timestamp, offsetMinutes).date >= startDate)
        .filter(row => !options.projectId || row.projectId === options.projectId);
    const summary = summarizeRows(rows, days, offsetMinutes);
    const heatmapStart = dateRange(182, offsetMinutes)[0];
    const heatmapRows = all
        .filter(row => localParts(row.timestamp, offsetMinutes).date >= heatmapStart)
        .filter(row => !options.projectId || row.projectId === options.projectId);
    const heatmap = summarizeRows(heatmapRows, 182, offsetMinutes).daily.map(day => ({ date: day.date, totalTokens: day.totalTokens, requests: day.requests }));
    return {
        version: SCHEMA_VERSION,
        range: requestedRange,
        days,
        timezoneOffset: offsetMinutes,
        generatedAt: new Date().toISOString(),
        ...summary,
        heatmap,
        recent: rows.slice(0, 30),
    };
}
module.exports = { USAGE_FILE, mergeUsage, normalizeUsage, recordUsage, usageSummary };
//# sourceMappingURL=usage.js.map