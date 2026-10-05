// Server-side scoring helpers and bot mimic generators for "Aledha" (قلدها)

export function getEgyptianTier(score) {
  if (score >= 90) {
    return {
      badge: "عالمي! جابها في الجون 🔥",
      badgeEn: "World-Class! Hit the Target! 🔥",
      color: "#10B981", // Emerald
      reaction: "عالمي! جابها في الجون بالمللي أداء محترفين 🔥",
      soundTag: "legendary"
    };
  } else if (score >= 75) {
    return {
      badge: "رايق أوي! قريب فشخ 👌",
      badgeEn: "Super Smooth! Incredibly Close! 👌",
      color: "#3B82F6", // Blue
      reaction: "رايق أوي! قريب فشخ من الصوت الأصلي 👌",
      soundTag: "great"
    };
  } else if (score >= 50) {
    return {
      badge: "مش بطال، سامع المحاولة 👏",
      badgeEn: "Not Bad, We Hear The Effort! 👏",
      color: "#F59E0B", // Amber
      reaction: "مش بطال، سامع المحاولة والروح كانت عالية 👏",
      soundTag: "okay"
    };
  } else if (score >= 25) {
    return {
      badge: "محتاجة شوية تظبيط بس ضحكتنا 😂",
      badgeEn: "Needs A Little Tuning, But Great Laughs! 😂",
      color: "#FB923C", // Orange
      reaction: "محتاجة شوية تظبيط بس ضحكتنا وملت الجو بهجة 😂",
      soundTag: "funny"
    };
  } else {
    return {
      badge: "المهم المشاركة والروح الرياضية! 🤝",
      badgeEn: "Good Sportsmanship! 🤝",
      color: "#64748B", // Slate
      reaction: "المهم المشاركة والروح الرياضية والضحكة الحلوة! 🤝",
      soundTag: "sportsmanship"
    };
  }
}

// Generate realistic simulated bot recordings & scores for Solo/Party play
export function generateBotAttempt(bot, soundItem) {
  let baseScore = 50;
  if (bot.personality === 'pro') baseScore = 80;
  if (bot.personality === 'funny') baseScore = 40;
  if (bot.personality === 'wild') baseScore = 65;

  const variance = Math.floor(Math.random() * 21) - 10;
  const score = Math.max(15, Math.min(96, baseScore + variance));

  const rhythmScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 12) - 6));
  const pitchScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 12) - 6));
  const energyScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 12) - 6));

  return {
    playerId: bot.id,
    playerName: bot.name,
    avatar: bot.avatar,
    isBot: true,
    isAI: true,
    score,
    rhythmScore,
    pitchScore,
    energyScore,
    tier: getEgyptianTier(score)
  };
}
