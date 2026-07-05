---
title: "MQL5 算法交易入门：用 Python 构建你的第一个交易机器人"
published: 2025-04-10
updated: 2025-04-10
description: "从零开始学习 MetaTrader 5 算法交易，详解 MT5 Python API 的行情获取、账户管理、订单操作与 EA 框架，并给出完整的交易机器人模板。"
image: ""
tags: ["MQL5", "Algorithmic Trading", "Python", "MetaTrader", "Quant"]
category: "Finance"
draft: false
---

## 前言

MetaTrader 5（MT5）是全球最广泛使用的交易平台之一，不仅支持手动交易，还提供了强大的算法交易（Algorithmic Trading）能力。通过 MT5 的 Python API（`MetaTrader5` 包），我们可以用 Python 构建自己的**智能交易机器人（Expert Advisor, EA）**，实现自动化策略回测和实盘交易。

本文基于实际操作经验，系统梳理从环境搭建到完整 EA 框架的全流程。

---

## 环境与基础概念

### EA 是什么？

**EA（Expert Advisor）** 是 MT5 中的智能交易系统，可以：

- 自动获取实时行情数据
- 根据预设策略自动开仓/平仓
- 管理止损止盈
- 7×24 小时无人值守运行

### Python vs MQL5 原生语言

| 维度 | Python API | MQL5 原生 (C++ like) |
|------|-----------|---------------------|
| 上手难度 | 低，Python 生态丰富 | 中，类 C++ 语法 |
| 数据科学能力 | ✅ pandas / numpy / sklearn | ❌ 需自行实现 |
| 执行速度 | 慢（通过网络通信） | 快（平台内部执行） |
| 适用场景 | 研究、回测、中低频策略 | 高频策略、平台内运行 |

**结论**：研究和开发阶段用 Python，生产环境可考虑 MQL5 原生。

### 连接 MT5

```python
import MetaTrader5 as mt5

if not mt5.initialize():
    print("MT5 初始化失败，请检查终端是否运行")
    quit()

print("MT5 连接成功")
# 显示账户信息
print(mt5.account_info())

# 结束时务必调用
# mt5.shutdown()
```

---

## 信息获取：读懂市场数据

MT5 Python API 提供了 8 个核心函数用于获取交易所需的各类信息。

### 1. 交易品种详情：`symbol_info()`

```python
symbol = mt5.symbol_info("EURUSD")
print(f"点值: {symbol.point}")      # 最小价格变动单位 → 0.00001
print(f"当前点差: {symbol.spread}")  # 买卖价差 → 17点
print(f"小数位: {symbol.digits}")    # 报价小数位数 → 5
print(f"最小手数: {symbol.volume_min}")  # → 0.01
```

返回的 namedtuple 包含 80+ 字段，涵盖交易模式、隔夜利息、保证金要求等全部交易参数。

### 2. 历史 K 线：`copy_rates_from_pos()`

```python
import pandas as pd

rates = mt5.copy_rates_from_pos("EURUSD", mt5.TIMEFRAME_H1, 0, 100)
df = pd.DataFrame(rates)
df["time"] = pd.to_datetime(df["time"], unit="s")  # 时间戳转换
df.set_index("time", inplace=True)

# 列：open, high, low, close, tick_volume, spread, real_volume
print(df.tail())
```

时间周期常量：

| 常量 | 含义 |
|------|------|
| `mt5.TIMEFRAME_M1` | 1 分钟 |
| `mt5.TIMEFRAME_M5` | 5 分钟 |
| `mt5.TIMEFRAME_H1` | 1 小时 |
| `mt5.TIMEFRAME_D1` | 日线 |

### 3. 实时报价：`symbol_info_tick()`

```python
tick = mt5.symbol_info_tick("EURUSD")
print(f"买价(Bid): {tick.bid}")   # 可卖出的价格
print(f"卖价(Ask): {tick.ask}")   # 可买入的价格
print(f"最后成交: {tick.last}")
print(f"点差: {(tick.ask - tick.bid) / symbol.point:.0f} 点")
```

### 4. 账户信息：`account_info()`

```python
account = mt5.account_info()
print(f"余额: {account.balance}")
print(f"净值: {account.equity}")       # 余额 + 浮动盈亏
print(f"已用保证金: {account.margin}")
print(f"可用保证金: {account.margin_free}")
print(f"杠杆: 1:{account.leverage}")
print(f"浮动盈亏: {account.profit}")

# 计算保证金使用率
margin_level = (account.equity / account.margin * 100) if account.margin > 0 else 0
print(f"保证金水平: {margin_level:.1f}%")  # <100% 时可能触发强平
```

### 5-6. 持仓与挂单

```python
# 获取所有持仓
for pos in mt5.positions_get():
    direction = "多" if pos.type == 0 else "空"
    print(f"[{pos.ticket}] {pos.symbol} {direction} "
          f"手数:{pos.volume} 开仓价:{pos.price_open} "
          f"当前价:{pos.price_current} 盈亏:{pos.profit}")

# 获取活跃挂单
for order in mt5.orders_get():
    type_map = {2: "Buy Limit", 3: "Sell Limit", 4: "Buy Stop", 5: "Sell Stop"}
    print(f"[{order.ticket}] {order.symbol} {type_map.get(order.type, '?')} "
          f"挂单价:{order.price_open} 剩余手数:{order.volume_current}")
```

### 7. 历史订单：`history_orders_get()`

```python
from datetime import datetime, timezone

# 获取过去 24 小时的历史订单
start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
end = datetime.now(timezone.utc)
history = mt5.history_orders_get(start, end)

for order in history:
    if order.state == 3:  # 已成交
        print(f"[{order.ticket}] {order.symbol} 成交价:{order.price_open}")
```

### 8. 全部可交易品种：`symbols_get()`

```python
all_symbols = mt5.symbols_get()
forex_pairs = [s.name for s in all_symbols if s.name.endswith(('USD', 'EUR', 'GBP', 'JPY'))]
print(f"外汇品种数: {len(forex_pairs)}")
```

---

## 交易操作：从下单到平仓

### 市价单

```python
def market_order(symbol, volume, order_type, sl=0, tp=0, deviation=20, magic=123456):
    """发送市价单"""
    tick = mt5.symbol_info_tick(symbol)
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": mt5.ORDER_TYPE_BUY if order_type == "BUY" else mt5.ORDER_TYPE_SELL,
        "price": tick.ask if order_type == "BUY" else tick.bid,
        "sl": sl,
        "tp": tp,
        "deviation": deviation,       # 允许最大滑点（点数）
        "magic": magic,               # EA 标识符
        "comment": "Python EA",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_FOK,  # 全成交或取消
    }

    result = mt5.order_send(request)
    if result.retcode == 0:
        print(f"✅ 市价单成功 订单ID:{result.order}")
    else:
        print(f"❌ 下单失败: {result.comment}")
    return result

# 使用示例
market_order("EURUSD", 0.1, "BUY", sl=1.08000, tp=1.09000)
```

### 挂单与修改

```python
def pending_order(symbol, volume, order_type, price, sl=0, tp=0):
    """下挂单"""
    request = {
        "action": mt5.TRADE_ACTION_PENDING,
        "symbol": symbol,
        "volume": volume,
        "type": order_type,  # ORDER_TYPE_BUY_LIMIT / SELL_LIMIT 等
        "price": price,
        "sl": sl,
        "tp": tp,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_FOK,
    }
    return mt5.order_send(request)

# 修改止损止盈
mt5.order_modify(ticket=123456789, sl=1.07500, tp=1.09500)  # ticket 为订单ID
```

### 取消挂单与平仓

```python
# 取消挂单
mt5.order_cancel(ticket=987654321)

# 平仓（需要持仓的 ticket）
mt5.position_close(ticket=1122334455)
```

### 下单前校验

```python
def safe_order(symbol, volume, order_type, sl=0, tp=0):
    """下单前先校验参数"""
    tick = mt5.symbol_info_tick(symbol)
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": mt5.ORDER_TYPE_BUY if order_type == "BUY" else mt5.ORDER_TYPE_SELL,
        "price": tick.ask if order_type == "BUY" else tick.bid,
        "sl": sl,
        "tp": tp,
        "deviation": 20,
        "magic": 123456,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_FOK,
    }

    # 预校验
    check = mt5.order_check(request)
    if check.retcode != 0:
        print(f"⚠️ 订单校验失败: {check.comment}")
        return None

    # 校验通过，执行下单
    return mt5.order_send(request)
```

---

## EA 完整框架

以下是一个可直接运行的 EA 模板，包含完整的生命周期管理：

```python
import MetaTrader5 as mt5
import time
from datetime import datetime

class TradingBot:
    def __init__(self, symbol="EURUSD", magic=123456):
        self.symbol = symbol
        self.magic = magic
        self.running = False

    def initialize(self):
        """初始化：连接 MT5"""
        if not mt5.initialize():
            raise ConnectionError("MT5 初始化失败")

        account = mt5.account_info()
        print(f"✅ 已连接 | 账户:{account.login} | "
              f"余额:{account.balance} | 杠杆:1:{account.leverage}")

    def get_market_data(self):
        """获取市场数据"""
        tick = mt5.symbol_info_tick(self.symbol)
        rates = mt5.copy_rates_from_pos(self.symbol, mt5.TIMEFRAME_M5, 0, 20)
        return tick, rates

    def strategy(self, tick, rates):
        """
        策略逻辑 — 在这里实现你的交易策略
        返回: "BUY", "SELL", "HOLD"
        """
        # 示例：简单的均线交叉策略
        if len(rates) < 20:
            return "HOLD"

        ma5 = sum(r["close"] for r in rates[-5:]) / 5
        ma20 = sum(r["close"] for r in rates[-20:]) / 20

        if ma5 > ma20 * 1.001:   # 金叉
            return "BUY"
        elif ma5 < ma20 * 0.999:  # 死叉
            return "SELL"
        return "HOLD"

    def execute_trade(self, signal):
        """执行交易信号"""
        positions = mt5.positions_get(symbol=self.symbol)
        has_position = len(positions) > 0

        if signal == "BUY" and not has_position:
            self._market_order(mt5.ORDER_TYPE_BUY)
        elif signal == "SELL" and not has_position:
            self._market_order(mt5.ORDER_TYPE_SELL)
        elif signal == "HOLD" and has_position:
            pass  # 保持持仓

    def _market_order(self, order_type):
        tick = mt5.symbol_info_tick(self.symbol)
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": self.symbol,
            "volume": 0.1,
            "type": order_type,
            "price": tick.ask if order_type == mt5.ORDER_TYPE_BUY else tick.bid,
            "deviation": 20,
            "magic": self.magic,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }

        result = mt5.order_send(request)
        direction = "BUY" if order_type == mt5.ORDER_TYPE_BUY else "SELL"
        if result.retcode == 0:
            print(f"✅ [{datetime.now():%H:%M:%S}] 开仓 {direction} @ {tick.ask if order_type == mt5.ORDER_TYPE_BUY else tick.bid}")
        else:
            print(f"❌ 下单失败: {result.comment}")

    def run(self):
        """主循环"""
        self.running = True
        print("🚀 EA 已启动...")

        while self.running:
            try:
                tick, rates = self.get_market_data()
                signal = self.strategy(tick, rates)
                self.execute_trade(signal)
                time.sleep(1)  # 控制频率，避免过载
            except KeyboardInterrupt:
                self.stop()
            except Exception as e:
                print(f"⚠️ 运行异常: {e}")
                time.sleep(5)

    def stop(self):
        """清理与断开"""
        self.running = False
        mt5.shutdown()
        print("👋 EA 已停止")


if __name__ == "__main__":
    bot = TradingBot(symbol="EURUSD", magic=123456)
    try:
        bot.initialize()
        bot.run()
    except Exception as e:
        print(f"❌ 致命错误: {e}")
    finally:
        bot.stop()
```

---

## MQL5 原生 EA 骨架

如果策略需要高频执行或部署到生产环境，可以参考 MQL5 原生的 EA 结构（类 C++ 语法）：

```cpp
#property copyright "Your Name"
#property version   "1.00"

int OnInit()
{
    // 初始化：验证参数、设置指标
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
    // 清理：删除图形对象、关闭文件句柄
}

void OnTick()
{
    // 核心逻辑 — 每个 tick 执行一次
    // 1. 获取行情
    // 2. 策略判断
    // 3. 执行订单
}
```

---

## 安全实践

1. **先模拟后实盘**：所有策略必须在模拟账户上验证
2. **风险控制**：
   - 单笔最大亏损限制
   - 每日最大亏损/盈利停止
   - 保证金使用率监控
3. **订单校验**：下单前使用 `order_check()` 验证参数
4. **异常处理**：网络断开、MT5 崩溃等情况要有恢复机制
5. **日志记录**：每笔交易和异常都要记录，便于复盘

---

## 总结

MT5 的 Python API 为量化交易提供了完整的基础设施：8 个信息获取函数覆盖了行情、账户、持仓的全部数据需求，5 个交易函数实现了从下单到平仓的完整生命周期。在此基础上构建的 EA 框架可以快速迭代策略，同时保留向 MQL5 原生迁移的路径。

对于算法交易初学者，建议路径：**Python API 回测 → 模拟账户验证 → 小资金实盘 → 策略优化/原生迁移**。
