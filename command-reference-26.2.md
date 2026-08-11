# 26.2 命令参考(由 dpkit 离线生成)

> 语法来自 Spyglass 缓存的 26.2 命令树(92 条顶层命令)。
> 重新生成: node dpkit.mjs --dump-all [--depth=N] [--version=<v>]

## advancement

```
命令路径: advancement
下一项(2选1): grant | revoke

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ grant | revoke
    └─ <targets>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
        └─ everything | from | only | through | until
               ↳ 命令可在此结束
            └─ <advancement>
                <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:advancement
                   ↳ 命令可在此结束
            └─ <advancement>
                <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:advancement
                └─ <criterion>
                    <...>  字符串 · 到行尾
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <advancement>
                <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:advancement
                   ↳ 命令可在此结束
            └─ <advancement>
                <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:advancement
                   ↳ 命令可在此结束
    └─ <targets>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
        └─ everything | from | only | through | until
               ↳ 命令可在此结束
            └─ <advancement>
                <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:advancement
                   ↳ 命令可在此结束
            └─ <advancement>
                <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:advancement
                └─ <criterion>
                    <...>  字符串 · 到行尾
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <advancement>
                <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:advancement
                   ↳ 命令可在此结束
            └─ <advancement>
                <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:advancement
                   ↳ 命令可在此结束
```

## attribute

```
命令路径: attribute
下一项: <target>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <target>
    <...>  实体/玩家选择器 · 实体 · 单个
    └─ <attribute>
        <...>  注册表条目 · 注册表:minecraft:attribute
        └─ base | get | modifier
            └─ get | reset | set
                └─ <scale>
                    <...>  浮点数
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                └─ <value>
                    <...>  浮点数
                       ↳ 命令可在此结束
            └─ <scale>
                <...>  浮点数
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
            └─ add | remove | value
                └─ <id>
                    <...>  资源位置 ID,如 minecraft:diamond
                    └─ <value>   …(更深用 --depth=N)
                └─ <id>
                    <...>  资源位置 ID,如 minecraft:diamond
                       ↳ 命令可在此结束
                └─ get
                    └─ <id>   …(更深用 --depth=N)
```

## ban

```
命令路径: ban
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  玩家名或玩家选择器
    └─ <reason>
        <...>  消息文本(支持 @s 等选择器)
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## ban-ip

```
命令路径: ban-ip
下一项: <target>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <target>
    <...>  字符串 · 单词
    └─ <reason>
        <...>  消息文本(支持 @s 等选择器)
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## banlist

```
命令路径: banlist
下一项(2选1): ips | players
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ ips | players
       ↳ 命令可在此结束
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## bossbar

```
命令路径: bossbar
下一项(5选1): add | get | list | remove | set

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ add | get | list | remove | set
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
        └─ <name>
            <...>  数据组件 ID,如 minecraft:damage、minecraft:food
               ↳ 命令可在此结束
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
        └─ max | players | value | visible
               ↳ 命令可在此结束
               ↳ 命令可在此结束
               ↳ 命令可在此结束
               ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
           ↳ 命令可在此结束
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
        └─ color | max | name | players | style | value | visible
            └─ blue | green | pink | purple | red | white | yellow
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <max>
                <...>  整数 · ≥1
                   ↳ 命令可在此结束
            └─ <name>
                <...>  数据组件 ID,如 minecraft:damage、minecraft:food
                   ↳ 命令可在此结束
            └─ <targets>
                <...>  实体/玩家选择器 · 限玩家 · 可多个
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
            └─ notched_10 | notched_12 | notched_20 | notched_6 | progress
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <value>
                <...>  整数 · ≥0
                   ↳ 命令可在此结束
            └─ <visible>
                <...>  布尔值
                   ↳ 命令可在此结束
```

## clear

```
命令路径: clear
下一项: <targets>
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 限玩家 · 可多个
    └─ <item>
        <...>  物品谓词(ID/标签,可带组件谓词)
        └─ <maxCount>
            <...>  整数 · ≥0
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## clone

```
命令路径: clone
下一项(2选1): from | <begin>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ from | <begin>
    <...>  方块坐标 x y z
    └─ <end>
        <...>  方块坐标 x y z
        └─ to | <destination>
            <...>  方块坐标 x y z
            └─ filtered | masked | replace | strict
                └─ <filter>
                    <...>  方块谓词(ID/标签,可带状态谓词)
                    └─ force | move | normal   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                └─ force | move | normal
                       ↳ 命令可在此结束
                       ↳ 命令可在此结束
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
                └─ force | move | normal
                       ↳ 命令可在此结束
                       ↳ 命令可在此结束
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
                └─ filtered | masked | replace
                    └─ <filter>   …(更深用 --depth=N)
                    └─ force | move | normal   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                    └─ force | move | normal   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
            └─ <targetDimension>
                <...>  维度 ID,如 minecraft:overworld
                └─ <destination>
                    <...>  方块坐标 x y z
                    └─ filtered | masked | replace | strict   …(更深用 --depth=N)
                       ↳ 命令可在此结束
    └─ <sourceDimension>
        <...>  维度 ID,如 minecraft:overworld
        └─ <begin>
            <...>  方块坐标 x y z
            └─ <end>
                <...>  方块坐标 x y z
                └─ to | <destination>
                    <...>  方块坐标 x y z
                    └─ filtered | masked | replace | strict   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                    └─ <targetDimension>   …(更深用 --depth=N)
```

## damage

```
命令路径: damage
下一项: <target>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <target>
    <...>  实体/玩家选择器 · 实体 · 单个
    └─ <amount>
        <...>  浮点数 · ≥0
        └─ <damageType>
            <...>  注册表条目 · 注册表:minecraft:damage_type
            └─ at | by
                └─ <location>
                    <...>  3D 坐标 x y z
                       ↳ 命令可在此结束
                └─ <entity>
                    <...>  实体/玩家选择器 · 实体 · 单个
                    └─ from   …(更深用 --depth=N)
                       ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
```

## data

```
命令路径: data
下一项(4选1): get | merge | modify | remove

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ get | merge | modify | remove
    └─ block | entity | storage
        └─ <targetPos>
            <...>  方块坐标 x y z
            └─ <path>
                <...>  NBT 路径,如 Items[0].tag
                └─ <scale>
                    <...>  浮点数
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
        └─ <target>
            <...>  实体/玩家选择器 · 实体 · 单个
            └─ <path>
                <...>  NBT 路径,如 Items[0].tag
                └─ <scale>
                    <...>  浮点数
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
        └─ <target>
            <...>  资源位置 ID,如 minecraft:diamond
            └─ <path>
                <...>  NBT 路径,如 Items[0].tag
                └─ <scale>
                    <...>  浮点数
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
    └─ block | entity | storage
        └─ <targetPos>
            <...>  方块坐标 x y z
            └─ <nbt>
                <...>  NBT 复合标签,如 {id:"minecraft:stone"}
                   ↳ 命令可在此结束
        └─ <target>
            <...>  实体/玩家选择器 · 实体 · 单个
            └─ <nbt>
                <...>  NBT 复合标签,如 {id:"minecraft:stone"}
                   ↳ 命令可在此结束
        └─ <target>
            <...>  资源位置 ID,如 minecraft:diamond
            └─ <nbt>
                <...>  NBT 复合标签,如 {id:"minecraft:stone"}
                   ↳ 命令可在此结束
    └─ block | entity | storage
        └─ <targetPos>
            <...>  方块坐标 x y z
            └─ <targetPath>
                <...>  NBT 路径,如 Items[0].tag
                └─ append | insert | merge | prepend | set
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ <index>   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
        └─ <target>
            <...>  实体/玩家选择器 · 实体 · 单个
            └─ <targetPath>
                <...>  NBT 路径,如 Items[0].tag
                └─ append | insert | merge | prepend | set
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ <index>   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
        └─ <target>
            <...>  资源位置 ID,如 minecraft:diamond
            └─ <targetPath>
                <...>  NBT 路径,如 Items[0].tag
                └─ append | insert | merge | prepend | set
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ <index>   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
                    └─ from | string | value   …(更深用 --depth=N)
    └─ block | entity | storage
        └─ <targetPos>
            <...>  方块坐标 x y z
            └─ <path>
                <...>  NBT 路径,如 Items[0].tag
                   ↳ 命令可在此结束
        └─ <target>
            <...>  实体/玩家选择器 · 实体 · 单个
            └─ <path>
                <...>  NBT 路径,如 Items[0].tag
                   ↳ 命令可在此结束
        └─ <target>
            <...>  资源位置 ID,如 minecraft:diamond
            └─ <path>
                <...>  NBT 路径,如 Items[0].tag
                   ↳ 命令可在此结束
```

## datapack

```
命令路径: datapack
下一项(4选1): create | disable | enable | list

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ create | disable | enable | list
    └─ <id>
        <...>  字符串 · 短语(可引号)
        └─ <description>
            <...>  数据组件 ID,如 minecraft:damage、minecraft:food
               ↳ 命令可在此结束
    └─ <name>
        <...>  字符串 · 短语(可引号)
           ↳ 命令可在此结束
    └─ <name>
        <...>  字符串 · 短语(可引号)
        └─ after | before | first | last
            └─ <existing>
                <...>  字符串 · 短语(可引号)
                   ↳ 命令可在此结束
            └─ <existing>
                <...>  字符串 · 短语(可引号)
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ available | enabled
           ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## debug

```
命令路径: debug
下一项(3选1): function | start | stop

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ function | start | stop
    └─ <name>
        <...>  函数 ID,如 minecraft:foo/bar
           ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## defaultgamemode

```
命令路径: defaultgamemode
下一项: <gamemode>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <gamemode>
    <...>  游戏模式: survival|creative|adventure|spectator
       ↳ 命令可在此结束
```

## deop

```
命令路径: deop
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  玩家名或玩家选择器
       ↳ 命令可在此结束
```

## dialog

```
命令路径: dialog
下一项(2选1): clear | show

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ clear | show
    └─ <targets>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
           ↳ 命令可在此结束
    └─ <targets>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
        └─ <dialog>
            <...>  对话框 ID
               ↳ 命令可在此结束
```

## difficulty

```
命令路径: difficulty
下一项(4选1): easy | hard | normal | peaceful
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ easy | hard | normal | peaceful
       ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## effect

```
命令路径: effect
下一项(2选1): clear | give

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ clear | give
    └─ <targets>
        <...>  实体/玩家选择器 · 实体 · 可多个
        └─ <effect>
            <...>  注册表条目 · 注册表:minecraft:mob_effect
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <targets>
        <...>  实体/玩家选择器 · 实体 · 可多个
        └─ <effect>
            <...>  注册表条目 · 注册表:minecraft:mob_effect
            └─ infinite | <seconds>
                └─ <amplifier>
                    <...>  整数 · ≥0 · ≤255
                    └─ <hideParticles>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
                <...>  整数 · ≥1 · ≤1000000
                └─ <amplifier>
                    <...>  整数 · ≥0 · ≤255
                    └─ <hideParticles>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
```

## enchant

```
命令路径: enchant
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 实体 · 可多个
    └─ <enchantment>
        <...>  注册表条目 · 注册表:minecraft:enchantment
        └─ <level>
            <...>  整数 · ≥0
               ↳ 命令可在此结束
           ↳ 命令可在此结束
```

## execute

```
命令路径: execute
下一项(14选1): align | anchored | as | at | facing | if | in | on | positioned | rotated | run | store | summon | unless

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ align | anchored | as | at | facing | if | in | on | positioned | rotated | run | store | summon | unless
    └─ <axes>
        <...>  轴序,如 xyz、xz
           ↻ 链回: execute (可继续跟该命令的后续子命令)
    └─ <anchor>
        <...>  锚点: eyes | feet
    └─ <targets>
        <...>  实体/玩家选择器 · 实体 · 可多个
    └─ <targets>
        <...>  实体/玩家选择器 · 实体 · 可多个
    └─ entity | <pos>
        └─ <targets>
            <...>  实体/玩家选择器 · 实体 · 可多个
            └─ <anchor>
                <...>  锚点: eyes | feet
        <...>  3D 坐标 x y z
    └─ biome | block | blocks | data | dimension | entity | function | items | loaded | predicate | score | stopwatch
        └─ <pos>
            <...>  方块坐标 x y z
            └─ <biome>
                <...>  ID 或 #标签 · 注册表:minecraft:worldgen/biome
                   ↳ 命令可在此结束
        └─ <pos>
            <...>  方块坐标 x y z
            └─ <block>
                <...>  方块谓词(ID/标签,可带状态谓词)
                   ↳ 命令可在此结束
        └─ <start>
            <...>  方块坐标 x y z
            └─ <end>
                <...>  方块坐标 x y z
                └─ <destination>
                    <...>  方块坐标 x y z
                    └─ all | masked   …(更深用 --depth=N)
        └─ block | entity | storage
            └─ <sourcePos>
                <...>  方块坐标 x y z
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
            └─ <source>
                <...>  实体/玩家选择器 · 实体 · 单个
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
            └─ <source>
                <...>  资源位置 ID,如 minecraft:diamond
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
        └─ <dimension>
            <...>  维度 ID,如 minecraft:overworld
               ↳ 命令可在此结束
        └─ <entities>
            <...>  实体/玩家选择器 · 实体 · 可多个
               ↳ 命令可在此结束
        └─ <name>
            <...>  函数 ID,如 minecraft:foo/bar
        └─ block | entity
            └─ <pos>
                <...>  方块坐标 x y z
                └─ <slots>
                    <...>  槽位集合,用 , 分隔
                    └─ <item_predicate>   …(更深用 --depth=N)
            └─ <entities>
                <...>  实体/玩家选择器 · 实体 · 可多个
                └─ <slots>
                    <...>  槽位集合,用 , 分隔
                    └─ <item_predicate>   …(更深用 --depth=N)
        └─ <pos>
            <...>  方块坐标 x y z
               ↳ 命令可在此结束
        └─ <predicate>
            <...>  战利品谓词表 ID
               ↳ 命令可在此结束
        └─ <target>
            <...>  计分板实体/名字(* 表示全部) · 单个
            └─ <targetObjective>
                <...>  计分板目标 ID
                └─ < | <= | = | > | >= | matches
                    └─ <source>   …(更深用 --depth=N)
                    └─ <source>   …(更深用 --depth=N)
                    └─ <source>   …(更深用 --depth=N)
                    └─ <source>   …(更深用 --depth=N)
                    └─ <source>   …(更深用 --depth=N)
                    └─ <range>   …(更深用 --depth=N)
        └─ <id>
            <...>  资源位置 ID,如 minecraft:diamond
            └─ <range>
                <...>  浮点区间,如 1.5..5
                   ↳ 命令可在此结束
    └─ <dimension>
        <...>  维度 ID,如 minecraft:overworld
    └─ attacker | controller | leasher | origin | owner | passengers | target | vehicle
    └─ as | over | <pos>
        └─ <targets>
            <...>  实体/玩家选择器 · 实体 · 可多个
        └─ <heightmap>
            <...>  高度图: world_surface|motion_blocking|ocean_floor|motion_blocking_no_leaves|ocean_floor_wg|world_surface_wg
        <...>  3D 坐标 x y z
    └─ as | <rot>
        └─ <targets>
            <...>  实体/玩家选择器 · 实体 · 可多个
        <...>  旋转 x y
    └─ result | success
        └─ block | bossbar | entity | score | storage
            └─ <targetPos>
                <...>  方块坐标 x y z
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                    └─ byte | double | float | int | long | short   …(更深用 --depth=N)
            └─ <id>
                <...>  资源位置 ID,如 minecraft:diamond
                └─ max | value
            └─ <target>
                <...>  实体/玩家选择器 · 实体 · 单个
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                    └─ byte | double | float | int | long | short   …(更深用 --depth=N)
            └─ <targets>
                <...>  计分板实体/名字(* 表示全部) · 可多个
                └─ <objective>
                    <...>  计分板目标 ID
            └─ <target>
                <...>  资源位置 ID,如 minecraft:diamond
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                    └─ byte | double | float | int | long | short   …(更深用 --depth=N)
        └─ block | bossbar | entity | score | storage
            └─ <targetPos>
                <...>  方块坐标 x y z
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                    └─ byte | double | float | int | long | short   …(更深用 --depth=N)
            └─ <id>
                <...>  资源位置 ID,如 minecraft:diamond
                └─ max | value
            └─ <target>
                <...>  实体/玩家选择器 · 实体 · 单个
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                    └─ byte | double | float | int | long | short   …(更深用 --depth=N)
            └─ <targets>
                <...>  计分板实体/名字(* 表示全部) · 可多个
                └─ <objective>
                    <...>  计分板目标 ID
            └─ <target>
                <...>  资源位置 ID,如 minecraft:diamond
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                    └─ byte | double | float | int | long | short   …(更深用 --depth=N)
    └─ <entity>
        <...>  注册表条目 · 注册表:minecraft:entity_type
    └─ biome | block | blocks | data | dimension | entity | function | items | loaded | predicate | score | stopwatch
        └─ <pos>
            <...>  方块坐标 x y z
            └─ <biome>
                <...>  ID 或 #标签 · 注册表:minecraft:worldgen/biome
                   ↳ 命令可在此结束
        └─ <pos>
            <...>  方块坐标 x y z
            └─ <block>
                <...>  方块谓词(ID/标签,可带状态谓词)
                   ↳ 命令可在此结束
        └─ <start>
            <...>  方块坐标 x y z
            └─ <end>
                <...>  方块坐标 x y z
                └─ <destination>
                    <...>  方块坐标 x y z
                    └─ all | masked   …(更深用 --depth=N)
        └─ block | entity | storage
            └─ <sourcePos>
                <...>  方块坐标 x y z
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
            └─ <source>
                <...>  实体/玩家选择器 · 实体 · 单个
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
            └─ <source>
                <...>  资源位置 ID,如 minecraft:diamond
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
        └─ <dimension>
            <...>  维度 ID,如 minecraft:overworld
               ↳ 命令可在此结束
        └─ <entities>
            <...>  实体/玩家选择器 · 实体 · 可多个
               ↳ 命令可在此结束
        └─ <name>
            <...>  函数 ID,如 minecraft:foo/bar
        └─ block | entity
            └─ <pos>
                <...>  方块坐标 x y z
                └─ <slots>
                    <...>  槽位集合,用 , 分隔
                    └─ <item_predicate>   …(更深用 --depth=N)
            └─ <entities>
                <...>  实体/玩家选择器 · 实体 · 可多个
                └─ <slots>
                    <...>  槽位集合,用 , 分隔
                    └─ <item_predicate>   …(更深用 --depth=N)
        └─ <pos>
            <...>  方块坐标 x y z
               ↳ 命令可在此结束
        └─ <predicate>
            <...>  战利品谓词表 ID
               ↳ 命令可在此结束
        └─ <target>
            <...>  计分板实体/名字(* 表示全部) · 单个
            └─ <targetObjective>
                <...>  计分板目标 ID
                └─ < | <= | = | > | >= | matches
                    └─ <source>   …(更深用 --depth=N)
                    └─ <source>   …(更深用 --depth=N)
                    └─ <source>   …(更深用 --depth=N)
                    └─ <source>   …(更深用 --depth=N)
                    └─ <source>   …(更深用 --depth=N)
                    └─ <range>   …(更深用 --depth=N)
        └─ <id>
            <...>  资源位置 ID,如 minecraft:diamond
            └─ <range>
                <...>  浮点区间,如 1.5..5
                   ↳ 命令可在此结束
```

## experience

```
命令路径: experience
下一项(3选1): add | query | set

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ add | query | set
    └─ <target>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
        └─ <amount>
            <...>  整数
            └─ levels | points
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
    └─ <target>
        <...>  实体/玩家选择器 · 限玩家 · 单个
        └─ levels | points
               ↳ 命令可在此结束
               ↳ 命令可在此结束
    └─ <target>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
        └─ <amount>
            <...>  整数 · ≥0
            └─ levels | points
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
```

## fetchprofile

```
命令路径: fetchprofile
下一项(3选1): entity | id | name

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ entity | id | name
    └─ <entity>
        <...>  实体/玩家选择器 · 实体 · 单个
           ↳ 命令可在此结束
    └─ <id>
        <...>  UUID
           ↳ 命令可在此结束
    └─ <name>
        <...>  字符串 · 到行尾
           ↳ 命令可在此结束
```

## fill

```
命令路径: fill
下一项: <from>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <from>
    <...>  方块坐标 x y z
    └─ <to>
        <...>  方块坐标 x y z
        └─ <block>
            <...>  方块状态,如 minecraft:stone[axis=y]
            └─ destroy | hollow | keep | outline | replace | strict
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                └─ <filter>
                    <...>  方块谓词(ID/标签,可带状态谓词)
                    └─ destroy | hollow | outline | strict   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
```

## fillbiome

```
命令路径: fillbiome
下一项: <from>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <from>
    <...>  方块坐标 x y z
    └─ <to>
        <...>  方块坐标 x y z
        └─ <biome>
            <...>  注册表条目 · 注册表:minecraft:worldgen/biome
            └─ replace
                └─ <filter>
                    <...>  ID 或 #标签 · 注册表:minecraft:worldgen/biome
                       ↳ 命令可在此结束
               ↳ 命令可在此结束
```

## forceload

```
命令路径: forceload
下一项(3选1): add | query | remove

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ add | query | remove
    └─ <from>
        <...>  列坐标
        └─ <to>
            <...>  列坐标
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <pos>
        <...>  列坐标
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ all | <from>
           ↳ 命令可在此结束
        <...>  列坐标
        └─ <to>
            <...>  列坐标
               ↳ 命令可在此结束
           ↳ 命令可在此结束
```

## function

```
命令路径: function
下一项: <name>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <name>
    <...>  函数 ID,如 minecraft:foo/bar
    └─ with | <arguments>
        <...>  NBT 复合标签,如 {id:"minecraft:stone"}
           ↳ 命令可在此结束
        └─ block | entity | storage
            └─ <sourcePos>
                <...>  方块坐标 x y z
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <source>
                <...>  实体/玩家选择器 · 实体 · 单个
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <source>
                <...>  资源位置 ID,如 minecraft:diamond
                └─ <path>
                    <...>  NBT 路径,如 Items[0].tag
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## gamemode

```
命令路径: gamemode
下一项: <gamemode>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <gamemode>
    <...>  游戏模式: survival|creative|adventure|spectator
    └─ <target>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## gamerule

```
命令路径: gamerule
下一项(118选1): advance_time | advance_weather | allow_entering_nether_using_portals | block_drops | block_explosion_drop_decay | command_block_output | command_blocks_work | drowning_damage | elytra_movement_check | ender_pearls_vanish_on_death | entity_drops | fall_damage | fire_damage | fire_spread_radius_around_player | forgive_dead_players | freeze_damage | global_sound_events | immediate_respawn | keep_inventory | lava_source_conversion | limited_crafting | locator_bar | log_admin_commands | max_block_modifications | max_command_forks | max_command_sequence_length | max_entity_cramming | max_minecart_speed | max_snow_accumulation_height | minecraft:advance_time | minecraft:advance_weather | minecraft:allow_entering_nether_using_portals | minecraft:block_drops | minecraft:block_explosion_drop_decay | minecraft:command_block_output | minecraft:command_blocks_work | minecraft:drowning_damage | minecraft:elytra_movement_check | minecraft:ender_pearls_vanish_on_death | minecraft:entity_drops | minecraft:fall_damage | minecraft:fire_damage | minecraft:fire_spread_radius_around_player | minecraft:forgive_dead_players | minecraft:freeze_damage | minecraft:global_sound_events | minecraft:immediate_respawn | minecraft:keep_inventory | minecraft:lava_source_conversion | minecraft:limited_crafting | minecraft:locator_bar | minecraft:log_admin_commands | minecraft:max_block_modifications | minecraft:max_command_forks | minecraft:max_command_sequence_length | minecraft:max_entity_cramming | minecraft:max_minecart_speed | minecraft:max_snow_accumulation_height | minecraft:mob_drops | minecraft:mob_explosion_drop_decay | minecraft:mob_griefing | minecraft:natural_health_regeneration | minecraft:player_movement_check | minecraft:players_nether_portal_creative_delay | minecraft:players_nether_portal_default_delay | minecraft:players_sleeping_percentage | minecraft:projectiles_can_break_blocks | minecraft:pvp | minecraft:raids | minecraft:random_tick_speed | minecraft:reduced_debug_info | minecraft:respawn_radius | minecraft:send_command_feedback | minecraft:show_advancement_messages | minecraft:show_death_messages | minecraft:spawn_mobs | minecraft:spawn_monsters | minecraft:spawn_patrols | minecraft:spawn_phantoms | minecraft:spawn_wandering_traders | minecraft:spawn_wardens | minecraft:spawner_blocks_work | minecraft:spectators_generate_chunks | minecraft:spread_vines | minecraft:tnt_explodes | minecraft:tnt_explosion_drop_decay | minecraft:universal_anger | minecraft:water_source_conversion | mob_drops | mob_explosion_drop_decay | mob_griefing | natural_health_regeneration | player_movement_check | players_nether_portal_creative_delay | players_nether_portal_default_delay | players_sleeping_percentage | projectiles_can_break_blocks | pvp | raids | random_tick_speed | reduced_debug_info | respawn_radius | send_command_feedback | show_advancement_messages | show_death_messages | spawn_mobs | spawn_monsters | spawn_patrols | spawn_phantoms | spawn_wandering_traders | spawn_wardens | spawner_blocks_work | spectators_generate_chunks | spread_vines | tnt_explodes | tnt_explosion_drop_decay | universal_anger | water_source_conversion

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ advance_time | advance_weather | allow_entering_nether_using_portals | block_drops | block_explosion_drop_decay | command_block_output | command_blocks_work | drowning_damage | elytra_movement_check | ender_pearls_vanish_on_death | entity_drops | fall_damage | fire_damage | fire_spread_radius_around_player | forgive_dead_players | freeze_damage | global_sound_events | immediate_respawn | keep_inventory | lava_source_conversion | limited_crafting | locator_bar | log_admin_commands | max_block_modifications | max_command_forks | max_command_sequence_length | max_entity_cramming | max_minecart_speed | max_snow_accumulation_height | minecraft:advance_time | minecraft:advance_weather | minecraft:allow_entering_nether_using_portals | minecraft:block_drops | minecraft:block_explosion_drop_decay | minecraft:command_block_output | minecraft:command_blocks_work | minecraft:drowning_damage | minecraft:elytra_movement_check | minecraft:ender_pearls_vanish_on_death | minecraft:entity_drops | minecraft:fall_damage | minecraft:fire_damage | minecraft:fire_spread_radius_around_player | minecraft:forgive_dead_players | minecraft:freeze_damage | minecraft:global_sound_events | minecraft:immediate_respawn | minecraft:keep_inventory | minecraft:lava_source_conversion | minecraft:limited_crafting | minecraft:locator_bar | minecraft:log_admin_commands | minecraft:max_block_modifications | minecraft:max_command_forks | minecraft:max_command_sequence_length | minecraft:max_entity_cramming | minecraft:max_minecart_speed | minecraft:max_snow_accumulation_height | minecraft:mob_drops | minecraft:mob_explosion_drop_decay | minecraft:mob_griefing | minecraft:natural_health_regeneration | minecraft:player_movement_check | minecraft:players_nether_portal_creative_delay | minecraft:players_nether_portal_default_delay | minecraft:players_sleeping_percentage | minecraft:projectiles_can_break_blocks | minecraft:pvp | minecraft:raids | minecraft:random_tick_speed | minecraft:reduced_debug_info | minecraft:respawn_radius | minecraft:send_command_feedback | minecraft:show_advancement_messages | minecraft:show_death_messages | minecraft:spawn_mobs | minecraft:spawn_monsters | minecraft:spawn_patrols | minecraft:spawn_phantoms | minecraft:spawn_wandering_traders | minecraft:spawn_wardens | minecraft:spawner_blocks_work | minecraft:spectators_generate_chunks | minecraft:spread_vines | minecraft:tnt_explodes | minecraft:tnt_explosion_drop_decay | minecraft:universal_anger | minecraft:water_source_conversion | mob_drops | mob_explosion_drop_decay | mob_griefing | natural_health_regeneration | player_movement_check | players_nether_portal_creative_delay | players_nether_portal_default_delay | players_sleeping_percentage | projectiles_can_break_blocks | pvp | raids | random_tick_speed | reduced_debug_info | respawn_radius | send_command_feedback | show_advancement_messages | show_death_messages | spawn_mobs | spawn_monsters | spawn_patrols | spawn_phantoms | spawn_wandering_traders | spawn_wardens | spawner_blocks_work | spectators_generate_chunks | spread_vines | tnt_explodes | tnt_explosion_drop_decay | universal_anger | water_source_conversion
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥-1
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥1
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥1 · ≤1000
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0 · ≤8
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥-1
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥1
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥1 · ≤1000
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0 · ≤8
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  整数 · ≥0
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <value>
        <...>  布尔值
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## give

```
命令路径: give
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 限玩家 · 可多个
    └─ <item>
        <...>  物品堆,如 minecraft:diamond_sword 1
        └─ <count>
            <...>  整数 · ≥1
               ↳ 命令可在此结束
           ↳ 命令可在此结束
```

## help

```
命令路径: help
下一项: <command>
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <command>
    <...>  字符串 · 到行尾
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## item

```
命令路径: item
下一项(2选1): modify | replace

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ modify | replace
    └─ block | entity
        └─ <pos>
            <...>  方块坐标 x y z
            └─ <slot>
                <...>  物品栏槽位,如 armor.head、weapon.mainhand
                └─ <modifier>
                    <...>  战利品修饰表 ID
                       ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 实体 · 可多个
            └─ <slot>
                <...>  物品栏槽位,如 armor.head、weapon.mainhand
                └─ <modifier>
                    <...>  战利品修饰表 ID
                       ↳ 命令可在此结束
    └─ block | entity
        └─ <pos>
            <...>  方块坐标 x y z
            └─ <slot>
                <...>  物品栏槽位,如 armor.head、weapon.mainhand
                └─ from | with
                    └─ block | entity   …(更深用 --depth=N)
                    └─ <item>   …(更深用 --depth=N)
        └─ <targets>
            <...>  实体/玩家选择器 · 实体 · 可多个
            └─ <slot>
                <...>  物品栏槽位,如 armor.head、weapon.mainhand
                └─ from | with
                    └─ block | entity   …(更深用 --depth=N)
                    └─ <item>   …(更深用 --depth=N)
```

## jfr

```
命令路径: jfr
下一项(2选1): start | stop

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ start | stop
       ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## kick

```
命令路径: kick
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 限玩家 · 可多个
    └─ <reason>
        <...>  消息文本(支持 @s 等选择器)
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## kill

```
命令路径: kill
下一项: <targets>
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 实体 · 可多个
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## list

```
命令路径: list
下一项: uuids
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ uuids
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## locate

```
命令路径: locate
下一项(3选1): biome | poi | structure

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ biome | poi | structure
    └─ <biome>
        <...>  ID 或 #标签 · 注册表:minecraft:worldgen/biome
           ↳ 命令可在此结束
    └─ <poi>
        <...>  ID 或 #标签 · 注册表:minecraft:point_of_interest_type
           ↳ 命令可在此结束
    └─ <structure>
        <...>  ID 或 #标签(键) · 注册表:minecraft:worldgen/structure
           ↳ 命令可在此结束
```

## loot

```
命令路径: loot
下一项(4选1): give | insert | replace | spawn

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ give | insert | replace | spawn
    └─ <players>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
        └─ fish | kill | loot | mine
            └─ <loot_table>
                <...>  战利品表 ID
                └─ <pos>
                    <...>  方块坐标 x y z
                    └─ mainhand | offhand | <tool>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
            └─ <target>
                <...>  实体/玩家选择器 · 实体 · 单个
                   ↳ 命令可在此结束
            └─ <loot_table>
                <...>  战利品表 ID
                   ↳ 命令可在此结束
            └─ <pos>
                <...>  方块坐标 x y z
                └─ mainhand | offhand | <tool>
                       ↳ 命令可在此结束
                       ↳ 命令可在此结束
                    <...>  物品堆,如 minecraft:diamond_sword 1
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
    └─ <targetPos>
        <...>  方块坐标 x y z
        └─ fish | kill | loot | mine
            └─ <loot_table>
                <...>  战利品表 ID
                └─ <pos>
                    <...>  方块坐标 x y z
                    └─ mainhand | offhand | <tool>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
            └─ <target>
                <...>  实体/玩家选择器 · 实体 · 单个
                   ↳ 命令可在此结束
            └─ <loot_table>
                <...>  战利品表 ID
                   ↳ 命令可在此结束
            └─ <pos>
                <...>  方块坐标 x y z
                └─ mainhand | offhand | <tool>
                       ↳ 命令可在此结束
                       ↳ 命令可在此结束
                    <...>  物品堆,如 minecraft:diamond_sword 1
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
    └─ block | entity
        └─ <targetPos>
            <...>  方块坐标 x y z
            └─ <slot>
                <...>  物品栏槽位,如 armor.head、weapon.mainhand
                └─ fish | kill | loot | mine | <count>
                    <...>  整数 · ≥0
                    └─ fish | kill | loot | mine   …(更深用 --depth=N)
                    └─ <loot_table>   …(更深用 --depth=N)
                    └─ <target>   …(更深用 --depth=N)
                    └─ <loot_table>   …(更深用 --depth=N)
                    └─ <pos>   …(更深用 --depth=N)
        └─ <entities>
            <...>  实体/玩家选择器 · 实体 · 可多个
            └─ <slot>
                <...>  物品栏槽位,如 armor.head、weapon.mainhand
                └─ fish | kill | loot | mine | <count>
                    <...>  整数 · ≥0
                    └─ fish | kill | loot | mine   …(更深用 --depth=N)
                    └─ <loot_table>   …(更深用 --depth=N)
                    └─ <target>   …(更深用 --depth=N)
                    └─ <loot_table>   …(更深用 --depth=N)
                    └─ <pos>   …(更深用 --depth=N)
    └─ <targetPos>
        <...>  3D 坐标 x y z
        └─ fish | kill | loot | mine
            └─ <loot_table>
                <...>  战利品表 ID
                └─ <pos>
                    <...>  方块坐标 x y z
                    └─ mainhand | offhand | <tool>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
            └─ <target>
                <...>  实体/玩家选择器 · 实体 · 单个
                   ↳ 命令可在此结束
            └─ <loot_table>
                <...>  战利品表 ID
                   ↳ 命令可在此结束
            └─ <pos>
                <...>  方块坐标 x y z
                └─ mainhand | offhand | <tool>
                       ↳ 命令可在此结束
                       ↳ 命令可在此结束
                    <...>  物品堆,如 minecraft:diamond_sword 1
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
```

## me

```
命令路径: me
下一项: <action>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <action>
    <...>  消息文本(支持 @s 等选择器)
       ↳ 命令可在此结束
```

## msg

```
命令路径: msg
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 限玩家 · 可多个
    └─ <message>
        <...>  消息文本(支持 @s 等选择器)
           ↳ 命令可在此结束
```

## op

```
命令路径: op
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  玩家名或玩家选择器
       ↳ 命令可在此结束
```

## pardon

```
命令路径: pardon
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  玩家名或玩家选择器
       ↳ 命令可在此结束
```

## pardon-ip

```
命令路径: pardon-ip
下一项: <target>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <target>
    <...>  字符串 · 单词
       ↳ 命令可在此结束
```

## particle

```
命令路径: particle
下一项: <name>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <name>
    <...>  粒子 ID,如 minecraft:crit
    └─ <pos>
        <...>  3D 坐标 x y z
        └─ <delta>
            <...>  3D 坐标 x y z
            └─ <speed>
                <...>  浮点数 · ≥0
                └─ <count>
                    <...>  整数 · ≥0
                    └─ force | normal   …(更深用 --depth=N)
                       ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## perf

```
命令路径: perf
下一项(2选1): start | stop

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ start | stop
       ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## place

```
命令路径: place
下一项(4选1): feature | jigsaw | structure | template

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ feature | jigsaw | structure | template
    └─ <feature>
        <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:worldgen/configured_feature
        └─ <pos>
            <...>  方块坐标 x y z
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <pool>
        <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:worldgen/template_pool
        └─ <target>
            <...>  资源位置 ID,如 minecraft:diamond
            └─ <max_depth>
                <...>  整数 · ≥1 · ≤20
                └─ <position>
                    <...>  方块坐标 x y z
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
    └─ <structure>
        <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:worldgen/structure
        └─ <pos>
            <...>  方块坐标 x y z
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <template>
        <...>  资源位置 ID,如 minecraft:diamond
        └─ <pos>
            <...>  方块坐标 x y z
            └─ <rotation>
                <...>  结构旋转: none|clockwise_90|counterclockwise_90|180
                └─ <mirror>
                    <...>  结构镜像: none|left_right|front_back
                    └─ <integrity>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
```

## playsound

```
命令路径: playsound
下一项: <sound>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <sound>
    <...>  资源位置 ID,如 minecraft:diamond
    └─ ambient | block | hostile | master | music | neutral | player | record | ui | voice | weather
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
            └─ <pos>
                <...>  3D 坐标 x y z
                └─ <volume>
                    <...>  浮点数 · ≥0
                    └─ <pitch>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## publish

```
命令路径: publish
下一项: <allowCommands>
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <allowCommands>
    <...>  布尔值
    └─ <gamemode>
        <...>  游戏模式: survival|creative|adventure|spectator
        └─ <port>
            <...>  整数 · ≥0 · ≤65535
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## random

```
命令路径: random
下一项(3选1): reset | roll | value

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ reset | roll | value
    └─ * | <sequence>
        └─ <seed>
            <...>  整数
            └─ <includeWorldSeed>
                <...>  布尔值
                └─ <includeSequenceId>
                    <...>  布尔值
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        <...>  资源位置 ID,如 minecraft:diamond
        └─ <seed>
            <...>  整数
            └─ <includeWorldSeed>
                <...>  布尔值
                └─ <includeSequenceId>
                    <...>  布尔值
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <range>
        <...>  整数区间,如 1..5
        └─ <sequence>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <range>
        <...>  整数区间,如 1..5
        └─ <sequence>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
```

## recipe

```
命令路径: recipe
下一项(2选1): give | take

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ give | take
    └─ <targets>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
        └─ * | <recipe>
               ↳ 命令可在此结束
            <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:recipe
               ↳ 命令可在此结束
    └─ <targets>
        <...>  实体/玩家选择器 · 限玩家 · 可多个
        └─ * | <recipe>
               ↳ 命令可在此结束
            <...>  注册表键(可省略 minecraft:) · 注册表:minecraft:recipe
               ↳ 命令可在此结束
```

## reload

```
命令路径: reload
【命令可在此结束】
```

## return

```
命令路径: return
下一项(3选1): fail | run | <value>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ fail | run | <value>
       ↳ 命令可在此结束
    <...>  整数
       ↳ 命令可在此结束
```

## ride

```
命令路径: ride
下一项: <target>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <target>
    <...>  实体/玩家选择器 · 实体 · 单个
    └─ dismount | mount
           ↳ 命令可在此结束
        └─ <vehicle>
            <...>  实体/玩家选择器 · 实体 · 单个
               ↳ 命令可在此结束
```

## rotate

```
命令路径: rotate
下一项: <target>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <target>
    <...>  实体/玩家选择器 · 实体 · 单个
    └─ facing | <rotation>
        └─ entity | <facingLocation>
            └─ <facingEntity>
                <...>  实体/玩家选择器 · 实体 · 单个
                └─ <facingAnchor>
                    <...>  锚点: eyes | feet
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
            <...>  3D 坐标 x y z
               ↳ 命令可在此结束
        <...>  旋转 x y
           ↳ 命令可在此结束
```

## save-all

```
命令路径: save-all
下一项: flush
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ flush
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## save-off

```
命令路径: save-off
【命令可在此结束】
```

## save-on

```
命令路径: save-on
【命令可在此结束】
```

## say

```
命令路径: say
下一项: <message>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <message>
    <...>  消息文本(支持 @s 等选择器)
       ↳ 命令可在此结束
```

## schedule

```
命令路径: schedule
下一项(2选1): clear | function

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ clear | function
    └─ <function>
        <...>  字符串 · 到行尾
           ↳ 命令可在此结束
    └─ <function>
        <...>  函数 ID,如 minecraft:foo/bar
        └─ <time>
            <...>  游戏刻数 · ≥0
            └─ append | replace
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
```

## scoreboard

```
命令路径: scoreboard
下一项(2选1): objectives | players

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ objectives | players
    └─ add | list | modify | remove | setdisplay
        └─ <objective>
            <...>  字符串 · 单词
            └─ <criteria>
                <...>  计分板判据,如 minecraft:damage_taken
                └─ <displayName>
                    <...>  数据组件 ID,如 minecraft:damage、minecraft:food
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <objective>
            <...>  计分板目标 ID
            └─ displayautoupdate | displayname | numberformat | rendertype
                └─ <value>
                    <...>  布尔值
                       ↳ 命令可在此结束
                └─ <displayName>
                    <...>  数据组件 ID,如 minecraft:damage、minecraft:food
                       ↳ 命令可在此结束
                └─ blank | fixed | styled
                       ↳ 命令可在此结束
                    └─ <contents>   …(更深用 --depth=N)
                    └─ <style>   …(更深用 --depth=N)
                   ↳ 命令可在此结束
                └─ hearts | integer
                       ↳ 命令可在此结束
                       ↳ 命令可在此结束
        └─ <objective>
            <...>  计分板目标 ID
               ↳ 命令可在此结束
        └─ <slot>
            <...>  计分板槽位,如 sidebar、red.green
            └─ <objective>
                <...>  计分板目标 ID
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
    └─ add | display | enable | get | list | operation | remove | reset | set
        └─ <targets>
            <...>  计分板实体/名字(* 表示全部) · 可多个
            └─ <objective>
                <...>  计分板目标 ID
                └─ <score>
                    <...>  整数 · ≥0
                       ↳ 命令可在此结束
        └─ name | numberformat
            └─ <targets>
                <...>  计分板实体/名字(* 表示全部) · 可多个
                └─ <objective>
                    <...>  计分板目标 ID
                    └─ <name>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
            └─ <targets>
                <...>  计分板实体/名字(* 表示全部) · 可多个
                └─ <objective>
                    <...>  计分板目标 ID
                    └─ blank | fixed | styled   …(更深用 --depth=N)
                       ↳ 命令可在此结束
        └─ <targets>
            <...>  计分板实体/名字(* 表示全部) · 可多个
            └─ <objective>
                <...>  计分板目标 ID
                   ↳ 命令可在此结束
        └─ <target>
            <...>  计分板实体/名字(* 表示全部) · 单个
            └─ <objective>
                <...>  计分板目标 ID
                   ↳ 命令可在此结束
        └─ <target>
            <...>  计分板实体/名字(* 表示全部) · 单个
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <targets>
            <...>  计分板实体/名字(* 表示全部) · 可多个
            └─ <targetObjective>
                <...>  计分板目标 ID
                └─ <operation>
                    <...>  计分板操作: += -= *= /= %= = < > ><
                    └─ <source>   …(更深用 --depth=N)
        └─ <targets>
            <...>  计分板实体/名字(* 表示全部) · 可多个
            └─ <objective>
                <...>  计分板目标 ID
                └─ <score>
                    <...>  整数 · ≥0
                       ↳ 命令可在此结束
        └─ <targets>
            <...>  计分板实体/名字(* 表示全部) · 可多个
            └─ <objective>
                <...>  计分板目标 ID
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
        └─ <targets>
            <...>  计分板实体/名字(* 表示全部) · 可多个
            └─ <objective>
                <...>  计分板目标 ID
                └─ <score>
                    <...>  整数
                       ↳ 命令可在此结束
```

## seed

```
命令路径: seed
【命令可在此结束】
```

## setblock

```
命令路径: setblock
下一项: <pos>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <pos>
    <...>  方块坐标 x y z
    └─ <block>
        <...>  方块状态,如 minecraft:stone[axis=y]
        └─ destroy | keep | replace | strict
               ↳ 命令可在此结束
               ↳ 命令可在此结束
               ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
```

## setidletimeout

```
命令路径: setidletimeout
下一项: <minutes>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <minutes>
    <...>  整数 · ≥0
       ↳ 命令可在此结束
```

## setworldspawn

```
命令路径: setworldspawn
下一项: <pos>
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <pos>
    <...>  方块坐标 x y z
    └─ <rotation>
        <...>  旋转 x y
           ↳ 命令可在此结束
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## spawnpoint

```
命令路径: spawnpoint
下一项: <targets>
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 限玩家 · 可多个
    └─ <pos>
        <...>  方块坐标 x y z
        └─ <rotation>
            <...>  旋转 x y
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## spectate

```
命令路径: spectate
下一项: <target>
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <target>
    <...>  实体/玩家选择器 · 实体 · 单个
    └─ <player>
        <...>  实体/玩家选择器 · 限玩家 · 单个
           ↳ 命令可在此结束
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## spreadplayers

```
命令路径: spreadplayers
下一项: <center>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <center>
    <...>  2D 坐标 x y
    └─ <spreadDistance>
        <...>  浮点数 · ≥0
        └─ <maxRange>
            <...>  浮点数 · ≥1
            └─ under | <respectTeams>
                <...>  布尔值
                └─ <targets>
                    <...>  实体/玩家选择器 · 实体 · 可多个
                       ↳ 命令可在此结束
                └─ <maxHeight>
                    <...>  整数
                    └─ <respectTeams>   …(更深用 --depth=N)
```

## stop

```
命令路径: stop
【命令可在此结束】
```

## stopsound

```
命令路径: stopsound
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 限玩家 · 可多个
    └─ * | ambient | block | hostile | master | music | neutral | player | record | ui | voice | weather
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <sound>
            <...>  资源位置 ID,如 minecraft:diamond
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## stopwatch

```
命令路径: stopwatch
下一项(4选1): create | query | remove | restart

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ create | query | remove | restart
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
           ↳ 命令可在此结束
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
        └─ <scale>
            <...>  浮点数
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
           ↳ 命令可在此结束
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
           ↳ 命令可在此结束
```

## summon

```
命令路径: summon
下一项: <entity>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <entity>
    <...>  注册表条目 · 注册表:minecraft:entity_type
    └─ <pos>
        <...>  3D 坐标 x y z
        └─ <nbt>
            <...>  NBT 复合标签,如 {id:"minecraft:stone"}
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## swing

```
命令路径: swing
下一项: <targets>
【命令可在此结束】

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 实体 · 可多个
    └─ mainhand | offhand
           ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
   ↳ 命令可在此结束
```

## tag

```
命令路径: tag
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 实体 · 可多个
    └─ add | list | remove
        └─ <name>
            <...>  字符串 · 单词
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <name>
            <...>  字符串 · 单词
               ↳ 命令可在此结束
```

## team

```
命令路径: team
下一项(7选1): add | empty | join | leave | list | modify | remove

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ add | empty | join | leave | list | modify | remove
    └─ <team>
        <...>  字符串 · 单词
        └─ <displayName>
            <...>  数据组件 ID,如 minecraft:damage、minecraft:food
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <team>
        <...>  队伍 ID
           ↳ 命令可在此结束
    └─ <team>
        <...>  队伍 ID
        └─ <members>
            <...>  计分板实体/名字(* 表示全部) · 可多个
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <members>
        <...>  计分板实体/名字(* 表示全部) · 可多个
           ↳ 命令可在此结束
    └─ <team>
        <...>  队伍 ID
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <team>
        <...>  队伍 ID
        └─ collisionRule | color | deathMessageVisibility | displayName | friendlyFire | nametagVisibility | prefix | seeFriendlyInvisibles | suffix
            └─ always | never | pushOtherTeams | pushOwnTeam
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ reset | <value>
                   ↳ 命令可在此结束
                <...>  队伍颜色
                   ↳ 命令可在此结束
            └─ always | hideForOtherTeams | hideForOwnTeam | never
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <displayName>
                <...>  数据组件 ID,如 minecraft:damage、minecraft:food
                   ↳ 命令可在此结束
            └─ <allowed>
                <...>  布尔值
                   ↳ 命令可在此结束
            └─ always | hideForOtherTeams | hideForOwnTeam | never
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <prefix>
                <...>  数据组件 ID,如 minecraft:damage、minecraft:food
                   ↳ 命令可在此结束
            └─ <allowed>
                <...>  布尔值
                   ↳ 命令可在此结束
            └─ <suffix>
                <...>  数据组件 ID,如 minecraft:damage、minecraft:food
                   ↳ 命令可在此结束
    └─ <team>
        <...>  队伍 ID
           ↳ 命令可在此结束
```

## teammsg

```
命令路径: teammsg
下一项: <message>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <message>
    <...>  消息文本(支持 @s 等选择器)
       ↳ 命令可在此结束
```

## teleport

```
命令路径: teleport
下一项(3选1): <destination> | <location> | <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <destination> | <location> | <targets>
    <...>  实体/玩家选择器 · 实体 · 单个
       ↳ 命令可在此结束
    <...>  3D 坐标 x y z
       ↳ 命令可在此结束
    <...>  实体/玩家选择器 · 实体 · 可多个
    └─ <destination> | <location>
        <...>  实体/玩家选择器 · 实体 · 单个
           ↳ 命令可在此结束
        <...>  3D 坐标 x y z
        └─ facing | <rotation>
            └─ entity | <facingLocation>
                └─ <facingEntity>
                    <...>  实体/玩家选择器 · 实体 · 单个
                    └─ <facingAnchor>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                <...>  3D 坐标 x y z
                   ↳ 命令可在此结束
            <...>  旋转 x y
               ↳ 命令可在此结束
           ↳ 命令可在此结束
```

## tell

```
命令路径: tell
↻ 之后继续(redirect → msg): msg
```

## tellraw

```
命令路径: tellraw
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 限玩家 · 可多个
    └─ <message>
        <...>  数据组件 ID,如 minecraft:damage、minecraft:food
           ↳ 命令可在此结束
```

## test

```
命令路径: test
下一项(17选1): clearall | clearthat | clearthese | create | locate | pos | resetclosest | resetthat | resetthese | run | runclosest | runfailed | runmultiple | runthat | runthese | stop | verify

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ clearall | clearthat | clearthese | create | locate | pos | resetclosest | resetthat | resetthese | run | runclosest | runfailed | runmultiple | runthat | runthese | stop | verify
    └─ <radius>
        <...>  整数
           ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <id>
        <...>  资源位置 ID,如 minecraft:diamond
        └─ <width>
            <...>  整数
            └─ <height>
                <...>  整数
                └─ <depth>
                    <...>  整数
                       ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <tests>
        <...>  资源选择器 · 注册表:minecraft:test_instance
           ↳ 命令可在此结束
    └─ <var>
        <...>  字符串 · 单词
           ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <tests>
        <...>  资源选择器 · 注册表:minecraft:test_instance
        └─ <numberOfTimes>
            <...>  整数 · ≥0
            └─ <untilFailed>
                <...>  布尔值
                └─ <rotationSteps>
                    <...>  整数
                    └─ <testsPerRow>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <numberOfTimes>
        <...>  整数 · ≥0
        └─ <untilFailed>
            <...>  布尔值
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <numberOfTimes> | <onlyRequiredTests>
        <...>  整数 · ≥0
        └─ <untilFailed>
            <...>  布尔值
            └─ <rotationSteps>
                <...>  整数
                └─ <testsPerRow>
                    <...>  整数
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
        <...>  布尔值
        └─ <numberOfTimes>
            <...>  整数 · ≥0
            └─ <untilFailed>
                <...>  布尔值
                └─ <rotationSteps>
                    <...>  整数
                    └─ <testsPerRow>   …(更深用 --depth=N)
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <tests>
        <...>  资源选择器 · 注册表:minecraft:test_instance
        └─ <amount>
            <...>  整数
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <numberOfTimes>
        <...>  整数 · ≥0
        └─ <untilFailed>
            <...>  布尔值
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <numberOfTimes>
        <...>  整数 · ≥0
        └─ <untilFailed>
            <...>  布尔值
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <tests>
        <...>  资源选择器 · 注册表:minecraft:test_instance
           ↳ 命令可在此结束
```

## tick

```
命令路径: tick
下一项(6选1): freeze | query | rate | sprint | step | unfreeze

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ freeze | query | rate | sprint | step | unfreeze
       ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <rate>
        <...>  浮点数 · ≥1 · ≤10000
           ↳ 命令可在此结束
    └─ stop | <time>
           ↳ 命令可在此结束
        <...>  游戏刻数 · ≥1
           ↳ 命令可在此结束
    └─ stop | <time>
           ↳ 命令可在此结束
        <...>  游戏刻数 · ≥1
           ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## time

```
命令路径: time
下一项(7选1): add | of | pause | query | rate | resume | set

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ add | of | pause | query | rate | resume | set
    └─ <time>
        <...>  游戏刻数 · ≥-2147483648
           ↳ 命令可在此结束
    └─ <clock>
        <...>  注册表条目 · 注册表:minecraft:world_clock
        └─ add | pause | query | rate | resume | set
            └─ <time>
                <...>  游戏刻数 · ≥-2147483648
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
            └─ time | <timeline>
                   ↳ 命令可在此结束
                <...>  注册表条目 · 注册表:minecraft:timeline
                └─ repetition
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ <rate>
                <...>  浮点数 · ≥0.00001 · ≤1000
                   ↳ 命令可在此结束
               ↳ 命令可在此结束
            └─ <time> | <timemarker>
                <...>  游戏刻数 · ≥0
                   ↳ 命令可在此结束
                <...>  资源位置 ID,如 minecraft:diamond
                   ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ gametime | time | <timeline>
           ↳ 命令可在此结束
           ↳ 命令可在此结束
        <...>  注册表条目 · 注册表:minecraft:timeline
        └─ repetition
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <rate>
        <...>  浮点数 · ≥0.00001 · ≤1000
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <time> | <timemarker>
        <...>  游戏刻数 · ≥0
           ↳ 命令可在此结束
        <...>  资源位置 ID,如 minecraft:diamond
           ↳ 命令可在此结束
```

## title

```
命令路径: title
下一项: <targets>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <targets>
    <...>  实体/玩家选择器 · 限玩家 · 可多个
    └─ actionbar | clear | reset | subtitle | times | title
        └─ <title>
            <...>  数据组件 ID,如 minecraft:damage、minecraft:food
               ↳ 命令可在此结束
           ↳ 命令可在此结束
           ↳ 命令可在此结束
        └─ <title>
            <...>  数据组件 ID,如 minecraft:damage、minecraft:food
               ↳ 命令可在此结束
        └─ <fadeIn>
            <...>  游戏刻数 · ≥0
            └─ <stay>
                <...>  游戏刻数 · ≥0
                └─ <fadeOut>
                    <...>  游戏刻数 · ≥0
                       ↳ 命令可在此结束
        └─ <title>
            <...>  数据组件 ID,如 minecraft:damage、minecraft:food
               ↳ 命令可在此结束
```

## tm

```
命令路径: tm
↻ 之后继续(redirect → teammsg): teammsg
```

## tp

```
命令路径: tp
↻ 之后继续(redirect → teleport): teleport
```

## transfer

```
命令路径: transfer
下一项: <hostname>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <hostname>
    <...>  字符串 · 短语(可引号)
    └─ <port>
        <...>  整数 · ≥1 · ≤65535
        └─ <players>
            <...>  实体/玩家选择器 · 限玩家 · 可多个
               ↳ 命令可在此结束
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## trigger

```
命令路径: trigger
下一项: <objective>

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ <objective>
    <...>  计分板目标 ID
    └─ add | set
        └─ <value>
            <...>  整数
               ↳ 命令可在此结束
        └─ <value>
            <...>  整数
               ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## unpublish

```
命令路径: unpublish
【命令可在此结束】
```

## version

```
命令路径: version
【命令可在此结束】
```

## w

```
命令路径: w
↻ 之后继续(redirect → msg): msg
```

## waypoint

```
命令路径: waypoint
下一项(2选1): list | modify

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ list | modify
       ↳ 命令可在此结束
    └─ <waypoint>
        <...>  实体/玩家选择器 · 实体 · 单个
        └─ color | style
            └─ hex | reset | <color>
                <...>  队伍颜色
                   ↳ 命令可在此结束
                └─ <color>
                    <...>  十六进制颜色 #rrggbb
                       ↳ 命令可在此结束
                   ↳ 命令可在此结束
            └─ reset | set
                   ↳ 命令可在此结束
                └─ <style>
                    <...>  资源位置 ID,如 minecraft:diamond
                       ↳ 命令可在此结束
```

## weather

```
命令路径: weather
下一项(3选1): clear | rain | thunder

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ clear | rain | thunder
    └─ <duration>
        <...>  游戏刻数 · ≥1
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <duration>
        <...>  游戏刻数 · ≥1
           ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <duration>
        <...>  游戏刻数 · ≥1
           ↳ 命令可在此结束
       ↳ 命令可在此结束
```

## whitelist

```
命令路径: whitelist
下一项(6选1): add | list | off | on | reload | remove

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ add | list | off | on | reload | remove
    └─ <targets>
        <...>  玩家名或玩家选择器
           ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <targets>
        <...>  玩家名或玩家选择器
           ↳ 命令可在此结束
```

## worldborder

```
命令路径: worldborder
下一项(6选1): add | center | damage | get | set | warning

— 展开 (depth=4,不跟随 redirect 以防循环) —
└─ add | center | damage | get | set | warning
    └─ <distance>
        <...>  浮点数 · ≥-59999968 · ≤59999968
        └─ <time>
            <...>  游戏刻数 · ≥0
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ <pos>
        <...>  2D 坐标 x y
           ↳ 命令可在此结束
    └─ amount | buffer
        └─ <damagePerBlock>
            <...>  浮点数 · ≥0
               ↳ 命令可在此结束
        └─ <distance>
            <...>  浮点数 · ≥0
               ↳ 命令可在此结束
       ↳ 命令可在此结束
    └─ <distance>
        <...>  浮点数 · ≥-59999968 · ≤59999968
        └─ <time>
            <...>  游戏刻数 · ≥0
               ↳ 命令可在此结束
           ↳ 命令可在此结束
    └─ distance | time
        └─ <distance>
            <...>  整数 · ≥0
               ↳ 命令可在此结束
        └─ <time>
            <...>  游戏刻数 · ≥0
               ↳ 命令可在此结束
```

## xp

```
命令路径: xp
↻ 之后继续(redirect → experience): experience
```
