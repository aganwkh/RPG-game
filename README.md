# Chronicles RPG

一个基于 React + Vite + Gemini API 的文字 RPG 原型。玩家通过自然语言选择推进剧情，系统会同步维护角色属性、任务、NPC 关系、世界书和导演状态。

## 功能概览

- AI 生成连续剧情与可选行动
- 从剧情中抽取状态变化并更新角色/任务/背包
- 使用世界书摘要和导演状态辅助后续生成
- 本地存档、导入导出、技能冷却与日志查看

## 本地运行

### 环境要求

- Node.js 20+

### 配置环境变量

1. 复制 `.env.example` 为 `.env.local`
2. 填入你的 Gemini API Key：

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

### 启动开发环境

```bash
npm install
npm run dev
```

默认开发地址为 [http://localhost:3000](http://localhost:3000)。

## 可用脚本

- `npm run dev`: 启动本地开发服务器
- `npm run build`: 构建生产包
- `npm run preview`: 预览生产构建
- `npm run lint`: 运行 TypeScript 类型检查

## 项目结构

- `src/components`: 游戏界面、侧栏、日志和世界书弹窗
- `src/services`: AI 调用、状态抽取、reducer 和后台任务队列
- `src/store`: Zustand 游戏状态存储
- `src/utils`: 轻量文本格式解析

## 注意事项

- 未配置 `VITE_GEMINI_API_KEY` 时，游戏无法向模型发起请求
- 当前生产构建仍有较大的主包体积告警，但不影响运行
