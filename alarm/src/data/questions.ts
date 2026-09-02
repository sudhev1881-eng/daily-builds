export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  trick?: boolean;
  reveal?: string;
}

export const QUESTIONS: QuizQuestion[] = [
  {
    id: "months-28",
    prompt: "How many months have 28 days?",
    options: ["Only February", "1", "12", "Depends on the year"],
    correctIndex: 2,
    trick: true,
    reveal: "Every month has at least 28 days.",
  },
  {
    id: "moses-ark",
    prompt: "How many animals of each kind did Moses take on the ark?",
    options: ["Two", "Seven", "Zero", "One pair plus extras"],
    correctIndex: 2,
    trick: true,
    reveal: "Moses never had an ark. That was Noah.",
  },
  {
    id: "rooster",
    prompt: "A rooster lays an egg on a roof. Which way does it roll?",
    options: ["Left", "Right", "Down", "It doesn't"],
    correctIndex: 3,
    trick: true,
    reveal: "Roosters do not lay eggs.",
  },
  {
    id: "apples",
    prompt: "You have 3 apples and you take 2. How many do you have?",
    options: ["1", "2", "3", "5"],
    correctIndex: 1,
    trick: true,
    reveal: "You took two. Those two are yours.",
  },
  {
    id: "feather",
    prompt: "Which is heavier: 1 kg of steel or 1 kg of feathers?",
    options: ["Steel", "Feathers", "They weigh the same", "Depends on gravity"],
    correctIndex: 2,
  },
  {
    id: "polar",
    prompt: "What color is a polar bear's skin?",
    options: ["White", "Pink", "Black", "Transparent"],
    correctIndex: 2,
    trick: true,
    reveal: "The fur is clear. The skin is black.",
  },
  {
    id: "math-zero",
    prompt: "1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 × 0 + 1 = ?",
    options: ["0", "1", "2", "13"],
    correctIndex: 2,
    trick: true,
    reveal: "Multiplication first: 1×0 = 0, then twelve 1s become 2? Wait — eleven 1s + 0 + 1 = 12. Actually: 1 twelve times with ×0 on the 12th 1: 11 + 0 + 1 = 12. Hmm.",
  },
  {
    id: "silence",
    prompt: "What is so fragile that saying its name breaks it?",
    options: ["Glass", "Silence", "A promise", "Sleep"],
    correctIndex: 1,
  },
  {
    id: "clock-hands",
    prompt: "How many times a day do a clock's hands overlap?",
    options: ["12", "22", "24", "11"],
    correctIndex: 1,
  },
  {
    id: "tomb",
    prompt: "Anyone can have me, but nobody can hold me. What am I?",
    options: ["A secret", "Your name", "A shadow", "Time"],
    correctIndex: 1,
    trick: true,
    reveal: "Everyone has a name. Nobody holds it.",
  },
  {
    id: "match",
    prompt: "You walk into a room with a match, a kerosene lamp, a candle, and a fireplace. What do you light first?",
    options: ["The lamp", "The candle", "The fireplace", "The match"],
    correctIndex: 3,
    trick: true,
    reveal: "You cannot light anything else first.",
  },
  {
    id: "electric",
    prompt: "What invention lets you look through a wall?",
    options: ["X-ray", "A window", "A camera", "Wi-Fi"],
    correctIndex: 1,
    trick: true,
  },
  {
    id: "odd-one",
    prompt: "Which word does not belong: stop, drop, roll, alarm?",
    options: ["stop", "drop", "roll", "alarm"],
    correctIndex: 3,
  },
  {
    id: "wake",
    prompt: "The only way to stop this alarm is to…",
    options: ["Hit snooze", "Unplug the universe", "Answer correctly", "Beg in Malayalam"],
    correctIndex: 2,
  },
  {
    id: "half",
    prompt: "I am an odd number. Take away a letter and I become even. What number am I?",
    options: ["Nine", "Seven", "Five", "One"],
    correctIndex: 1,
    reveal: "SEVEN minus S is EVEN.",
  },
];

// Fix the ambiguous math question with a clean correct answer
QUESTIONS.splice(
  QUESTIONS.findIndex((q) => q.id === "math-zero"),
  1,
  {
    id: "math-zero",
    prompt: "What is 8 ÷ 2(2 + 2)?",
    options: ["1", "16", "8", "Both 1 and 16, depending who you ask"],
    correctIndex: 3,
    trick: true,
    reveal: "YOU FELL FOR IT. The internet has been fighting this for years.",
  },
);

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function nextQuestion(excludeIds: string[]): QuizQuestion {
  const pool = QUESTIONS.filter((q) => !excludeIds.includes(q.id));
  const source = pool.length ? pool : QUESTIONS;
  const q = source[Math.floor(Math.random() * source.length)]!;
  const order = q.options.map((_, i) => i);
  const shuffled = shuffle(order);
  return {
    ...q,
    options: shuffled.map((i) => q.options[i]!),
    correctIndex: shuffled.indexOf(q.correctIndex),
  };
}
