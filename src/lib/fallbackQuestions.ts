export type MCQ = {
  question: string;
  options: string[];
  answerIndex: number;
};

export const QUIZ_SLOT_COUNT = 5;

const WARMUP_QUESTION_BANK: MCQ[] = [
  {
    question: 'If all Bloops are Razzies and all Razzies are Lazzies, which statement must be true?',
    options: ['All Bloops are Lazzies', 'All Lazzies are Bloops', 'Some Razzies are not Bloops', 'No Lazzies are Bloops'],
    answerIndex: 0,
  },
  {
    question: 'A train travels 120 km in 2 hours. At the same speed, how far will it travel in 45 minutes?',
    options: ['30 km', '45 km', '60 km', '90 km'],
    answerIndex: 1,
  },
  {
    question: 'Which number completes the pattern: 2, 6, 12, 20, 30, ?',
    options: ['38', '40', '42', '44'],
    answerIndex: 2,
  },
  {
    question: 'In a code language, FOCUS is written as HQPEU. How is BRAIN written?',
    options: ['DTCKP', 'DSCKP', 'DTBKP', 'DTCJP'],
    answerIndex: 0,
  },
  {
    question: 'Five people sit in a row. A is left of B but right of C. D is at the far right. Who sits in the middle?',
    options: ['A', 'B', 'C', 'Cannot be determined'],
    answerIndex: 0,
  },
  {
    question: 'A product’s price drops 20%, then rises 25%. Compared to the original price, the final price is:',
    options: ['5% higher', 'Same', '5% lower', '10% lower'],
    answerIndex: 1,
  },
  {
    question: 'Which word does NOT belong with the others?',
    options: ['Triangle', 'Square', 'Circle', 'Rectangle'],
    answerIndex: 2,
  },
  {
    question: 'If 4 machines make 48 parts in 6 hours, how many parts do 6 machines make in 3 hours?',
    options: ['36', '48', '54', '72'],
    answerIndex: 0,
  },
  {
    question: 'Statement: “All focused learners take notes.” Conclusion: “Mia takes notes, so she is a focused learner.” This conclusion is:',
    options: ['Valid', 'Invalid — affirming the consequent', 'Invalid — denying the antecedent', 'Uncertain'],
    answerIndex: 1,
  },
  {
    question: 'A clock shows 3:15. What is the angle between the hour and minute hands?',
    options: ['0°', '7.5°', '15°', '30°'],
    answerIndex: 1,
  },
  {
    question: 'Rearrange the letters in LISTEN to form a meaningful word related to attention.',
    options: ['SILENT', 'ENLIST', 'TINSEL', 'INLETS'],
    answerIndex: 0,
  },
  {
    question: 'In a group of 40 students, 25 like math and 18 like science. If 10 like both, how many like neither?',
    options: ['5', '7', '9', '12'],
    answerIndex: 1,
  },
  {
    question: 'Which figure comes next in the sequence: ▲, ▼, ▲▲, ▼▼, ▲▲▲, ?',
    options: ['▼▼▼', '▲▲▲▲', '▼▼', '▲▼▲'],
    answerIndex: 0,
  },
  {
    question: 'A bat and ball cost $1.10 total. The bat costs $1 more than the ball. How much does the ball cost?',
    options: ['$0.05', '$0.10', '$0.15', '$0.20'],
    answerIndex: 0,
  },
  {
    question: 'If you face north and turn 135° clockwise, which direction are you facing?',
    options: ['East', 'Southeast', 'South', 'Southwest'],
    answerIndex: 1,
  },
  {
    question: 'Which ratio is equivalent to 3 : 5?',
    options: ['9 : 20', '12 : 20', '15 : 18', '6 : 8'],
    answerIndex: 1,
  },
  {
    question: 'A sequence starts 1, 1, 2, 3, 5, 8. What is the next number?',
    options: ['11', '12', '13', '14'],
    answerIndex: 2,
  },
  {
    question: 'All managers attend meetings. Some meetings are online. Which must be true?',
    options: ['Some managers attend online meetings', 'All online events are meetings', 'No manager skips all meetings', 'All meetings have managers'],
    answerIndex: 2,
  },
  {
    question: 'A cube has how many edges?',
    options: ['6', '8', '10', '12'],
    answerIndex: 3,
  },
  {
    question: 'If PROACTIVE is coded by shifting each letter +1 (P→Q, R→S…), what is FOCUS coded as?',
    options: ['GPDVT', 'GPVDT', 'GPDTV', 'GPEVT'],
    answerIndex: 0,
  },
  {
    question: 'Which fraction is the largest?',
    options: ['3/7', '4/9', '5/11', '2/5'],
    answerIndex: 3,
  },
  {
    question: 'A worker completes 1/4 of a job each hour. How long for the full job?',
    options: ['2 hours', '3 hours', '4 hours', '5 hours'],
    answerIndex: 2,
  },
  {
    question: 'Find the odd one out: 16, 25, 36, 49, 63',
    options: ['16', '25', '49', '63'],
    answerIndex: 3,
  },
  {
    question: 'In a certain language, “focus block” means “stay sharp”. If “block time” means “wait period”, what could “focus time” mean?',
    options: ['Sharp wait', 'Stay period', 'Sharp period', 'Cannot determine'],
    answerIndex: 3,
  },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickWarmupQuestions(count = QUIZ_SLOT_COUNT): MCQ[] {
  return shuffle(WARMUP_QUESTION_BANK).slice(0, count);
}

export function shouldUseWarmupQuestions(goal: string, apiKey: string): boolean {
  return !goal.trim() || !apiKey.trim();
}
