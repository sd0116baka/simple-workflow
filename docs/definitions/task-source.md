# 任务真源

## 职责

任务真源负责发现任务源文件，读取文件内容，并固化读取时刻的内容快照。

任务真源只处理文件读取边界，不解析任务内容，不判断任务是否有效，也不决定任务是否可执行。

## 输入

```text
tasks/ 目录
```

## 输出

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
  ],
  "sourceErrors": [
    {
      "path": "tasks/broken-permission.yaml",
      "code": "READ_FAILED",
      "message": "文件读取失败。",
      "observedAt": "2026-05-17T10:00:00.000Z"
    }
  ]
}
```

## 字段说明

`sourceRecords` 是成功读取的任务源内容快照。

`sourceErrors` 是文件读取失败的诊断信息。读取失败的文件不会进入任务解析器，也不会进入任务池。

`path` 是任务源文件路径，只表示来源，不表示任务身份。

`format` 是任务源格式，例如 `yaml`。

`content` 是任务真源在 `observedAt` 时刻读取到的文本内容。

`contentHash` 是 `content` 的内容指纹，用于追溯解析结果对应的源内容版本。

`observedAt` 是任务真源读取该文件或记录该错误的时间。

## 边界规则

文件读取失败属于任务真源问题，记录在 `sourceErrors`。

内容格式错误不属于任务真源问题。只要文件成功读取，内容就作为 `sourceRecord.content` 交给任务解析器。

任务解析器不通过 `path` 再次读取文件，只解析任务真源提供的 `content`。

任务池不接收任务真源输出，不读取 `sourceRecords`，也不读取 `sourceErrors`。
