(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    root.levenshtein = api.levenshtein;
    root.nameSimilarity = api.nameSimilarity;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function levenshtein(a, b) {
    a = String(a || '').toLowerCase().trim();
    b = String(b || '').toLowerCase().trim();
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function nameSimilarity(a, b) {
    const aa = String(a || '');
    const bb = String(b || '');
    const maxLen = Math.max(aa.length, bb.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(aa, bb) / maxLen;
  }

  return { levenshtein, nameSimilarity };
});
