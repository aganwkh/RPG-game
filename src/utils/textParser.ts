export const colorMap: Record<string, string> = {
  red: 'text-red-500', '红色': 'text-red-500',
  blue: 'text-blue-500', '蓝色': 'text-blue-500',
  green: 'text-green-500', '绿色': 'text-green-500',
  yellow: 'text-yellow-500', '黄色': 'text-yellow-500',
  purple: 'text-purple-500', '紫色': 'text-purple-500',
  indigo: 'text-indigo-500', '靛蓝色': 'text-indigo-500',
  orange: 'text-orange-500', '橙色': 'text-orange-500',
  gold: 'text-yellow-400', '金色': 'text-yellow-400',
  cyan: 'text-cyan-500', '青色': 'text-cyan-500',
  pink: 'text-pink-500', '粉色': 'text-pink-500',
  teal: 'text-teal-500', '青蓝色': 'text-teal-500',
  lime: 'text-lime-500', '黄绿色': 'text-lime-500',
  fuchsia: 'text-fuchsia-500', '紫红色': 'text-fuchsia-500',
  rose: 'text-rose-500', '玫瑰色': 'text-rose-500',
  sky: 'text-sky-500', '天蓝色': 'text-sky-500',
  amber: 'text-amber-500', '琥珀色': 'text-amber-500',
  gray: 'text-gray-500', '灰色': 'text-gray-500',
  white: 'text-white', '白色': 'text-white',
  black: 'text-black', '黑色': 'text-black',
};

export const animMap: Record<string, string> = {
  wave: 'animate-wave', '波浪': 'animate-wave',
  shake: 'animate-shake', '震动': 'animate-shake',
  glitch: 'animate-glitch', '故障': 'animate-glitch',
  pulse: 'animate-pulse', '脉冲': 'animate-pulse',
  bounce: 'animate-bounce', '弹跳': 'animate-bounce',
  spin: 'animate-spin', '旋转': 'animate-spin',
  float: 'animate-float', '漂浮': 'animate-float',
  flicker: 'animate-flicker', '闪烁': 'animate-flicker',
  glow: 'animate-glow', '发光': 'animate-glow',
};

export function parseStoryText(text: string): string {
  if (!text) return '';
  
  let parsed = text;
  const openTags = new Set<string>();
  
  // Match both opening and closing tags in one pass
  parsed = parsed.replace(/(\\?)(?:\[|【)(\/?)([\w\u4e00-\u9fa5\s]+)(?:\]|】)/g, (match, escape, slash, tag) => {
    if (escape) return match; // Skip escaped tags
    
    const lowerTag = tag.trim().toLowerCase();
    const colorClass = colorMap[lowerTag];
    const animClass = animMap[lowerTag];
    
    if (colorClass || animClass) {
      if (slash === '/') {
        // Explicit closing tag
        openTags.delete(lowerTag);
        return `</span>`;
      } else {
        if (openTags.has(lowerTag)) {
          // Tag is already open, treat this as a closing tag
          openTags.delete(lowerTag);
          return `</span>`;
        } else {
          // Open the tag
          openTags.add(lowerTag);
          if (colorClass) {
            return `<span class="${colorClass}">`;
          } else {
            return `<span class="inline-block ${animClass}">`;
          }
        }
      }
    }
    
    return match;
  });
  
  // Close any remaining open tags
  openTags.forEach(() => {
    parsed += `</span>`;
  });
  
  return parsed;
}
