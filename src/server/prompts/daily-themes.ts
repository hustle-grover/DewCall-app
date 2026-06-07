import { getSeniorLocalDay } from '../utils/timezone';

export interface Theme {
  name: string;
  opener: string;
  backup: string;
  skipIfMemoryFlag?: string;
}

export const DAILY_THEMES: Record<string, Theme> = {
  monday: {
    name: "Week Ahead",
    opener: "So it's a new week — is there anything you're looking forward to?",
    backup: "Do you have anything nice planned, or is it a quiet week?"
  },
  tuesday: {
    name: "Something Good",
    opener: "Tell me something good that's happened recently — even something small.",
    backup: "What's been a highlight for you lately?"
  },
  wednesday: {
    name: "Right Now",
    opener: "What's going on in your world at the moment?",
    backup: "What does a typical day look like for you right now?"
  },
  thursday: {
    name: "A Story",
    opener: "I'd love to hear a story today — anything from your life that's been on your mind?",
    backup: "What's a place you've lived that you think about sometimes?",
    skipIfMemoryFlag: "CAUTION"
  },
  friday: {
    name: "Family & Weekend",
    opener: "It's Friday! Is anyone visiting this weekend, or do you have plans?",
    backup: "What does your weekend usually look like?"
  },
  saturday: {
    name: "Hobbies",
    opener: "What have you been enjoying lately — any good TV, books, or time outside?",
    backup: "What's something you've been doing just for yourself lately?"
  },
  sunday: {
    name: "Reflection",
    opener: "Sunday feels like a good day to slow down. What's on your mind today?",
    backup: "Is there something you feel grateful for this week?"
  }
};

// Thursday + CAUTION memory flag → use Wednesday's theme (avoids memory-recall pressure)
export function getTodayTheme(timezone: string, memoryFlag: string): Theme {
  const day = getSeniorLocalDay(new Date(), timezone);
  const theme = DAILY_THEMES[day];

  if (day === 'thursday' && memoryFlag === 'CAUTION') {
    return DAILY_THEMES['wednesday'];
  }

  return theme;
}
