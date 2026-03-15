import { CharacterStats } from "../types";

export function evaluateAction(action: string, stats: CharacterStats): string | null {
  const lowerAction = action.toLowerCase();
  let statToUse: keyof CharacterStats | null = null;
  let statName = "";

  if (lowerAction.match(/attack|hit|smash|push|lift|break|strike|kill|fight/)) {
    statToUse = "str";
    statName = "力量";
  } else if (lowerAction.match(/dodge|sneak|run|jump|hide|steal|escape|climb/)) {
    statToUse = "dex";
    statName = "敏捷";
  } else if (lowerAction.match(/inspect|read|think|remember|search|cast|examine/)) {
    statToUse = "int";
    statName = "智力";
  } else if (lowerAction.match(/talk|persuade|intimidate|lie|charm|ask|greet/)) {
    statToUse = "cha";
    statName = "魅力";
  }

  if (!statToUse) return null;

  const roll = Math.floor(Math.random() * 20) + 1;
  const modifier = Math.floor((stats[statToUse] - 10) / 2);
  const total = roll + modifier;

  let result = "";
  if (roll === 20) result = "大成功";
  else if (roll === 1) result = "大失败";
  else if (total >= 15) result = "成功";
  else if (total >= 10) result = "勉强成功";
  else result = "失败";

  return `[系统检定：${statName} (D20: ${roll} + 修正: ${modifier} = ${total}) -> ${result}]`;
}

export function calculateTension(current: number, eventType: "combat" | "dialogue" | "exploration" | "plot_twist" | "idle"): number {
  let newTension = current;
  switch (eventType) {
    case "combat":
      newTension += 20;
      break;
    case "plot_twist":
      newTension += 30;
      break;
    case "exploration":
      newTension += 5;
      break;
    case "dialogue":
      newTension -= 5;
      break;
    case "idle":
      newTension -= 10;
      break;
  }
  return Math.max(0, Math.min(100, newTension));
}
