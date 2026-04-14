export const colorMap: Record<string, string> = {
  red: 'text-red-500',
  blue: 'text-blue-500',
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  purple: 'text-purple-500',
  indigo: 'text-indigo-500',
  orange: 'text-orange-500',
  gold: 'text-yellow-400',
  cyan: 'text-cyan-500',
  pink: 'text-pink-500',
  teal: 'text-teal-500',
  lime: 'text-lime-500',
  fuchsia: 'text-fuchsia-500',
  rose: 'text-rose-500',
  sky: 'text-sky-500',
  amber: 'text-amber-500',
  gray: 'text-gray-500',
  white: 'text-white',
  black: 'text-black',
  '红色': 'text-red-500',
  '蓝色': 'text-blue-500',
  '绿色': 'text-green-500',
  '黄色': 'text-yellow-500',
  '紫色': 'text-purple-500',
  '靛蓝色': 'text-indigo-500',
  '橙色': 'text-orange-500',
  '金色': 'text-yellow-400',
  '青色': 'text-cyan-500',
  '粉色': 'text-pink-500',
  '蓝绿色': 'text-teal-500',
  '黄绿色': 'text-lime-500',
  '紫红色': 'text-fuchsia-500',
  '玫瑰色': 'text-rose-500',
  '天蓝色': 'text-sky-500',
  '琥珀色': 'text-amber-500',
  '灰色': 'text-gray-500',
  '白色': 'text-white',
  '黑色': 'text-black'
};

export const animMap: Record<string, string> = {
  wave: 'animate-wave',
  shake: 'animate-shake',
  glitch: 'animate-glitch',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
  spin: 'animate-spin',
  float: 'animate-float',
  flicker: 'animate-flicker',
  glow: 'animate-glow',
  '波浪': 'animate-wave',
  '震动': 'animate-shake',
  '故障': 'animate-glitch',
  '脉冲': 'animate-pulse',
  '弹跳': 'animate-bounce',
  '旋转': 'animate-spin',
  '漂浮': 'animate-float',
  '闪烁': 'animate-flicker',
  '发光': 'animate-glow'
};

export interface StyledTextSegment {
  text: string;
  className?: string;
}

const TAG_PATTERN = /(\[\/?[^\]\r\n]+\]|【\/?[^】\r\n]+】)/g;

const normalizeTag = (rawTag: string) =>
  rawTag
    .replace(/^\[\/?/, '')
    .replace(/^【\/?/, '')
    .replace(/\]$/, '')
    .replace(/】$/, '')
    .trim()
    .toLowerCase();

const isClosingTag = (rawTag: string) => rawTag.startsWith('[/') || rawTag.startsWith('【/');

const getTagClassName = (tagName: string) => {
  const colorClass = colorMap[tagName];
  const animClass = animMap[tagName];

  if (colorClass) {
    return colorClass;
  }

  if (animClass) {
    return `inline-block ${animClass}`;
  }

  return null;
};

const buildClassName = (activeTags: string[]) => {
  const classNames = activeTags
    .map(getTagClassName)
    .filter((value): value is string => Boolean(value));

  return classNames.length > 0 ? Array.from(new Set(classNames)).join(' ') : undefined;
};

export function parseStoryText(text: string): StyledTextSegment[] {
  if (!text) return [];

  const segments: StyledTextSegment[] = [];
  const activeTags: string[] = [];
  let lastIndex = 0;

  const pushText = (value: string) => {
    if (!value) return;

    segments.push({
      text: value,
      className: buildClassName(activeTags)
    });
  };

  for (const match of text.matchAll(TAG_PATTERN)) {
    const rawTag = match[0];
    const matchIndex = match.index ?? 0;
    const tagName = normalizeTag(rawTag);

    pushText(text.slice(lastIndex, matchIndex));

    if (getTagClassName(tagName)) {
      if (isClosingTag(rawTag)) {
        const lastTagIndex = activeTags.lastIndexOf(tagName);
        if (lastTagIndex >= 0) {
          activeTags.splice(lastTagIndex, 1);
        }
      } else {
        activeTags.push(tagName);
      }
    } else {
      pushText(rawTag);
    }

    lastIndex = matchIndex + rawTag.length;
  }

  pushText(text.slice(lastIndex));

  return segments;
}
