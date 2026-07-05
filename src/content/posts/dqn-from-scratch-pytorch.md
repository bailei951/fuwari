---
title: "DQN 入门实践：用 PyTorch 从零实现深度 Q 网络"
published: 2025-06-20
updated: 2025-06-20
description: "面向强化学习初学者的 DQN 完整教程，从环境搭建、神经网络构建到经验回放和 ε-贪婪策略，用 PyTorch 逐步实现。"
image: ""
tags: ["DQN", "Reinforcement Learning", "PyTorch", "Gymnasium", "Tutorial"]
category: "Reinforcement Learning"
draft: false
---

## 什么是 DQN？

DQN（Deep Q-Network）是 DeepMind 在 2013 年提出的算法，首次将深度学习与 Q-Learning 结合，在 Atari 游戏上达到人类水平。它用神经网络来近似 Q 值函数 $Q(s, a)$，解决了传统 Q-Table 无法处理连续/高维状态空间的问题。

---

## 整体架构

DQN 系统由五个核心模块组成：

```
┌─────────────┐    ┌──────────┐    ┌──────────────┐
│ Environment │───▶│  Agent   │───▶│ Q-Network    │
│ (Gymnasium) │    │ (ε-greedy)│   │ (3-layer MLP)│
└─────────────┘    └──────────┘    └──────────────┘
                          │
                   ┌──────▼──────┐
                   │   Memory    │
                   │ (Replay Buf)│
                   └─────────────┘
```

1. **Environment**：Gymnasium 标准环境（如 CartPole）
2. **Agent**：决策主体，使用 ε-贪婪策略
3. **Q-Network**：3 层 MLP 神经网络
4. **Memory**：经验回放缓冲区（Deque）

---

## 第一步：搭建 Q 网络

网络输入是状态（如 CartPole 的 4 维向量：位置、速度、角度、角速度），输出是每个动作的 Q 值：

```python
import torch.nn as nn

class DQN(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super(DQN, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.fc3(x)  # 输出层不加激活函数
```

对于 CartPole：
- `input_size=4`（状态维度）
- `hidden_size=64`
- `output_size=2`（左/右两个动作）

---

## 第二步：经验回放与 ε-贪婪策略

### 经验回放缓冲区

```python
from collections import deque
import random

class ReplayBuffer:
    def __init__(self, capacity=10000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size=32):
        return random.sample(self.buffer, batch_size)

    def __len__(self):
        return len(self.buffer)
```

**为什么需要经验回放？**
- 打破样本的时间相关性
- 每个经验可被多次使用，提高数据效率

### ε-贪婪策略

```python
epsilon = 1.0          # 初始 100% 随机探索
epsilon_min = 0.01     # 保持至少 1% 探索
epsilon_decay = 0.995  # 每次衰减 0.5%

def select_action(state):
    if random.random() < epsilon:
        return random.randrange(n_actions)  # 探索
    else:
        with torch.no_grad():
            return q_network(state).argmax().item()  # 利用
```

---

## 第三步：Q-Learning 更新

核心公式——Bellman 方程的增量形式：

$$Q(s, a) \leftarrow r + \gamma \cdot \max_{a'} Q(s', a')$$

在代码中：

```python
def train_step(batch):
    states, actions, rewards, next_states, dones = batch

    # 当前 Q 值
    current_q = q_network(states).gather(1, actions)

    # 目标 Q 值（使用 target network 稳定训练）
    with torch.no_grad():
        next_q = target_network(next_states).max(1)[0]
        target_q = rewards + gamma * next_q * (~dones)

    # MSE Loss
    loss = nn.functional.mse_loss(current_q.squeeze(), target_q)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

**关键超参数**：
| 参数 | 值 | 说明 |
|------|-----|------|
| $\gamma$ (gamma) | 0.99 | 折扣因子，值越高越看重长期回报 |
| batch_size | 32 | 每次训练的样本数 |
| lr | 0.001 | Adam 优化器学习率 |
| target_update | 100 steps | Target Network 的同步频率 |

---

## 第四步：完整训练循环

```python
for episode in range(n_episodes):
    state, _ = env.reset()
    total_reward = 0

    for step in range(max_steps):
        action = select_action(state)
        next_state, reward, done, _, _ = env.step(action)

        memory.push(state, action, reward, next_state, done)

        if len(memory) >= batch_size:
            train_step(memory.sample())

        state = next_state
        total_reward += reward

        if done:
            break

    epsilon = max(epsilon_min, epsilon * epsilon_decay)
```

---

## 从 CartPole 到更复杂的环境

这套框架的模块化设计让它很容易扩展到其他任务：

**换环境**：
```python
env = gym.make('LunarLander-v2')    # 登月器
env = gym.make('Atari-Pong')        # 雅达利游戏
```

**换网络**（图像输入用 CNN）：
```python
class CNN_DQN(nn.Module):
    def __init__(self):
        self.conv1 = nn.Conv2d(4, 32, 8, stride=4)
        self.conv2 = nn.Conv2d(32, 64, 4, stride=2)
        self.fc = nn.Linear(64 * 7 * 7, 512)
```

**自定义奖励函数**：
```python
if distance_to_target < 0.1:
    reward = 100       # 到达目标
else:
    reward = -0.01     # 时间惩罚，鼓励快速完成
```

---

## 总结

DQN 将深度学习引入强化学习的核心创新在于两点：**经验回放**打破样本相关性，**Target Network** 稳定训练过程。从 3 层 MLP + CartPole 起步，理解 Q-Learning 和 Bellman 方程的本质后，逐步升级到 CNN + Atari 就是水到渠成的事。
