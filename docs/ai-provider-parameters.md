# AI 聊天参数兼容性

核对日期：2026-10-10。适用于 Rote 的 OpenAI-compatible Chat Completions 请求；不涉及 embedding 参数。

产品策略：支持思考的已识别模型默认启用思考；接口支持强度时固定使用 `high`。聊天界面不提供思考开关或强度选择。`high` 在不同厂商间不代表相同 token 预算。

## 请求策略与官方依据

| Provider / 模型 | Rote 发送的参数 | 限制与依据 |
| --- | --- | --- |
| OpenAI：支持强度的 o1/o3/o4-mini、GPT-5/6 系列 | `reasoning_effort: "high"`，省略 `temperature` | 旧 o1-mini/preview、pro 变体和 GPT chat 别名不统一套用。[推理文档](https://developers.openai.com/api/docs/guides/reasoning) |
| 智谱原生 / Coding Plan：GLM-4.5 至 5.3 思考系列 | `thinking: {type: "enabled"}`；GLM-5.2/5.3 加 `reasoning_effort: "high"` | 旧 GLM-4、AirX 不加思考字段；4.5–5.1 不加强度字段。Coding Plan 的接入地址影响协议判断，模型仍须在套餐内可用。[思考能力](https://docs.bigmodel.cn/cn/guide/capabilities/thinking)、[Coding Plan 接入](https://docs.bigmodel.cn/cn/coding-plan/tool/others) |
| DeepSeek 原生：V3.1/V3.2、V4、deepseek-flash | `thinking: {type: "enabled"}`；V4/flash 加 `reasoning_effort: "high"` | `deepseek-chat`、`deepseek-reasoner` 旧别名保留原生默认，避免给旧接口新增字段。[思考模式](https://api-docs.deepseek.com/guides/thinking_mode/) |
| DashScope：支持思考的 Qwen3、当前 qwen-plus/turbo/flash 别名、GLM、DeepSeek、Kimi | `enable_thinking: true`；GLM-5.2/5.3、DeepSeek-V4、Qwen3.8、百炼原生 kimi-k3 加强度 | `qwen-max`、旧日期快照（含仅非思考的 qwen3-max-2025-09-23）、Coder/Instruct 不强制加字段。Kimi 省略采样温度；kimi/kimi-k3 只支持 max，保留默认，不发送 high。启用思考后统一使用流式传输；同步调用在内部收集结果，保持返回接口不变，规避仅支持流式模型的 400。[兼容 API](https://help.aliyun.com/en/model-studio/qwen-api-via-openai-chat-completions)、[深度思考](https://help.aliyun.com/en/model-studio/deep-thinking)、[模型模式](https://help.aliyun.com/zh/model-studio/model-pricing) |
| SiliconFlow：支持思考的 GLM、DeepSeek、Qwen3 | `enable_thinking: true` | 强度仅发给明确列出的 `Pro/zai-org/GLM-5.2`、`Pro/deepseek-ai/DeepSeek-V4*`、`deepseek-ai/DeepSeek-V4-Flash*`；旧 V3/Qwen2.5 保持原参数。[Chat API](https://docs.siliconflow.cn/docs/api/chat-completions-post) |
| OpenRouter：已识别的 OpenAI、GLM、DeepSeek、Qwen、Claude、Gemini、GPT-OSS 思考系列 | `reasoning: {effort: "high"}`，省略 `temperature` | 使用路由层统一协议，不发送原生厂商的 `thinking` / `enable_thinking`。工具调用下一轮保留完整 `reasoning_details`，包括签名与加密块。[Reasoning Tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) |
| Moonshot：Kimi K2.5/K2.6/K2.7 Code、K3 | 省略固定的 `temperature`；K3 加 `reasoning_effort: "high"` | 这些模型默认已开启思考。K2.x 不支持 K3 强度字段；K2.7 Code 的显式 `thinking` 另有约束，因此依赖其默认。旧 moonshot-v1 保持原温度。[参数参考](https://platform.kimi.com/docs/api/models-overview)、[K2.5 官方示例](https://github.com/MoonshotAI/Kimi-K2.5#6-model-usage) |
| Ollama：已识别的本地思考系列，含 GPT-OSS | `reasoning_effort: "high"` | OpenAI 兼容接口支持该字段；GPT-OSS 默认 medium，需要显式 high。不发送 llama.cpp 模板字段。[兼容 API](https://docs.ollama.com/api/openai-compatibility)、[Thinking](https://docs.ollama.com/capabilities/thinking) |
| llama.cpp：已识别的本地思考系列 | `chat_template_kwargs: {enable_thinking: true}`；GPT-OSS 同时传顶层和模板 `reasoning_effort: "high"` | 思考依赖所加载模型的 chat template；GPT-OSS 模板读取强度。不能据此推断任意 GGUF 支持同样控制。[Server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) |
| LM Studio | 保留采样参数与模型/引擎默认思考行为 | 当前 Chat Completions 参考没有承诺上述思考扩展字段，不强行发送，也不承诺强度已设为 high。[Chat Completions](https://lmstudio.ai/docs/developer/openai-compat/chat-completions) |
| Volcengine Ark / Tencent Hunyuan | 当前预设保留原调用参数 | 模型或部署 ID 的能力不同；腾讯原生 API 的 `EnableThinking` 不能直接当作兼容接口字段。暂不跨模型新增字段。[Ark 模型列表](https://docs.volcengine.com/docs/ark/model-list?lang=en)、[Hunyuan 兼容 API](https://cloud.tencent.com/document/product/1729/111007) |

## 协议识别与未知配置

已知官方域名优先于保存的 provider preset，避免用户改了地址却仍发送旧厂商的字段。域名未知时使用所选 preset；自定义代理应选择与其上游协议一致的 preset。本地默认端口分别识别为 Ollama `11434`、LM Studio `1234`、llama.cpp `8080`。浏览器个人配置只有地址与模型，在其他端口或未知代理上保留基础参数。

未知模型不凭名称包含“GLM”“Qwen”等片段猜测原生协议。支持规则集中在 `server/utils/ai/chatParameters.ts` 和 `web/src/utils/chatParameters.ts`；两个独立构建目录保留相同实现并通过参数矩阵验证一致性。新版本或模型应先查对应接口文档再扩展规则。

## 验证范围

个人模型连接检查和工具检查复用实际聊天流式客户端，使用相同的参数、终止条件与错误处理。服务端连接检查与聊天也共用参数生成；DashScope 同步接口使用内部流式收集。

回归测试覆盖官方字段矩阵、旧模型不发送扩展字段、DashScope 流式约束、Kimi 固定采样约束、OpenRouter 签名/加密思考块的工具调用回传，以及已有取消、超时、流终止和 usage 行为。

本次兼容性核对是官方文档与模拟接口契约验证，没有使用每一家厂商的真实凭据逐一在线调用。最终可用性仍受模型权限、套餐、部署版本及浏览器 CORS 限制影响，连接检查会报告实际请求错误；不会在失败后静默降级关闭思考。
