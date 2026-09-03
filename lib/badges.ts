export type BadgeDef = {
  key: string;
  label: string;
  description: string;
  emoji: string;
};

export const BADGES: Record<string, BadgeDef> = {
  first_day: {
    key: "first_day",
    label: "First Step",
    description: "Completed your first day",
    emoji: "🌊"
  },
  streak_7: {
    key: "streak_7",
    label: "Seven Strong",
    description: "7 day streak",
    emoji: "🔥"
  },
  day_30: {
    key: "day_30",
    label: "Day 30",
    description: "A third of the way",
    emoji: "⛰️"
  },
  streak_30: {
    key: "streak_30",
    label: "Thirty Days Faithful",
    description: "30 day streak",
    emoji: "👑"
  },
  day_60: {
    key: "day_60",
    label: "Day 60",
    description: "Two thirds of the way",
    emoji: "🌅"
  },
  day_90: {
    key: "day_90",
    label: "Finisher",
    description: "Read the whole Bible",
    emoji: "🏆"
  }
};

export const BADGE_ORDER = ["first_day", "streak_7", "day_30", "streak_30", "day_60", "day_90"];
