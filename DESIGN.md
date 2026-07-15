---
name: 玄枢 AI
description: 安静、精确、证据优先的个人命理研究工作台
colors:
  primary: "oklch(0.52 0.12 230)"
  primary-hover: "oklch(0.46 0.13 230)"
  primary-soft: "oklch(0.92 0.04 230)"
  background: "oklch(0.985 0.002 230)"
  surface: "oklch(1 0 0)"
  surface-subtle: "oklch(0.965 0.006 230)"
  ink: "oklch(0.22 0.025 245)"
  ink-muted: "oklch(0.47 0.025 245)"
  line: "oklch(0.89 0.01 230)"
  success: "oklch(0.52 0.11 155)"
  success-ink: "oklch(0.34 0.09 155)"
  success-soft: "oklch(0.92 0.045 155)"
  warning: "oklch(0.63 0.14 75)"
  danger: "oklch(0.55 0.16 25)"
typography:
  display:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei UI, PingFang SC, sans-serif"
    fontSize: "30px"
    fontWeight: 720
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei UI, PingFang SC, sans-serif"
    fontSize: "16px"
    fontWeight: 680
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei UI, PingFang SC, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei UI, PingFang SC, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  sm: "4px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 15px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 15px"
    height: "38px"
  workspace-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0"
---

# Design System: 玄枢 AI

## Overview

**Creative North Star: “清晨案头的星历工作台”**

界面是一张整理清楚的现代工作台，时间、盘面、证据和咨询各有位置。用户可以快速扫读，
也能停下来逐层核对。信息密度来自真实任务，不来自装饰性卡片。

传统文化感由数据结构、术语和内容承担。视觉拒绝黑金玄学、紫色渐变 AI、米黄仿古纸张
和营销式 SaaS 仪表盘。

**Key Characteristics:**

- 清晰的时间与证据层级
- 高密度但稳定的研究布局
- 本地、私密、可信的状态表达
- 稀少而有意义的颜色和动效

## Colors

克制的钴蓝承担当前导航、主要操作和焦点；中性工作区保持长时间阅读舒适。绿色、琥珀和
红色只表达成功、待处理和错误，不作为体系装饰色。

**The Clear Sky Rule.** 主色在单个屏幕不超过约 10%，稀少使它保有操作含义。

**The Neutral Desk Rule.** 页面背景禁止米黄、羊皮纸和伪古籍纹理。

**The Evidence Color Rule.** 四术不使用大面积独立主题色，差异由标题、标签和结构表达。

## Typography

系统使用单一的人文无衬线栈，不加载远程字体。中文正文保持 16px，解释性段落控制在
65-75 个字符宽度；标签不小于 12px。

**The Readable Chinese Rule.** 不以缩小中文、负字距或降低对比度换取表面紧凑。

## Elevation

默认使用色调和 1px 分隔线建立层次。静态工作区没有投影；只有菜单、对话框和临时浮层
可以使用结构性阴影，模糊半径不超过 8px。

**The Flat-by-Default Rule.** 没有脱离文档流，就没有阴影。

## Components

桌面使用 224px 稳定侧栏，移动端切换为 64px 底部导航。按钮、输入和工作区统一使用
4px 或 8px 曲率；仅状态标签允许胶囊形。控件覆盖悬停、焦点、按下、禁用、加载与错误状态。

证据和命盘内容使用行、列表、表格和可展开区域，不把卡片嵌套进卡片。加载骨架必须保持
最终布局尺寸，空状态必须保留下一项真实操作。

## Do's and Don'ts

### Do:

- **Do** 让首页直接呈现今日、档案、命盘、择日和咨询等真实任务。
- **Do** 保持盘面、证据和解释之间可视化对应关系。
- **Do** 使用统一 Lucide 图标、40px 工具按钮和可见焦点环。
- **Do** 在 320px、390px 和桌面视口检查中文溢出与固定导航遮挡。

### Don't:

- **Don't** 使用黑底金字、龙纹、八卦纹和高饱和红色堆叠。
- **Don't** 使用紫色渐变、发光球体、玻璃卡片和聊天气泡占据一切的 AI 风格。
- **Don't** 使用米黄羊皮纸、书法字体和伪古籍纹理。
- **Don't** 制作相同图标卡片组成的 SaaS 仪表盘或巨大无意义指标。
- **Don't** 用颜色、动画或装饰强化灾祸、死亡、破财等恐惧内容。
- **Don't** 嵌套卡片、使用渐变文字、侧边彩条、超大圆角或宽模糊阴影。
