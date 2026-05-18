# 任务解析器

## 职责

任务解析器只接收任务真源成功读取的 `sourceRecords`，解析其中的 `content`，并对每个 `sourceRecord` 产出一个 `taskRecognitionReport`。

任务解析器不读取文件系统，不处理 `sourceErrors`，不维护任务池，不判断任务是否可执行。

## 输入

```json
{
  "sourceRecords": [
    {
      "path": "tasks/task-003.yaml",
      "format": "yaml",
      "content": "id: task-003\nname: 监听任务文件变化\n...",
      "contentHash": "abc123",
      "observedAt": "2026-05-17T10:00:00.000Z"
    }
  ]
}
```

## 输出

```json
{
  "taskRecognitionReports": [
    {
      "source": {
        "path": "tasks/task-003.yaml",
        "format": "yaml",
        "contentHash": "abc123"
      },
      "recognition": {
        "outcome": "recognized",
        "findings": []
      },
      "taskDraft": {
        "id": "task-003",
        "name": "监听任务文件变化",
        "kind": "default",
        "priority": "high",
        "goal": "监听 tasks 目录中的任务源文件变化，并让界面自动刷新。",
        "acceptanceCriteria": [
          "修改任务源文件后界面自动刷新",
          "新增任务源文件后列表自动出现"
        ],
        "maxIterations": "default"
      },
      "qualityGate": {
        "outcome": "pass"
      }
    }
  ]
}
```

## taskDraft 字段规则

`taskDraft` 使用系统设计好的任务字段全集。每个任务都会展开所有可用字段。

源内容里写了字段，就使用源内容值。

源内容里没写字段，就使用字符串 `"default"`。

`"default"` 表示该字段采用 Project Profile 中对应字段的默认策略。它不是解析器自己生成的兜底值，也不是具体默认值。

JSON 中必须写字符串 `"default"`。YAML 源文件中可以写 `default`，解析后等价于字符串 `"default"`。

## recognition.outcome

`recognition.outcome` 有 3 个枚举值：

```text
recognized
incomplete
content-broken
```

`recognized` 表示内容格式正确，并且识别为完整任务。

`incomplete` 表示内容格式正确，也能形成任务草稿，但字段缺失、字段不合格，或某些 `"default"` 不被当前质量门槛允许。

`content-broken` 表示任务源内容格式坏了，无法形成任务草稿。

## findings

`findings` 表示对应环节发现的问题。

```json
{
  "field": "goal",
  "severity": "blocking",
  "code": "GOAL_REQUIRED",
  "message": "任务目标不能为空。"
}
```

`severity` 只有 2 个枚举值：

```text
blocking
warning
```

`blocking` 表示阻断后续流程。

`warning` 表示不阻断后续流程，只提醒维护者。

不使用 `note`、`info`、`error`、`critical`。

## qualityGate.outcome

`qualityGate.outcome` 只有 2 个枚举值：

```text
pass
fail
```

`pass` 表示允许进入后续流程。

`fail` 表示不允许进入后续流程。

`qualityGate` 不解释原因。原因需要查看对应环节自己的 `findings`。

## 内容格式坏了的例子

```json
{
  "source": {
    "path": "tasks/broken.yaml",
    "format": "yaml",
    "contentHash": "bad999"
  },
  "recognition": {
    "outcome": "content-broken",
    "findings": [
      {
        "field": "content",
        "severity": "blocking",
        "code": "CONTENT_PARSE_FAILED",
        "message": "任务源内容无法解析。"
      }
    ]
  },
  "taskDraft": null,
  "qualityGate": {
    "outcome": "fail"
  }
}
```

## 边界规则

任务解析器必须对每个 `sourceRecord` 产出一个 `taskRecognitionReport`。

文件读取失败不进入任务解析器，不进入任务池。

内容解析失败进入任务解析器，也进入任务池。

任务解析器不通过 `path` 读取文件，只解析 `content`。

任务池只接收 `taskRecognitionReports`，不碰任务真源。
