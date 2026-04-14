import { CharacterStats } from '../types';

export const evaluateAction = (action: string, stats: CharacterStats, tension: number = 10): { rollMessage: string, actionType: 'combat' | 'dialogue' | 'travel' | 'other' } => {
  // Simple keyword matching to determine action type and relevant stat
  const actionLower = action.toLowerCase();
  
  let targetStat = 'luck';
  let statValue = stats.attributes?.luck ?? 10;
  let actionType: 'combat' | 'dialogue' | 'travel' | 'other' = 'other';

  if (actionLower.match(/attack|hit|strike|kill|fight|smash|slash|shoot|punch|kick|砍|杀|攻击|打|揍|刺|射击|战斗|摧毁|破坏/)) {
    targetStat = 'strength';
    statValue = stats.attributes?.strength ?? 10;
    actionType = 'combat';
  } else if (actionLower.match(/dodge|run|jump|sneak|hide|steal|escape|climb|swim|跑|躲|闪避|跳|潜行|偷|逃|爬|游泳|翻越/)) {
    targetStat = 'agility';
    statValue = stats.attributes?.agility ?? 10;
    actionType = 'travel';
  } else if (actionLower.match(/read|study|investigate|search|cast|magic|examine|analyze|decode|读|研究|调查|寻找|施法|魔法|检查|分析|解密|观察/)) {
    targetStat = 'intelligence';
    statValue = stats.attributes?.intelligence ?? 10;
    actionType = 'other';
  } else if (actionLower.match(/talk|persuade|intimidate|charm|lie|negotiate|bribe|threaten|说|劝说|恐吓|魅惑|撒谎|谈判|贿赂|威胁|交涉/)) {
    targetStat = 'charisma';
    statValue = stats.attributes?.charisma ?? 10;
    actionType = 'dialogue';
  } else if (actionLower.match(/go|travel|walk|move|explore|journey|走|前往|移动|探索|旅行/)) {
    actionType = 'travel';
  }

  // If it's just a simple movement or dialogue without clear check needed, maybe skip roll?
  // But let's roll anyway if it matches a stat, or just default to luck.
  
  const d20 = Math.floor(Math.random() * 20) + 1;
  // Modifier: (stat - 10) / 2, rounded down
  const modifier = Math.floor((statValue - 10) / 2);
  const total = d20 + modifier;

  const difficulty = 10 + Math.floor(tension / 20); // Base 10, up to 15 at max tension

  let resultText = '';
  if (d20 === 20) {
    resultText = '大成功 (Critical Success)';
  } else if (d20 === 1) {
    resultText = '大失败 (Critical Failure)';
  } else if (total >= difficulty + 5) {
    resultText = '成功 (Success)';
  } else if (total >= difficulty) {
    resultText = '勉强成功 (Mixed Success)';
  } else {
    resultText = '失败 (Failure)';
  }

  const statNameMap: Record<string, string> = {
    strength: '力量',
    agility: '敏捷',
    intelligence: '智力',
    charisma: '魅力',
    luck: '幸运'
  };

  const rollMessage = `[系统检定：${statNameMap[targetStat]} D20=${d20} 修正=${modifier > 0 ? '+'+modifier : modifier} 总计=${total} 难度=${difficulty} -> ${resultText}]`;

  return {
    rollMessage,
    actionType
  };
};

export const calculateTension = (currentTension: number, actionType: string, isCombat: boolean, isMajorEvent: boolean): number => {
  let newTension = currentTension;

  if (isCombat) {
    // Combat increases tension significantly, but less so if it's already very high
    newTension += Math.max(10, 30 - (currentTension * 0.2));
  } else if (isMajorEvent) {
    // Major events cause a huge spike
    newTension += 40;
  } else if (actionType === 'dialogue') {
    // Dialogue slowly relieves tension
    newTension -= 8;
  } else if (actionType === 'travel') {
    // Travel slightly relieves tension
    newTension -= 4;
  } else {
    // Other actions have a minor effect
    newTension -= 2;
  }

  // Natural decay over time if no major events or combat
  if (!isCombat && !isMajorEvent) {
    // Faster decay if tension is very high
    const decay = currentTension > 70 ? 5 : 2;
    newTension -= decay;
  }

  return Math.max(0, Math.min(100, Math.floor(newTension)));
};
