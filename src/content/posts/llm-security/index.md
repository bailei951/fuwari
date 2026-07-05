---
title: "LLM 基础设施安全：从 OWASP Top 10 到 CVE 漏洞实战"
published: 2025-05-02
updated: 2025-05-02
description: "系统梳理 LLM 基础设施安全学习的三个阶段：Web/API 安全基础、CVE 漏洞复现（Ollama & OpenWebUI）、容器与模型安全加固，附带完整工具链与实战路径。"
image: "./cover.jpg"
tags: ["LLM Security", "OWASP", "CVE", "Ollama", "OpenWebUI", "Cybersecurity"]
category: "Security"
draft: false
---

## 背景

随着 LLM 基础设施（Ollama、OpenWebUI、vLLM 等）的快速部署，安全问题日益突出。这些系统通常直接暴露 API 端点、运行在容器中、处理敏感数据，一旦存在漏洞，攻击者可能实现**远程代码执行（RCE）**、**未授权数据访问**甚至**模型篡改**。

本文是我在实际部署 DeepSeek 推理服务过程中梳理的安全学习路径，分为三个阶段：基础理论 → 漏洞实战 → 高级加固。

---

## 第一阶段：Web 与 API 安全基础

### OWASP Top 10 — Web 安全的基石

在深入 LLM 专项安全之前，必须掌握 Web 应用安全的通用知识体系。OWASP Top 10 是最权威的 Web 安全风险清单，核心条目包括：

| 漏洞类型 | 描述 | 在 LLM 场景中的风险 |
|----------|------|-------------------|
| **SQL 注入** | 恶意 SQL 语句注入数据库查询 | LLM 应用的用户输入可能被拼接到查询 |
| **XSS（跨站脚本）** | 注入恶意脚本到网页 | OpenWebUI 等前端界面的输入框 |
| **CSRF（跨站请求伪造）** | 诱导用户执行非本意操作 | API 调用缺乏 Token 验证 |
| **IDOR（不安全的直接对象引用）** | 通过修改 ID 访问他人资源 | 这正是 CVE-2024-7041 的原理 |
| **路径遍历** | `../../etc/passwd` 访问系统文件 | CVE-2024-37032 的核心漏洞 |
| **命令注入** | 注入系统命令到服务器 | Ollama 的 API 参数可能被注入 |
| **不安全的反序列化** | 恶意对象注入内存 | 模型文件加载过程的潜在风险 |

### API 安全基础

LLM 推理服务几乎全部通过 RESTful API 暴露能力，API 安全三要素：

1. **身份验证（Authentication）**：你是谁？→ API Key / JWT / OAuth
2. **授权（Authorization）**：你能做什么？→ RBAC / Scope 限制
3. **速率限制（Rate Limiting）**：你能调用多少次？→ 防止滥用和 DoS

OpenWebUI 默认情况下可以通过环境变量 `WEBUI_AUTH=False` 禁用身份验证，这在个人使用场景方便，但暴露到公网时极其危险。

---

## 第二阶段：漏洞发现与复现

### CVE-2024-37032 — Ollama 路径遍历 RCE

**漏洞概述**：Ollama 的 API 端点存在路径遍历漏洞，攻击者可以读取服务器上的任意文件，进而在特定条件下实现远程代码执行。

**影响版本**：Ollama < 0.1.34

**攻击原理**：

```
GET /api/show HTTP/1.1
Host: target:11434
Content-Type: application/json

{
  "name": "../../../../etc/passwd"
}
```

Ollama 的模型加载逻辑未对模型名称中的路径分隔符做充分校验，导致攻击者可以遍历到系统敏感文件。

**修复措施**：
- 升级到 Ollama ≥ 0.1.34
- 不要将 Ollama 绑定到 `0.0.0.0`（监听所有接口），改为 `127.0.0.1`
- 在前端使用 Nginx 反向代理，增加路径规范化层

### CVE-2024-7041 — OpenWebUI IDOR 漏洞

**漏洞概述**：OpenWebUI 的某些 API 端点未正确校验用户身份，攻击者可以通过枚举 ID 访问其他用户的聊天记录、模型配置等敏感数据（典型的 IDOR 漏洞）。

**攻击原理**：

```http
GET /api/v1/chats/1001 HTTP/1.1
Host: target:8080
Authorization: Bearer <attacker_token>
```

即使 `chat_id=1001` 不属于当前用户，缺乏权限校验的端点仍会返回该聊天的完整内容——包括对话历史、Prompt 甚至 API Key。

**修复措施**：
- 每个 API 端点必须校验 `owner_id == current_user.id`
- 实现中间件级别的全局权限拦截
- 对敏感操作添加审计日志

### 漏洞复现环境搭建

```bash
# 拉取有漏洞的版本
docker pull ollama/ollama:0.1.33

# 在隔离网络中运行
docker run -d --name vuln-ollama \
  --network isolated \
  -p 11434:11434 \
  ollama/ollama:0.1.33

# 使用 OWASP ZAP 扫描
zap-cli quick-scan http://localhost:11434
```

---

## 第三阶段：高级漏洞利用与防御

### 容器安全

LLM 推理服务几乎全部依赖 Docker 部署，容器安全是最后一道防线：

| 风险 | 说明 | 缓解措施 |
|------|------|----------|
| **以 root 运行** | 默认容器内为 root 用户 | `USER 1000:1000` 切换为非 root |
| **特权模式** | `--privileged` 授予所有能力 | 从不使用，按需 `--cap-add` |
| **挂载敏感路径** | `-v /var/run/docker.sock:...` | 禁止挂载 Docker Socket |
| **未限制资源** | 无 CPU/内存限制导致 DoS | `--cpus=4 --memory=16g` |

```dockerfile
# 安全加固的 Ollama 部署
FROM ollama/ollama:latest
RUN useradd -m -u 1000 ollama && \
    chown -R ollama:ollama /home/ollama
USER ollama
```

### 模型完整性保护

模型文件的完整性直接决定推理结果的可信度：

- **文件哈希校验**：下载模型后计算 SHA256，与官方发布值比对
- **签名验证**：使用 GPG 签名确保模型来源可信（HuggingFace 已支持）
- **只读挂载**：模型目录以 `:ro` 挂载，防止推理服务篡改模型权重

```bash
# 验证模型完整性
sha256sum deepseek-r1-q4_k_m.gguf
# 对比官方发布的 checksum
echo "expected_hash deepseek-r1-q4_k_m.gguf" | sha256sum -c
```

### 网络隔离架构

推荐的 LLM 服务部署拓扑：

```
Internet
  │
  ▼
┌──────────────┐
│  Nginx (TLS) │  ← 反向代理 + WAF 规则
│  :443        │
└──────┬───────┘
       │
  ┌────▼────────────────────┐
  │  OpenWebUI (内网)       │  ← 仅暴露前端
  │  http://127.0.0.1:8080  │
  └────┬────────────────────┘
       │
  ┌────▼────────────────┐
  │  API Gateway        │  ← 鉴权 + 限流
  │  (Auth + Rate Limit)│
  └────┬────────────────┘
       │
  ┌────▼────────────┐
  │  Ollama / vLLM  │  ← 仅监听 127.0.0.1
  │  127.0.0.1:11434│
  └─────────────────┘
```

**关键原则**：
- API 推理服务**永远不直接暴露到公网**
- 每一层都有独立的鉴权
- 所有通信走 TLS

---

## 安全工具链

| 工具 | 类型 | 用途 | 适用阶段 |
|------|------|------|:---:|
| **OWASP ZAP** | DAST 扫描器 | 自动扫描 Web 漏洞 | 阶段一、二 |
| **Burp Suite Community** | 拦截代理 | 手动构造/重放 HTTP 请求 | 阶段二 |
| **Postman** | API 测试 | 探索 API 端点，编写自动化测试 | 阶段一、二 |
| **Nikto** | Web 服务器扫描 | 快速检查 6700+ 已知风险 | 阶段二 |
| **Nmap** | 网络扫描 | 识别开放端口和运行服务 | 阶段二 |
| **Docker Bench Security** | 容器审计 | 检查 Docker 配置合规性 | 阶段三 |

### 快速安全评估脚本

```bash
#!/bin/bash
# LLM 基础设施快速安全检查

TARGET="localhost"

echo "=== 端口扫描 ==="
nmap -p 11434,8080,3000,443,80 $TARGET

echo "=== HTTP 头检查 ==="
curl -sI http://$TARGET:11434 | head -20

echo "=== OpenWebUI 认证检查 ==="
curl -s http://$TARGET:8080/api/v1/chats \
  -H "Authorization: Bearer invalid_token" \
  | grep -q "Unauthorized" && echo "✅ 需要认证" || echo "❌ 认证可能被绕过"

echo "=== Docker 安全审计 ==="
docker run --rm -it \
  --net host --pid host --userns host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  docker/docker-bench-security | grep -E "WARN|CRITICAL"
```

---

## 学习路径总结

```
阶段一：基础理论（2-3 周）
├── OWASP Top 10 理解与练习
├── API 安全基础（AuthN / AuthZ / Rate Limit）
└── 工具熟悉（ZAP / Postman / Burp Suite）

阶段二：漏洞实战（2-3 周）
├── CVE-2024-37032 环境搭建与复现
├── CVE-2024-7041 手动漏洞利用
└── OWASP ZAP 自动化扫描

阶段三：高级加固（1-2 周）
├── Docker 容器安全配置
├── 模型完整性验证
├── 网络隔离架构设计
└── WAF 规则编写
```

---

## 总结

LLM 基础设施安全本质上仍是经典 Web 安全 + 容器安全的延伸，真正的风险往往来自**部署便利性对安全性的妥协**——为了快速启动而绑定 `0.0.0.0`、关闭认证、以 root 运行容器。安全加固的每一点都是对便利性的取舍，但在生产环境中，这个取舍不容妥协。

> 安全不是产品，而是过程。一次扫描通过不代表永远安全，持续监控和定期审计才是真正的防线。
