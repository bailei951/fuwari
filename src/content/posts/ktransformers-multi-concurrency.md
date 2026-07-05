---
title: "KTransformers 多并发架构深度分析：与 vLLM / SGLang 的对比"
published: 2025-05-15
updated: 2025-05-15
description: "深入剖析 KTransformers v0.2.4 多并发架构的三层设计，分析 Prefill 并行度瓶颈与 KV Cache 管理问题，并与 vLLM、SGLang 进行全面对比。"
image: ""
tags: ["KTransformers", "LLM Inference", "vLLM", "SGLang", "DeepSeek", "HPC"]
category: "LLM Inference"
draft: false
---

## 背景

在大模型推理场景中，多并发能力直接决定了线上服务的吞吐上限。KTransformers 作为 DeepSeek 模型的开源推理框架，在 v0.2.4 版本引入了多并发支持。本文基于对 KTransformers 源码的深入分析，将其与 vLLM 和 SGLang 进行全面对比，找出瓶颈与优化方向。

---

## KTransformers 的三层架构

KTransformers v0.2.4 的多并发架构分为三层：

| 层次 | 职责 | 技术实现 |
|------|------|----------|
| **Server（服务层）** | 接收请求，提供 OpenAI 兼容 RESTful 接口 | HTTP API |
| **Scheduler（调度层）** | C++ 实现的 FCFS 批次调度器，支持 continuous batching | C++ / FlashInfer |
| **Inference Engine（推理引擎）** | 执行模型前向推理，chunked prefill | FlashInfer CUDA Kernels |

关键配置参数：

- `--chunk_size`：单次引擎调用处理的最大 token 数
- `--max_batch_size`：单次引擎运行同时处理的最大请求数（仅 `balance_serve` 模式）
- `--cache_lens`：全局 KVCache 空间大小，**所有请求共享**

---

## 核心瓶颈：Prefill 阶段并行度受限

社区实测反馈揭示了一个关键瓶颈：**KTransformers 当前最多同时并发 2 个请求执行 Prefill**。

这意味着 4 路并发时，只有两条请求的上下文同时加载到 KVCache，其余请求须排队等待。结果：
- 前两条请求较快获得解码结果
- 后两条请求首包延迟显著增加
- GPU 计算资源未被充分利用

作者在 Issue 回复中确认："prefill 阶段并发数限制为最多 2 个……`max_batch_size` 只影响 decode 阶段，并不影响 prefill"。

相比之下，vLLM 默认开启 Chunked Prefill，优先安排解码请求，再将剩余算力用于新前缀填充；SGLang 的零开销调度器则能实现 CPU/GPU 异步重叠。

---

## KV Cache 管理对比

| 特性 | KTransformers | vLLM | SGLang |
|------|-------------|------|--------|
| **管理方式** | 全局共享 KVCache，固定大小 | PagedAttention 分块管理 | RadixAttention 前缀树 |
| **前缀重用** | **不支持** | 块级缓存重用 | Token 级别前缀复用 |
| **内存效率** | 请求完成后才释放，易产生碎片 | 按需分配/释放 | 前缀共享，内存高效 |

KTransformers 的全局共享 KVCache 设计简洁，但缺少前缀重用机制使得多用户场景下各请求无法共享重叠部分，重复计算加剧了 GPU 内存和带宽压力。

---

## 调度策略对比

| 维度 | KTransformers | vLLM | SGLang |
|------|-------------|------|--------|
| **调度算法** | FCFS 批次调度 | 自适应动态批次，优先 Decode | 零开销连续批次，CPU/GPU 重叠 |
| **Prefill/Decode 并行** | 串行为主，Prefill 最多 2 路 | Chunked Prefill 交错执行 | 持续批次混合执行 |
| **多 GPU 并行** | 手动 `transfer_map` 层拆分 | DP/TP/PP 支持 | DP + EP + PD 分离 |

---

## 七大优化方向

1. **提升 Prefill 并发度**：取消或提高并行前填充限制
2. **优化 Prefill/Decode 调度**：借鉴 vLLM 的优先解码 + 余量填充策略
3. **引入前缀缓存**：参考 vLLM PagedAttention 或 SGLang RadixAttention
4. **调整 Chunk 大小与批次策略**：根据硬件带宽优化参数
5. **改进多卡并行**：引入自动张量并行/流水线并行
6. **细粒度异步调度**：参考 SGLang 的零开销调度设计
7. **充分利用硬件特性**：CUDA Graph、FP8/INT4 量化

---

## 总结

KTransformers 在多并发场景下的主要短板是 Prefill 并行度不足和 KV Cache 管理的简化设计。以 vLLM 和 SGLang 为代表的框架已在调度策略、前缀缓存、多 GPU 并行等方面积累了成熟方案。后续版本若能在这些方向持续优化，KTransformers 有望在高并发推理场景中实现更接近硬件带宽极限的吞吐表现。
