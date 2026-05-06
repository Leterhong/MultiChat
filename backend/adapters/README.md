# LLM Provider Adapters

适配器模式实现，支持国内外主流大模型原生接口。

## 架构

```
adapters/
├── base.js           # 基础适配器接口
├── openai.js         # OpenAI 兼容适配器
├── zhipu.js          # 智谱 GLM 适配器
├── moonshot.js       # 月之暗面 Kimi 适配器
├── qwen.js           # 阿里通义千问适配器
├── wenxin.js         # 百度文心一言适配器
└── index.js          # 适配器工厂
```

## 支持的厂商

### 1. OpenAI 兼容 (openai)
- 适用于所有 OpenAI 兼容接口
- 需要配置: Base URL, API Key

### 2. 智谱 GLM (zhipu)
- 原生智谱 API 支持
- 自动处理 JWT Token 生成
- API Key 格式: `apiKey.secret`
- 默认端点: `https://open.bigmodel.cn/api/paas/v4/chat/completions`

### 3. 月之暗面 Kimi (moonshot)
- 原生 Kimi API 支持
- 支持超长上下文
- 默认端点: `https://api.moonshot.cn/v1/chat/completions`

### 4. 阿里通义千问 (qwen)
- DashScope 协议支持
- 自动处理消息格式转换
- 默认端点: `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`

### 5. 百度文心一言 (wenxin)
- 自动处理 OAuth 2.0 认证
- API Key 格式: `apiKey:secretKey`
- 支持 ERNIE 系列模型

## 添加新适配器

1. 创建新的适配器类继承 `BaseAdapter`
2. 实现必需的方法:
   - `transformMessages()` - 转换消息格式
   - `buildRequestBody()` - 构建请求体
   - `getHeaders()` - 获取请求头
   - `getEndpoint()` - 获取 API 端点
   - `transformSSEChunk()` - 转换流式响应
   - `transformResponse()` - 转换非流式响应
3. 可选实现 `prepare()` - 预处理（如获取 access token）
4. 在 `index.js` 中注册新适配器

## 示例

```javascript
const { createAdapter } = require('./adapters');

// 创建智谱适配器
const adapter = createAdapter({
  apiType: 'zhipu',
  apiKey: 'your-api-key.your-secret',
  model: 'glm-4'
});

// 准备请求
await adapter.prepare();

// 构建请求
const endpoint = adapter.getEndpoint();
const headers = adapter.getHeaders();
const body = adapter.buildRequestBody('glm-4', messages, true);
```
