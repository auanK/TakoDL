export default {
  baseUrl: 'https://api.mangadex.org',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, como Gecko) Chrome/108.0.0.0 Safari/537.36',
    Referer: 'https://mangadex.org',
  },
  requestTimeoutMs: 30000,
  defaultLimit: 500,
  volumesPerBatch: 2,
  chaptersPerBatch: 5,
  pagesPerBatch: 5,
  retryDelayMs: 10000,
  maxRetries: 5,
};
