---
title: "终身强化学习中的灾难性遗忘：从 LAICA 到 Cal-LAICA"
published: 2025-11-20
updated: 2025-11-20
description: "系统梳理 LAICA 与 Cal-LAICA 的核心思想，详解 L-MDP 框架下的策略分解机制，并对比 EWC、GEM、PackNet 等灾难性遗忘缓解方法。"
image: "./cover.jpg"
tags: ["Lifelong RL", "Catastrophic Forgetting", "LAICA", "Cal-LAICA", "EWC", "GEM", "PackNet", "Continual Learning"]
category: "Reinforcement Learning"
draft: false
---

## 问题背景

在标准强化学习中，我们通常假设动作空间固定不变。但在现实场景中——机器人安装新关节、推荐系统上架新商品、软件添加新功能——**动作集是持续变化的**。传统 RL 算法每当动作集变化就需要从零训练。

这是**终身强化学习（Lifelong RL）** 要解决的核心问题。

---

## L-MDP：建模变化动作集的数学框架

传统的 MDP 定义为 $M = (S, A, P, R, \gamma)$，其中动作集 $A$ 是固定的。论文提出的 **L-MDP（Lifelong MDP）** 扩展了这一框架：

$$
L = (M_0, E, D, F)
$$

| 组件 | 含义 |
|------|------|
| $M_0$ | 初始 MDP |
| $E$ | 潜在动作结构空间（所有可能动作的向量表示） |
| $D$ | 新动作的采样分布 |
| $F$ | 新动作被添加的频率 |

**核心假设**：所有动作（当前的和未来的）都来源于一个更大的潜在结构空间 $E$，智能体只是逐步发现其中的部分动作。

---

## LAICA 的核心机制：策略分解

LAICA（Lifelong Adaptation and Improvement for Changing Actions）的核心思想是将策略拆分为两个组件：

$$
\pi(a|s) = \sum_{\hat e} \beta(\hat e|s) \cdot \hat\phi(a|\hat e)
$$

| 组件 | 作用 | 是否随动作集变化 |
|------|------|:---:|
| **$\beta(s, \hat e)$** | 决策组件：在潜在空间中选择动作类型 | ❌ 固定不变 |
| **$\hat\phi(\hat e, A)$** | 映射组件：将潜在动作映射到具体动作 | ✅ 随新动作更新 |

**关键优势**：$\beta$ 的参数维度不受动作集大小影响，旧知识完整保留。新动作加入时只需更新 $\hat\phi$。

### 两阶段学习

| 阶段 | 目标 | 优化对象 | 是否需要奖励 |
|------|------|----------|:---:|
| **Adaptation（适应）** | 快速学习新动作结构 | $\hat\phi$ | ❌ 无监督学习 |
| **Improvement（改进）** | 优化整体策略性能 | $\beta$ | ✅ 策略梯度 |

Adaptation 阶段使用类似 VAE 的目标函数，通过逆动力学模型 $\phi(s, s') \to \hat e$ 和重建损失来学习动作嵌入，完全不依赖奖励信号，数据效率极高。

---

## Cal-LAICA 的改进

Cal-LAICA 在 LAICA 基础上引入两项关键改进：

| LAICA 的问题 | Cal-LAICA 的解决方案 |
|-------------|-------------------|
| 纯在线 RL，数据效率低 | **CQL（Conservative Q-Learning）** 离线预训练 |
| Q 值低估，恢复缓慢 | **Cal-QL 值函数校准**，确保新 Q 值不低于参考策略 |
| 无旧数据复用 | **OORB（Online-Offline Replay Buffer）** 统一数据收集 |

Cal-LAICA = **LAICA + CQL + Cal-QL + OORB**，在 MiniGrid 迷宫环境（256 动作空间，5 阶段动作集开放）中表现出显著优势。

---

## 灾难性遗忘缓解方法对比

在 LAICA 框架中引入额外缓解方法时，我们对比了三种经典方案：

### EWC（Elastic Weight Consolidation）

$$\mathcal{L}_{EWC} = \frac{\lambda}{2} \sum_i F_i (\theta_i - \theta_i^*)^2$$

- 以 Fisher 信息矩阵衡量每个参数对旧任务的重要性
- 在训练新任务时对重要参数施加二次惩罚
- **优点**：实现简单，无需存储旧数据
- **缺点**：Fisher 估计的准确性影响效果

### GEM（Gradient Episodic Memory）

$$\text{约束条件：} \langle g_{current}, g_k \rangle \geq 0 \quad \forall k$$

- 维护每个旧任务的少量样本（默认 128 条）
- 投影当前梯度到不增加旧任务损失的方向
- **优点**：有理论保证
- **缺点**：需要额外存储 memory buffer

### PackNet

- 每个任务完成后执行 L1 全局剪枝
- 通过 gradient hook 冻结已训练权重
- **优点**：完全隔离不同任务
- **缺点**：网络容量被逐步消耗

| 方法 | 核心机制 | 存储开销 | 适用场景 |
|------|---------|:---:|------|
| **EWC** | Fisher 正则化 | 无 | 任务数多、存储受限 |
| **GEM** | 梯度投影 | 少量样本 | 需要理论保证 |
| **PackNet** | 剪枝 + 权重冻结 | 无（但消耗容量） | 网络容量充足 |

---

## 理论保证

LAICA 的两个核心定理：

**Theorem 1** — 性能上界：
$$v^{\mu^*}(s_0) - v^{\pi_k^*}(s_0) \leq \frac{\gamma \rho \epsilon_k}{(1-\gamma)^2} R_{max}$$

当前策略与"上帝视角"策略的差距由动作集稀疏度 $\epsilon_k$ 决定。随着动作集逐渐覆盖 $E$，$\epsilon_k \to 0$，性能差距消失。

**Theorem 2** — 近似误差：
$$v^{\mu^*} - v^{\pi_k^{**}} \leq \frac{\gamma (\rho \epsilon_k + \delta_k)}{(1-\gamma)^2} R_{max}$$

LAICA 的额外误差 $\delta_k$ 来自 $\hat\phi$ 的映射近似。Adaptation 阶段的目标就是最小化 $\delta_k$。

---

## 关键局限

LAICA 依赖平滑性假设：相似的潜在动作产生相似的状态转移。当新动作与所有旧动作**完全不相关**时（例如编程平台上突然加入烹饪教程），LAICA 的性能会退化到近似从零开始训练的水平。

---

## 总结

LAICA 通过策略分解巧妙地将"变化动作集"问题转化为潜在空间中的固定维度学习问题，Cal-LAICA 进一步通过离线 RL 和值函数校准提升了数据效率。在实际应用中，应根据任务相似度、存储约束和网络容量灵活选择 EWC/GEM/PackNet 等辅助方法。
