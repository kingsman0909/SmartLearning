export const topicData = [
  {
    title: "Introduction to Probability",
    desc: "Learn basic probability concepts and definitions",
    difficulty: "easy",
  },
  {
    title: "Sample Spaces and Events",
    desc: "Understanding sample spaces and event types",
    difficulty: "easy",
  },
  {
    title: "Independent Events",
    desc: "Learn about independent events and multiplication rule",
    difficulty: "medium",
  },
  {
    title: "Conditional Probability",
    desc: "Understanding probability given conditions",
    difficulty: "hard",
  },
  {
    title: "Bayes' Theorem",
    desc: "Advanced probability theorem with applications",
    difficulty: "hard",
  },
  {
    title: "Random Variables",
    desc: "Understanding discrete and continuous random variables",
    difficulty: "medium",
  },
  {
    title: "Expected Value",
    desc: "Calculating expected values and variance",
    difficulty: "hard",
  },
  {
    title: "Binomial Distribution",
    desc: "Understanding binomial probability distributions",
    difficulty: "hard",
  },
];

export const flashCardData = [
  {
    category: "Basic",
    question: "What is P(Heads) when tossing a fair coin?",
    options: ["0", "1/4", "1/2", "1"],
    correctAnswer: 2,
    explanation:
      "A fair coin has 2 equally likely outcomes. P(Heads) = 1/2",
  },
  {
    category: "Basic",
    question: "What is P(rolling a 3) on a fair die?",
    options: ["1/6", "1/3", "1/2", "2/3"],
    correctAnswer: 0,
    explanation:
      "There is one favorable outcome (3) out of 6 possible outcomes. P(3) = 1/6",
  },
  {
    category: "Basic",
    question: "A bag has 3 red, 5 blue marbles. P(red)?",
    options: ["3/5", "3/8", "5/8", "1/2"],
    correctAnswer: 1,
    explanation:
      "Total = 3 + 5 = 8. P(red) = 3/8 = 0.375",
  },
  {
    category: "Basic",
    question: "What is P(even) on a standard die?",
    options: ["1/6", "1/3", "1/2", "2/3"],
    correctAnswer: 2,
    explanation:
      "Even numbers: {2,4,6} → 3 outcomes. P(even) = 3/6 = 1/2",
  },
  {
    category: "Events",
    question: "Two dice, P(sum = 7)?",
    options: ["1/6", "1/12", "1/18", "1/36"],
    correctAnswer: 0,
    explanation:
      "Ways to get 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) → 6/36 = 1/6",
  },
  {
    category: "Events",
    question: "P(drawing a heart) from a deck?",
    options: ["1/4", "1/13", "1/52", "1/2"],
    correctAnswer: 0,
    explanation:
      "13 hearts out of 52 cards. P(heart) = 13/52 = 1/4",
  },
  {
    category: "Events",
    question: "P(drawing a face card) from a deck?",
    options: ["3/13", "1/13", "4/13", "1/4"],
    correctAnswer: 0,
    explanation:
      "12 face cards. P = 12/52 = 3/13",
  },
  {
    category: "Independent",
    question:
      "P(A∩B) if P(A)=0.6, P(B)=0.4, independent?",
    options: ["0.24", "0.6", "0.4", "1.0"],
    correctAnswer: 0,
    explanation:
      "For independent events: P(A∩B) = P(A) × P(B) = 0.24",
  },
  {
    category: "Independent",
    question: "P(Heads AND 6) with coin and die?",
    options: ["1/6", "1/12", "1/18", "1/36"],
    correctAnswer: 1,
    explanation:
      "P(Heads)=1/2 and P(6)=1/6. Therefore P = 1/12",
  },
  {
    category: "Conditional",
    question: "P(heart | red) from a deck?",
    options: ["1/2", "1/4", "1/13", "1/26"],
    correctAnswer: 0,
    explanation:
      "26 red cards and 13 hearts. P(heart|red) = 13/26 = 1/2",
  },
  {
    category: "Conditional",
    question:
      "P(Math | Science) if P(Math)=0.6, P(Sci)=0.7, both=0.5?",
    options: ["5/7", "2/3", "3/5", "7/12"],
    correctAnswer: 0,
    explanation:
      "P(Math|Science) = 0.5/0.7 = 5/7 ≈ 0.714",
  },
  {
    category: "Bayes",
    question:
      "P(A|B) if P(A)=0.3, P(B|A)=0.8, P(B|A')=0.2?",
    options: ["0.24", "0.63", "0.38", "0.5"],
    correctAnswer: 1,
    explanation:
      "P(B)=0.38. P(A|B)=0.24/0.38≈0.63",
  },
  {
    category: "Bayes",
    question:
      "P(Disease|Positive) if prevalence=1%, accuracy=99%?",
    options: ["0.99", "0.5", "0.09", "0.01"],
    correctAnswer: 1,
    explanation:
      "P(D|+) = 0.99×0.01/(0.99×0.01+0.01×0.99) = 0.5",
  },
  {
    category: "Advanced",
    question: "3 coins, P(at least one head)?",
    options: ["1/8", "3/8", "7/8", "1/2"],
    correctAnswer: 2,
    explanation:
      "P(at least one head) = 1 - P(no heads) = 1 - 1/8 = 7/8",
  },
  {
    category: "Advanced",
    question: "2 cards without replacement, P(both aces)?",
    options: ["1/169", "1/221", "1/52", "1/26"],
    correctAnswer: 1,
    explanation:
      "P = 4/52 × 3/51 = 1/221",
  },
  {
    category: "Advanced",
    question:
      "P(A∩B) if P(A)=0.7, P(B)=0.6, P(A∪B)=0.9?",
    options: ["0.3", "0.4", "0.5", "0.6"],
    correctAnswer: 1,
    explanation:
      "P(A∩B)=0.7+0.6-0.9=0.4",
  },
  {
    category: "Advanced",
    question: "2 dice, P(sum even)?",
    options: ["1/4", "1/3", "1/2", "2/3"],
    correctAnswer: 2,
    explanation:
      "P = (3/6)² + (3/6)² = 1/2",
  },
  {
    category: "Advanced",
    question:
      "Mutually exclusive: P(A)=0.3, P(B)=0.4, P(A∪B)?",
    options: ["0.12", "0.7", "0.58", "0.28"],
    correctAnswer: 1,
    explanation:
      "P(A∩B)=0, so P(A∪B)=0.3+0.4=0.7",
  },
];

export const practiceProblems = {
  easy: [
    {
      question: "What is P(Heads) when tossing a fair coin?",
      options: ["0", "1/4", "1/2", "1"],
      correct: 2,
      solution: "P(Heads) = 1/2",
    },
    {
      question: "What is P(rolling a 3) on a fair die?",
      options: ["1/6", "1/3", "1/2", "2/3"],
      correct: 0,
      solution: "P(3) = 1/6",
    },
    {
      question: "A bag has 3 red, 5 blue marbles. P(red)?",
      options: ["3/5", "3/8", "5/8", "1/2"],
      correct: 1,
      solution: "P(red) = 3/8",
    },
  ],

  medium: [
    {
      question: "Two dice, P(sum = 7)?",
      options: ["1/6", "1/12", "1/18", "1/36"],
      correct: 0,
      solution: "6/36 = 1/6",
    },
    {
      question: "P(drawing a heart) from a deck?",
      options: ["1/4", "1/13", "1/52", "1/2"],
      correct: 0,
      solution: "13/52 = 1/4",
    },
    {
      question:
        "P(A∩B) if P(A)=0.6, P(B)=0.4, independent?",
      options: ["0.24", "0.6", "0.4", "1.0"],
      correct: 0,
      solution: "0.6 × 0.4 = 0.24",
    },
  ],

  hard: [
    {
      question:
        "P(Math|Science) if P(Math)=0.6, P(Sci)=0.7, both=0.5?",
      options: ["5/7", "2/3", "3/5", "7/12"],
      correct: 0,
      solution: "0.5/0.7 = 5/7",
    },
    {
      question: "3 coins, P(at least one head)?",
      options: ["1/8", "3/8", "7/8", "1/2"],
      correct: 2,
      solution: "1 - 1/8 = 7/8",
    },
    {
      question:
        "P(A∩B) if P(A)=0.7, P(B)=0.6, P(A∪B)=0.9?",
      options: ["0.3", "0.4", "0.5", "0.6"],
      correct: 1,
      solution: "0.7+0.6-0.9=0.4",
    },
  ],
};

export const assessmentData = [
  {
    id: 1,
    title: "Basic Probability Quiz",
    difficulty: "easy",
    description:
      "Test your understanding of fundamental probability concepts",
    icon: "🎯",
    questions: [
      {
        question: "What is P(Heads) when tossing a fair coin?",
        options: ["0", "1/4", "1/2", "1"],
        correct: 2,
        explanation:
          "A fair coin has 2 equally likely outcomes. P(Heads) = 1/2",
      },
      {
        question: "What is P(rolling a 3) on a fair die?",
        options: ["1/6", "1/3", "1/2", "2/3"],
        correct: 0,
        explanation:
          "There is one favorable outcome out of 6 possible outcomes. P(3) = 1/6",
      },
      {
        question: "A bag has 3 red, 5 blue marbles. P(red)?",
        options: ["3/5", "3/8", "5/8", "1/2"],
        correct: 1,
        explanation: "Total = 8. P(red) = 3/8",
      },
    ],
    status: "pending",
    score: null,
  },

  {
    id: 2,
    title: "Intermediate Probability",
    difficulty: "medium",
    description:
      "Dive deeper into events, independence, and conditional probability",
    icon: "📊",
    questions: [
      {
        question: "Two dice, P(sum = 7)?",
        options: ["1/6", "1/12", "1/18", "1/36"],
        correct: 0,
        explanation: "6/36 = 1/6",
      },
      {
        question: "P(drawing a heart) from a deck?",
        options: ["1/4", "1/13", "1/52", "1/2"],
        correct: 0,
        explanation: "13/52 = 1/4",
      },
      {
        question:
          "If P(A)=0.6, P(B)=0.4, independent, P(A∩B)?",
        options: ["0.24", "0.6", "0.4", "1.0"],
        correct: 0,
        explanation: "0.6 × 0.4 = 0.24",
      },
      {
        question: "P(face card) from a deck?",
        options: ["3/13", "1/13", "4/13", "1/4"],
        correct: 0,
        explanation: "12/52 = 3/13",
      },
      {
        question:
          "P(Math|Science) if P(Math)=0.6, P(Sci)=0.7, both=0.5?",
        options: ["5/7", "2/3", "3/5", "7/12"],
        correct: 0,
        explanation: "0.5/0.7 = 5/7",
      },
    ],
    status: "passed",
    score: 80,
  },

  {
    id: 3,
    title: "Advanced Probability",
    difficulty: "hard",
    description:
      "Master Bayes' theorem, conditional probability, and complex problems",
    icon: "🔥",
    questions: [
      {
        question:
          "P(A|B) if P(A)=0.3, P(B|A)=0.8, P(B|A')=0.2?",
        options: ["0.24", "0.63", "0.38", "0.5"],
        correct: 1,
        explanation:
          "P(B)=0.38. P(A|B)=0.24/0.38≈0.63",
      },
      {
        question:
          "Test accuracy 99%, prevalence 1%. P(Disease|Positive)?",
        options: ["0.99", "0.5", "0.09", "0.01"],
        correct: 1,
        explanation: "P(D|+) = 0.5",
      },
      {
        question: "3 coins, P(at least one head)?",
        options: ["1/8", "3/8", "7/8", "1/2"],
        correct: 2,
        explanation: "1 - 1/8 = 7/8",
      },
      {
        question: "2 cards without replacement, P(both aces)?",
        options: ["1/169", "1/221", "1/52", "1/26"],
        correct: 1,
        explanation: "4/52 × 3/51 = 1/221",
      },
      {
        question:
          "P(A∩B) if P(A)=0.7, P(B)=0.6, P(A∪B)=0.9?",
        options: ["0.3", "0.4", "0.5", "0.6"],
        correct: 1,
        explanation: "0.7+0.6-0.9=0.4",
      },
    ],
    status: "failed",
    score: 40,
  },

  {
    id: 4,
    title: "Bayes' Theorem Quiz",
    difficulty: "hard",
    description:
      "Focus on Bayes' theorem applications and conditional probability",
    icon: "🧮",
    questions: [
      {
        question:
          "P(A|B) if P(A)=0.4, P(B|A)=0.7, P(B|A')=0.3?",
        options: ["0.28", "0.61", "0.38", "0.42"],
        correct: 1,
        explanation:
          "P(B)=0.46. P(A|B)=0.28/0.46≈0.61",
      },
      {
        question:
          "Test: 95% sensitivity, 90% specificity, prevalence 5%. P(Disease|Positive)?",
        options: ["0.95", "0.33", "0.50", "0.05"],
        correct: 1,
        explanation: "0.0475/0.1425 ≈ 0.33",
      },
      {
        question:
          "P(A|B) if P(A)=0.2, P(B|A)=0.9, P(B|A')=0.1?",
        options: ["0.18", "0.69", "0.31", "0.5"],
        correct: 1,
        explanation: "P(B)=0.26. P(A|B)=0.18/0.26≈0.69",
      },
      {
        question:
          "Machine A: 40% products, 2% defects. Machine B: 60%, 5% defects. P(A|Defect)?",
        options: ["0.21", "0.33", "0.40", "0.67"],
        correct: 0,
        explanation: "P(A|D)=0.008/0.038≈0.21",
      },
    ],
    status: "pending",
    score: null,
  },

  {
    id: 5,
    title: "Comprehensive Review",
    difficulty: "medium",
    description:
      "A complete review of all probability topics covered",
    icon: "📚",
    questions: [
      {
        question: "P(rolling an even number) on a die?",
        options: ["1/6", "1/3", "1/2", "2/3"],
        correct: 2,
        explanation: "3/6 = 1/2",
      },
      {
        question: "Bag: 4 red, 5 blue, 6 green. P(blue or green)?",
        options: ["5/15", "6/15", "11/15", "1/2"],
        correct: 2,
        explanation: "11/15",
      },
      {
        question:
          "P(A)=0.4, P(B)=0.6, independent. P(A∪B)?",
        options: ["0.24", "0.76", "0.6", "0.4"],
        correct: 1,
        explanation: "0.4+0.6-0.24=0.76",
      },
      {
        question: "P(king or heart) from a deck?",
        options: ["1/52", "4/13", "17/52", "1/4"],
        correct: 2,
        explanation: "16/52 = 4/13",
      },
      {
        question: "Two dice, P(sum > 9)?",
        options: ["1/6", "1/9", "1/12", "1/18"],
        correct: 0,
        explanation: "6/36 = 1/6",
      },
      {
        question:
          "P(A|B) if P(A∩B)=0.15 and P(B)=0.3?",
        options: ["0.15", "0.3", "0.45", "0.5"],
        correct: 3,
        explanation: "0.15/0.3 = 0.5",
      },
      {
        question: "Two dice, P(sum is 6)?",
        options: ["1/6", "5/36", "1/9", "1/12"],
        correct: 1,
        explanation: "5 ways → 5/36",
      },
      {
        question:
          "P(A)=0.8, P(B)=0.3, P(A∪B)=0.9. P(A∩B)?",
        options: ["0.1", "0.2", "0.3", "0.4"],
        correct: 1,
        explanation: "0.8+0.3-0.9=0.2",
      },
    ],
    status: "in-progress",
    score: 20,
  },
];