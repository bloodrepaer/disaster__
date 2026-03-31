const { levenshtein, nameSimilarity } = require('../js/levenshtein.js');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

function assertNear(actual, expected, epsilon, label) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label} expected ${expected} +/- ${epsilon}, got ${actual}`);
  }
}

assertEqual(levenshtein('kitten', 'sitting'), 3, 'distance kitten/sitting');
assertEqual(levenshtein('Arjun', 'arjun'), 0, 'case-insensitive match');
assertEqual(levenshtein(' Arjun ', 'arjun'), 0, 'trimmed match');
assertEqual(levenshtein('', ''), 0, 'empty strings');

assertNear(nameSimilarity('Ramesh', 'Rames'), 1 - 1 / 6, 0.0001, 'similarity Ramesh/Rames');
assertNear(nameSimilarity('Arjun Kumar', 'Arjun Kumar'), 1, 0.0001, 'similarity identical');

console.log('Levenshtein tests passed.');
