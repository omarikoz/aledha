// Server-side scoring helpers and bot mimic generators for "Aledha" (قلدها)

export function getEgyptianTier(score) {
  if (score >= 90) {
    return {
      badge: "Flawless Carbon Copy! 🔥",
      badgeAr: "نسخة طبق الأصل!",
      color: "#10B981",
      reaction: "Bro is a walking foley artist! You matched the Egyptian sound with 100% precision!",
      soundTag: "legendary"
    };
  } else if (score >= 70) {
    return {
      badge: "Absolute Fire! 👌",
      badgeAr: "جامد فشخ!",
      color: "#3B82F6",
      reaction: "Incredible mimicry! You're just a tiny whisper away from the original recording.",
      soundTag: "great"
    };
  } else if (score >= 40) {
    return {
      badge: "Not bad, try again! 😂",
      badgeAr: "مش بطال، بس حاول تاني",
      color: "#F59E0B",
      reaction: "The spirit was there, but your vocal cords took an unexpected detour!",
      soundTag: "okay"
    };
  } else {
    return {
      badge: "What on earth was that?! 💀",
      badgeAr: "إيه ده يا فنان؟! ودني ولعت!",
      color: "#EF4444",
      reaction: "My ears need immediate medical attention! That was more of a noise violation than mimicry!",
      soundTag: "fail"
    };
  }
}

// Generate realistic simulated bot recordings & scores for Solo/Party play
export function generateBotAttempt(bot, soundItem) {
  // Skill variance based on bot personality
  let baseScore = 50;
  if (bot.personality === 'pro') baseScore = 80;
  if (bot.personality === 'funny') baseScore = 35;
  if (bot.personality === 'wild') baseScore = 65;

  const variance = Math.floor(Math.random() * 26) - 10;
  const score = Math.max(15, Math.min(98, baseScore + variance));

  const rhythmScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 16) - 8));
  const pitchScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 16) - 8));
  const energyScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 16) - 8));

  return {
    playerId: bot.id,
    playerName: bot.name,
    avatar: bot.avatar,
    isBot: true,
    score,
    rhythmScore,
    pitchScore,
    energyScore,
    tier: getEgyptianTier(score)
  };
}
