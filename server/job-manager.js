import { randomUUID } from 'crypto';
import { runScrape } from '../src/run-scrape.js';

const MAX_LOG_BUFFER = 500;

/** @typedef {'idle'|'running'|'completed'|'failed'|'cancelled'} JobStatus */

/**
 * @typedef {object} Job
 * @property {string} id
 * @property {JobStatus} status
 * @property {object} options
 * @property {string[]} logs
 * @property {object[]} [results]
 * @property {object[]} [skippedResults]
 * @property {object} [stats]
 * @property {string} [jsonPath]
 * @property {string} [csvPath]
 * @property {string} [errorLogPath]
 * @property {string} [error]
 * @property {Date} createdAt
 * @property {Date} [startedAt]
 * @property {Date} [finishedAt]
 * @property {AbortController} [abortController]
 * @property {Set<(event: object) => void>} listeners
 */

export class JobManager {
  constructor() {
    /** @type {Job|null} */
    this.currentJob = null;
    /** @type {Job|null} */
    this.lastJob = null;
  }

  getRunningJob() {
    return this.currentJob?.status === 'running' ? this.currentJob : null;
  }

  getJob(id) {
    if (this.currentJob?.id === id) return this.currentJob;
    if (this.lastJob?.id === id) return this.lastJob;
    return null;
  }

  /**
   * @param {object} options
   * @returns {{ job: Job } | { error: string, status: number }}
   */
  createJob(options) {
    if (this.getRunningJob()) {
      return { error: 'A scrape job is already running', status: 409 };
    }

    const job = {
      id: randomUUID(),
      status: 'running',
      options,
      logs: [],
      results: [],
      skippedResults: [],
      createdAt: new Date(),
      startedAt: new Date(),
      abortController: new AbortController(),
      listeners: new Set(),
    };

    this.currentJob = job;
    this.lastJob = job;

    this._runJob(job).catch(() => {});

    return { job: this.sanitizeJob(job) };
  }

  cancelJob(id) {
    const job = this.getJob(id);
    if (!job) return { error: 'Job not found', status: 404 };
    if (job.status !== 'running') return { error: 'Job is not running', status: 400 };

    job.abortController?.abort();
    return { job: this.sanitizeJob(job) };
  }

  subscribe(id, listener) {
    const job = this.getJob(id);
    if (!job) return null;

    job.listeners.add(listener);

    for (const line of job.logs) {
      listener({ type: 'log', message: line });
    }

    for (const result of job.results) {
      listener({ type: 'result', result, replay: true });
    }

    for (const skipped of job.skippedResults) {
      listener({ type: 'skip', result: skipped, replay: true });
    }

    if (job.status !== 'running') {
      listener(this._terminalEvent(job));
    }

    return () => job.listeners.delete(listener);
  }

  sanitizeJob(job) {
    return {
      id: job.id,
      status: job.status,
      options: job.options,
      stats: job.stats ?? null,
      results: job.results ?? null,
      skippedResults: job.skippedResults ?? null,
      jsonPath: job.jsonPath ?? null,
      csvPath: job.csvPath ?? null,
      errorLogPath: job.errorLogPath ?? null,
      error: job.error ?? null,
      createdAt: job.createdAt,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
      logCount: job.logs.length,
    };
  }

  /** @param {Job} job */
  _appendResult(job, record) {
    job.results.push(record);
    const event = { type: 'result', result: record };
    for (const listener of job.listeners) {
      listener(event);
    }
  }

  /** @param {Job} job */
  _appendSkipped(job, record) {
    job.skippedResults.push(record);
    const event = { type: 'skip', result: record };
    for (const listener of job.listeners) {
      listener(event);
    }
  }

  /** @param {Job} job */
  _appendLog(job, message) {
    job.logs.push(message);
    if (job.logs.length > MAX_LOG_BUFFER) {
      job.logs.shift();
    }
    const event = { type: 'log', message };
    for (const listener of job.listeners) {
      listener(event);
    }
  }

  /** @param {Job} job */
  _terminalEvent(job) {
    if (job.status === 'completed') {
      return {
        type: 'done',
        job: this.sanitizeJob(job),
      };
    }
    return {
      type: 'error',
      message: job.error || 'Job failed',
      status: job.status,
      job: this.sanitizeJob(job),
    };
  }

  /** @param {Job} job */
  _finish(job, status, extra = {}) {
    job.status = status;
    job.finishedAt = new Date();
    Object.assign(job, extra);

    const event = this._terminalEvent(job);
    for (const listener of job.listeners) {
      listener(event);
    }

    if (this.currentJob?.id === job.id) {
      this.lastJob = job;
      this.currentJob = null;
    }
  }

  /** @param {Job} job */
  async _runJob(job) {
    const onLog = (message) => this._appendLog(job, message);

    try {
      const result = await runScrape(job.options, {
        onLog,
        onResult: (record) => this._appendResult(job, record),
        onSkip: (record) => this._appendSkipped(job, record),
        signal: job.abortController.signal,
        echoToConsole: true,
      });

      job.results = result.results;
      job.skippedResults = result.skippedResults;
      job.stats = result.stats;
      job.jsonPath = result.jsonPath;
      job.csvPath = result.csvPath;
      job.errorLogPath = result.errorLogPath;

      this._finish(job, 'completed');
    } catch (error) {
      if (error.name === 'AbortError') {
        this._finish(job, 'cancelled', { error: 'Cancelled by user' });
      } else {
        onLog(`[error] Fatal error: ${error.message}`);
        this._finish(job, 'failed', { error: error.message });
      }
    }
  }
}

export const jobManager = new JobManager();
