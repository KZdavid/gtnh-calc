# GTNH 数据导出流程（中文）

本文档说明如何从 Minecraft 导出数据并生成计算器所需的 `data.bin` 和 `atlas.webp`。

## 前置条件

- **Java 8**（推荐 OpenJDK 8，可从 [openlogic.com](https://www.openlogic.com/openjdk-downloads) 下载；较新版本可能不兼容）
- **.NET SDK 8.0** 或更高版本
- 已安装 GTNH 整合包的 Minecraft 客户端

---

## 第一步：构建 NESQL Exporter mod

1. 克隆 [ShadowTheAge/nesql-exporter](https://github.com/ShadowTheAge/nesql-exporter) 仓库：
   ```bash
   git clone https://github.com/ShadowTheAge/nesql-exporter.git
   cd nesql-exporter
   ```

2. 构建 mod：
   ```bash
   ./gradlew build
   ```
   Windows 用户使用 `gradlew.bat build`。构建产物位于 `build/libs/`，取**不带** `-dev` 后缀的 `.jar`。

---

## 第二步：在 Minecraft 中导出数据

1. 将 `NESQL-Exporter-*.jar` 和 `NESQL-Exporter-*-deps.jar` 放入 `mods/` 目录。唯一必需的依赖是 `NotEnoughItems`。

2. 如果 `mods/` 中有 `bugtorch-1.7.10-*.jar`，**临时将其移出**。BugTorch 会导致附魔物品图标渲染为空白，影响导出结果。导出完成后可放回。

3. 启动 Minecraft，进入一个存档（推荐新建创造模式单人存档）。
   - 建议使用新存档，因为导出器会使用当前玩家状态（例如安装了 Spice of Life 时，物品提示会反映已食用的食物）。

4. 如果使用 GTNH 版本的 NotEnoughItems，**打开背包并查看 NEI 物品列表**，确保其完全加载。跳过此步可能导致部分物品未被导出。

5. （可选）如需导出神秘时代4数据，建议先获取全部研究：
   - 阅读创造模式魔导手册
   - 运行以下命令清除所有污染：
     ```
     /tc warp @p set 0
     /tc warp @p set 0 PERM
     /tc warp @p set 0 TEMP
     ```

6. 在游戏内运行命令：
   ```
   /nesql
   ```
   可选指定仓库名：`/nesql your_repository_name`

7. 可以暂停游戏，导出会在暂停状态下继续进行（略微加快速度）。

8. 等待导出完成。根据安装的 mod 数量，可能需要较长时间（GTNH 完整包约 60 分钟）。导出数据保存在：
   ```
   .minecraft/nesql/
   ```

9. 导出完成后，可删除两个 mod jar，并将 BugTorch 放回（如果之前移出了）。

> **注意：** 日志中可能出现 Forge 关于 `System.exit()` 的警告，这是 Hibernate 库的已知问题，可忽略。

---

## 第三步：处理导出数据

1. 进入本仓库的 `export/` 目录（包含 C# 处理项目）。

2. 运行处理工具：
   ```bash
   dotnet run <nesql 导出目录路径> [--output <输出目录路径>]
   ```
   参数说明：
   - `<nesql 导出目录路径>`：必填，`.minecraft/nesql/` 目录的路径
   - `--output <路径>`：可选，生成文件的输出目录；省略则输出到当前目录

3. 处理完成后将生成：
   - `atlas.webp`：包含所有物品图标的纹理图集
   - `data.bin`：包含配方和物品数据的二进制文件

---

## 第四步：在计算器中使用

将生成的 `data.bin` 和 `atlas.webp` 放入计算器的 `data/` 目录，或通过计算器设置界面的"本地数据文件 (beta)"功能加载。

> **注意：** `data.bin` 与 `atlas.webp` 必须来自同一次导出，否则图标会错位。
