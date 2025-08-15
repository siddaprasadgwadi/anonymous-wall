import Sentiment from 'sentiment';
import { Filter } from 'bad-words';

const sentiment = new Sentiment();
const filter = new Filter();

// crude toxicity: if profanity detected -> toxic
export function analyzeText(text) {
  const { score } = sentiment.analyze(text || '');
  const s =
    score > 1 ? 'positive' :
    score < -1 ? 'negative' : 'neutral';

  const isToxic = filter.isProfane(text || '');

  // tiny tagger: keywords → tags
  const tags = [];
  const lower = (text || '').toLowerCase();
  if (lower.includes('love')) tags.push('love');
  if (lower.includes('sad') || lower.includes('depress')) tags.push('support');
  if (lower.includes('job') || lower.includes('work')) tags.push('work');
  if (lower.includes('study') || lower.includes('exam')) tags.push('study');

  return { sentiment: s, isToxic, tags };
}
