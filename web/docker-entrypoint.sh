#!/bin/sh
# Docker 容器启动脚本
# 在容器启动时注入环境变量到 HTML 文件中

# 默认值
VITE_API_BASE="${VITE_API_BASE:-http://localhost:3000}"

# 替换 HTML 中的占位符（配置注入失败不应阻止容器启动）
if [ -f /app/dist/index.html ]; then
  # 转义 sed 替换字符串中的特殊字符（& 和 \）
  # 使用 | 作为分隔符避免与 URL 中的 / 冲突
  # 先转义 \，再转义 &
  ESCAPED_API_BASE=$(echo "${VITE_API_BASE}" | sed 's/\\/\\\\/g; s/&/\\&/g' 2>/dev/null || echo "${VITE_API_BASE}")
  
  # 转义 JSON 字符串中的特殊字符（用于 JavaScript 代码）
  JSON_ESCAPED_API_BASE=$(echo "${VITE_API_BASE}" | sed 's/\\/\\\\/g; s/"/\\"/g' 2>/dev/null || echo "${VITE_API_BASE}")
  
  # 首先尝试替换占位符（如果存在）
  if grep -q "__VITE_API_BASE_PLACEHOLDER__" /app/dist/index.html 2>/dev/null; then
    # 使用 sed 替换占位符（Alpine/busybox 兼容）
    if sed -i "s|__VITE_API_BASE_PLACEHOLDER__|${ESCAPED_API_BASE}|g" /app/dist/index.html 2>/dev/null; then
      echo "✓ 已注入 VITE_API_BASE: ${VITE_API_BASE}"
    elif sed "s|__VITE_API_BASE_PLACEHOLDER__|${ESCAPED_API_BASE}|g" /app/dist/index.html > /tmp/index.html.tmp 2>/dev/null && \
         mv /tmp/index.html.tmp /app/dist/index.html 2>/dev/null; then
      echo "✓ 已注入 VITE_API_BASE: ${VITE_API_BASE}"
    else
      echo "⚠ 警告: 占位符替换失败，尝试插入配置脚本"
      # 如果替换失败，尝试在 </head> 前插入配置脚本
      CONFIG_SCRIPT="<script>window.__ROTE_CONFIG__=window.__ROTE_CONFIG__||{};window.__ROTE_CONFIG__.VITE_API_BASE=\"${JSON_ESCAPED_API_BASE}\";</script>"
      if sed -i "s|</head>|${CONFIG_SCRIPT}</head>|" /app/dist/index.html 2>/dev/null || \
         sed "s|</head>|${CONFIG_SCRIPT}</head>|" /app/dist/index.html > /tmp/index.html.tmp 2>/dev/null && \
         mv /tmp/index.html.tmp /app/dist/index.html 2>/dev/null; then
        echo "✓ 已插入配置脚本，VITE_API_BASE: ${VITE_API_BASE}"
      else
        echo "⚠ 警告: 配置注入失败，将使用构建时配置或默认值"
      fi
    fi
  else
    # 如果占位符不存在，检查是否已有配置脚本
    if grep -q "__ROTE_CONFIG__" /app/dist/index.html 2>/dev/null; then
      # 如果已有配置脚本，尝试更新它
      if sed -i "s|\"VITE_API_BASE\":\"[^\"]*\"|\"VITE_API_BASE\":\"${JSON_ESCAPED_API_BASE}\"|g" /app/dist/index.html 2>/dev/null || \
         sed "s|\"VITE_API_BASE\":\"[^\"]*\"|\"VITE_API_BASE\":\"${JSON_ESCAPED_API_BASE}\"|g" /app/dist/index.html > /tmp/index.html.tmp 2>/dev/null && \
         mv /tmp/index.html.tmp /app/dist/index.html 2>/dev/null; then
        echo "✓ 已更新配置脚本，VITE_API_BASE: ${VITE_API_BASE}"
      else
        echo "⚠ 警告: 配置脚本更新失败，将使用构建时配置或默认值"
      fi
    else
      # 如果既没有占位符也没有配置脚本，在 </head> 前插入配置脚本
      CONFIG_SCRIPT="<script>window.__ROTE_CONFIG__=window.__ROTE_CONFIG__||{};window.__ROTE_CONFIG__.VITE_API_BASE=\"${JSON_ESCAPED_API_BASE}\";</script>"
      if sed -i "s|</head>|${CONFIG_SCRIPT}</head>|" /app/dist/index.html 2>/dev/null || \
         sed "s|</head>|${CONFIG_SCRIPT}</head>|" /app/dist/index.html > /tmp/index.html.tmp 2>/dev/null && \
         mv /tmp/index.html.tmp /app/dist/index.html 2>/dev/null; then
        echo "✓ 已插入配置脚本，VITE_API_BASE: ${VITE_API_BASE}"
      else
        echo "⚠ 警告: 配置注入失败，将使用构建时配置或默认值"
      fi
    fi
  fi
else
  echo "⚠ 警告: /app/dist/index.html 不存在，跳过配置注入"
fi

# 执行原始命令（使用 set -e 确保命令失败时容器退出）
set -e
exec "$@"

