/**
 * Lightweight, deterministic keyword/rating heuristic for tagging guest
 * reviews with a sentiment + topic chips. Not a real ML model — this
 * mirrors what the landing page previously computed client-side (mock),
 * moved server-side so every consumer (landing page, branch-manager
 * screen) sees the same sentiment for the same review instead of each
 * recomputing its own guess.
 */

export type ReviewSentiment = 'Positive' | 'Neutral' | 'Negative';

export interface SentimentResult {
  sentiment: ReviewSentiment;
  confidence: number; // 0-100
  issues: string[];
}

const POSITIVE_TOPICS: Array<[string[], string]> = [
  [['clean', 'spotless', 'tidy'], 'Clean rooms'],
  [['friendly', 'polite', 'courteous', 'helpful staff', 'staff'], 'Friendly staff'],
  [['bed', 'sleep', 'comfortable', 'comfort'], 'Comfortable beds'],
  [['food', 'delicious', 'breakfast', 'meal', 'tasty'], 'Good food'],
  [['wifi', 'wi-fi', 'internet'], 'Nice Wi-Fi'],
  [['quiet', 'peaceful', 'calm'], 'Quiet environment'],
  [['fast service', 'quick', 'prompt'], 'Fast service'],
];

const NEGATIVE_TOPICS: Array<[string[], string]> = [
  [['slow check-in', 'check-in took', 'checkin'], 'Slow check-in'],
  [['delayed', 'late', 'cold food', 'lukewarm'], 'Delayed food'],
  [['noisy', 'loud'], 'Noisy rooms'],
  [['cold shower', 'cold water'], 'Cold shower'],
  [['parking'], 'Poor parking'],
  [['slow service', 'waited', 'wait staff'], 'Slow service'],
];

export function analyzeReviewSentiment(rating: number, content: string): SentimentResult {
  const text = (content || '').toLowerCase();
  const negativeSignal = /delayed|slow|bad|disappoint|cold|noisy|rude|dirty|broken/.test(text);

  let sentiment: ReviewSentiment;
  if (rating <= 2 || negativeSignal) {
    sentiment = 'Negative';
  } else if (rating === 3) {
    sentiment = 'Neutral';
  } else {
    sentiment = 'Positive';
  }

  const topics = sentiment === 'Negative' ? NEGATIVE_TOPICS : POSITIVE_TOPICS;
  const issues = topics
    .filter(([keywords]) => keywords.some((kw) => text.includes(kw)))
    .map(([, label]) => label);

  // Deterministic "confidence" derived from how strongly the rating and
  // detected keywords agree, not a real model output.
  const confidence = Math.min(98, 82 + issues.length * 4 + (rating === 1 || rating === 5 ? 4 : 0));

  return { sentiment, confidence, issues };
}
