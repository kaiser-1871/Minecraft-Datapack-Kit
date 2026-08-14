# 26.2 command reference (generated offline by dpkit)

> Grammar from Spyglass's cached 26.2 command tree (92 top-level commands).
> Regenerate: node dpkit.mjs --dump-all [--depth=N] [--version=<v>]

## advancement

```
Command path: advancement
Next (2 alternatives): grant | revoke

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ grant | revoke
    └─ <targets>
        <...>  Entity / player selector · players only · multiple allowed
        └─ everything | from | only | through | until
               ↳ command may end here
            └─ <advancement>
                <...>  Registry key (minecraft: prefix optional) · registry:minecraft:advancement
                   ↳ command may end here
            └─ <advancement>
                <...>  Registry key (minecraft: prefix optional) · registry:minecraft:advancement
                └─ <criterion>
                    <...>  String · to end of line
                       ↳ command may end here
                   ↳ command may end here
            └─ <advancement>
                <...>  Registry key (minecraft: prefix optional) · registry:minecraft:advancement
                   ↳ command may end here
            └─ <advancement>
                <...>  Registry key (minecraft: prefix optional) · registry:minecraft:advancement
                   ↳ command may end here
    └─ <targets>
        <...>  Entity / player selector · players only · multiple allowed
        └─ everything | from | only | through | until
               ↳ command may end here
            └─ <advancement>
                <...>  Registry key (minecraft: prefix optional) · registry:minecraft:advancement
                   ↳ command may end here
            └─ <advancement>
                <...>  Registry key (minecraft: prefix optional) · registry:minecraft:advancement
                └─ <criterion>
                    <...>  String · to end of line
                       ↳ command may end here
                   ↳ command may end here
            └─ <advancement>
                <...>  Registry key (minecraft: prefix optional) · registry:minecraft:advancement
                   ↳ command may end here
            └─ <advancement>
                <...>  Registry key (minecraft: prefix optional) · registry:minecraft:advancement
                   ↳ command may end here
```

## attribute

```
Command path: attribute
Next: <target>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <target>
    <...>  Entity / player selector · entities · single
    └─ <attribute>
        <...>  Registry entry · registry:minecraft:attribute
        └─ base | get | modifier
            └─ get | reset | set
                └─ <scale>
                    <...>  Double (floating-point number)
                       ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                └─ <value>
                    <...>  Double (floating-point number)
                       ↳ command may end here
            └─ <scale>
                <...>  Double (floating-point number)
                   ↳ command may end here
               ↳ command may end here
            └─ add | remove | value
                └─ <id>
                    <...>  Resource location ID, e.g. minecraft:diamond
                    └─ <value>   …(deeper: use --depth=N)
                └─ <id>
                    <...>  Resource location ID, e.g. minecraft:diamond
                       ↳ command may end here
                └─ get
                    └─ <id>   …(deeper: use --depth=N)
```

## ban

```
Command path: ban
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Player name or player selector
    └─ <reason>
        <...>  Message text (supports @s etc. selectors)
           ↳ command may end here
       ↳ command may end here
```

## ban-ip

```
Command path: ban-ip
Next: <target>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <target>
    <...>  String · word
    └─ <reason>
        <...>  Message text (supports @s etc. selectors)
           ↳ command may end here
       ↳ command may end here
```

## banlist

```
Command path: banlist
Next (2 alternatives): ips | players
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ ips | players
       ↳ command may end here
       ↳ command may end here
   ↳ command may end here
```

## bossbar

```
Command path: bossbar
Next (5 alternatives): add | get | list | remove | set

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ add | get | list | remove | set
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
        └─ <name>
            <...>  Data component ID, e.g. minecraft:damage, minecraft:food
               ↳ command may end here
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
        └─ max | players | value | visible
               ↳ command may end here
               ↳ command may end here
               ↳ command may end here
               ↳ command may end here
       ↳ command may end here
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
           ↳ command may end here
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
        └─ color | max | name | players | style | value | visible
            └─ blue | green | pink | purple | red | white | yellow
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
            └─ <max>
                <...>  Integer · ≥1
                   ↳ command may end here
            └─ <name>
                <...>  Data component ID, e.g. minecraft:damage, minecraft:food
                   ↳ command may end here
            └─ <targets>
                <...>  Entity / player selector · players only · multiple allowed
                   ↳ command may end here
               ↳ command may end here
            └─ notched_10 | notched_12 | notched_20 | notched_6 | progress
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
            └─ <value>
                <...>  Integer · ≥0
                   ↳ command may end here
            └─ <visible>
                <...>  Boolean
                   ↳ command may end here
```

## clear

```
Command path: clear
Next: <targets>
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · players only · multiple allowed
    └─ <item>
        <...>  Item predicate (ID/tag, optional component predicate)
        └─ <maxCount>
            <...>  Integer · ≥0
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
   ↳ command may end here
```

## clone

```
Command path: clone
Next (2 alternatives): from | <begin>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ from | <begin>
    <...>  Block position x y z
    └─ <end>
        <...>  Block position x y z
        └─ to | <destination>
            <...>  Block position x y z
            └─ filtered | masked | replace | strict
                └─ <filter>
                    <...>  Block predicate (ID/tag, optional state predicate)
                    └─ force | move | normal   …(deeper: use --depth=N)
                       ↳ command may end here
                └─ force | move | normal
                       ↳ command may end here
                       ↳ command may end here
                       ↳ command may end here
                   ↳ command may end here
                └─ force | move | normal
                       ↳ command may end here
                       ↳ command may end here
                       ↳ command may end here
                   ↳ command may end here
                └─ filtered | masked | replace
                    └─ <filter>   …(deeper: use --depth=N)
                    └─ force | move | normal   …(deeper: use --depth=N)
                       ↳ command may end here
                    └─ force | move | normal   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
            └─ <targetDimension>
                <...>  Dimension ID, e.g. minecraft:overworld
                └─ <destination>
                    <...>  Block position x y z
                    └─ filtered | masked | replace | strict   …(deeper: use --depth=N)
                       ↳ command may end here
    └─ <sourceDimension>
        <...>  Dimension ID, e.g. minecraft:overworld
        └─ <begin>
            <...>  Block position x y z
            └─ <end>
                <...>  Block position x y z
                └─ to | <destination>
                    <...>  Block position x y z
                    └─ filtered | masked | replace | strict   …(deeper: use --depth=N)
                       ↳ command may end here
                    └─ <targetDimension>   …(deeper: use --depth=N)
```

## damage

```
Command path: damage
Next: <target>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <target>
    <...>  Entity / player selector · entities · single
    └─ <amount>
        <...>  Float (floating-point number) · ≥0
        └─ <damageType>
            <...>  Registry entry · registry:minecraft:damage_type
            └─ at | by
                └─ <location>
                    <...>  3D coordinates x y z
                       ↳ command may end here
                └─ <entity>
                    <...>  Entity / player selector · entities · single
                    └─ from   …(deeper: use --depth=N)
                       ↳ command may end here
               ↳ command may end here
           ↳ command may end here
```

## data

```
Command path: data
Next (4 alternatives): get | merge | modify | remove

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ get | merge | modify | remove
    └─ block | entity | storage
        └─ <targetPos>
            <...>  Block position x y z
            └─ <path>
                <...>  NBT path, e.g. Items[0].tag
                └─ <scale>
                    <...>  Double (floating-point number)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
        └─ <target>
            <...>  Entity / player selector · entities · single
            └─ <path>
                <...>  NBT path, e.g. Items[0].tag
                └─ <scale>
                    <...>  Double (floating-point number)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
        └─ <target>
            <...>  Resource location ID, e.g. minecraft:diamond
            └─ <path>
                <...>  NBT path, e.g. Items[0].tag
                └─ <scale>
                    <...>  Double (floating-point number)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
    └─ block | entity | storage
        └─ <targetPos>
            <...>  Block position x y z
            └─ <nbt>
                <...>  NBT compound tag, e.g. {id:"minecraft:stone"}
                   ↳ command may end here
        └─ <target>
            <...>  Entity / player selector · entities · single
            └─ <nbt>
                <...>  NBT compound tag, e.g. {id:"minecraft:stone"}
                   ↳ command may end here
        └─ <target>
            <...>  Resource location ID, e.g. minecraft:diamond
            └─ <nbt>
                <...>  NBT compound tag, e.g. {id:"minecraft:stone"}
                   ↳ command may end here
    └─ block | entity | storage
        └─ <targetPos>
            <...>  Block position x y z
            └─ <targetPath>
                <...>  NBT path, e.g. Items[0].tag
                └─ append | insert | merge | prepend | set
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ <index>   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
        └─ <target>
            <...>  Entity / player selector · entities · single
            └─ <targetPath>
                <...>  NBT path, e.g. Items[0].tag
                └─ append | insert | merge | prepend | set
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ <index>   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
        └─ <target>
            <...>  Resource location ID, e.g. minecraft:diamond
            └─ <targetPath>
                <...>  NBT path, e.g. Items[0].tag
                └─ append | insert | merge | prepend | set
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ <index>   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
                    └─ from | string | value   …(deeper: use --depth=N)
    └─ block | entity | storage
        └─ <targetPos>
            <...>  Block position x y z
            └─ <path>
                <...>  NBT path, e.g. Items[0].tag
                   ↳ command may end here
        └─ <target>
            <...>  Entity / player selector · entities · single
            └─ <path>
                <...>  NBT path, e.g. Items[0].tag
                   ↳ command may end here
        └─ <target>
            <...>  Resource location ID, e.g. minecraft:diamond
            └─ <path>
                <...>  NBT path, e.g. Items[0].tag
                   ↳ command may end here
```

## datapack

```
Command path: datapack
Next (4 alternatives): create | disable | enable | list

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ create | disable | enable | list
    └─ <id>
        <...>  String · phrase (quotable)
        └─ <description>
            <...>  Data component ID, e.g. minecraft:damage, minecraft:food
               ↳ command may end here
    └─ <name>
        <...>  String · phrase (quotable)
           ↳ command may end here
    └─ <name>
        <...>  String · phrase (quotable)
        └─ after | before | first | last
            └─ <existing>
                <...>  String · phrase (quotable)
                   ↳ command may end here
            └─ <existing>
                <...>  String · phrase (quotable)
                   ↳ command may end here
               ↳ command may end here
               ↳ command may end here
           ↳ command may end here
    └─ available | enabled
           ↳ command may end here
           ↳ command may end here
       ↳ command may end here
```

## debug

```
Command path: debug
Next (3 alternatives): function | start | stop

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ function | start | stop
    └─ <name>
        <...>  Function ID, e.g. minecraft:foo/bar
           ↳ command may end here
       ↳ command may end here
       ↳ command may end here
```

## defaultgamemode

```
Command path: defaultgamemode
Next: <gamemode>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <gamemode>
    <...>  Game mode: survival|creative|adventure|spectator
       ↳ command may end here
```

## deop

```
Command path: deop
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Player name or player selector
       ↳ command may end here
```

## dialog

```
Command path: dialog
Next (2 alternatives): clear | show

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ clear | show
    └─ <targets>
        <...>  Entity / player selector · players only · multiple allowed
           ↳ command may end here
    └─ <targets>
        <...>  Entity / player selector · players only · multiple allowed
        └─ <dialog>
            <...>  Dialog ID
               ↳ command may end here
```

## difficulty

```
Command path: difficulty
Next (4 alternatives): easy | hard | normal | peaceful
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ easy | hard | normal | peaceful
       ↳ command may end here
       ↳ command may end here
       ↳ command may end here
       ↳ command may end here
   ↳ command may end here
```

## effect

```
Command path: effect
Next (2 alternatives): clear | give

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ clear | give
    └─ <targets>
        <...>  Entity / player selector · entities · multiple allowed
        └─ <effect>
            <...>  Registry entry · registry:minecraft:mob_effect
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
    └─ <targets>
        <...>  Entity / player selector · entities · multiple allowed
        └─ <effect>
            <...>  Registry entry · registry:minecraft:mob_effect
            └─ infinite | <seconds>
                └─ <amplifier>
                    <...>  Integer · ≥0 · ≤255
                    └─ <hideParticles>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
                <...>  Integer · ≥1 · ≤1000000
                └─ <amplifier>
                    <...>  Integer · ≥0 · ≤255
                    └─ <hideParticles>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
```

## enchant

```
Command path: enchant
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · entities · multiple allowed
    └─ <enchantment>
        <...>  Registry entry · registry:minecraft:enchantment
        └─ <level>
            <...>  Integer · ≥0
               ↳ command may end here
           ↳ command may end here
```

## execute

```
Command path: execute
Next (14 alternatives): align | anchored | as | at | facing | if | in | on | positioned | rotated | run | store | summon | unless

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ align | anchored | as | at | facing | if | in | on | positioned | rotated | run | store | summon | unless
    └─ <axes>
        <...>  Axis swizzle, e.g. xyz, xz
           ↻ chains to: execute (can continue with that command's subcommands)
    └─ <anchor>
        <...>  Anchor: eyes | feet
    └─ <targets>
        <...>  Entity / player selector · entities · multiple allowed
    └─ <targets>
        <...>  Entity / player selector · entities · multiple allowed
    └─ entity | <pos>
        └─ <targets>
            <...>  Entity / player selector · entities · multiple allowed
            └─ <anchor>
                <...>  Anchor: eyes | feet
        <...>  3D coordinates x y z
    └─ biome | block | blocks | data | dimension | entity | function | items | loaded | predicate | score | stopwatch
        └─ <pos>
            <...>  Block position x y z
            └─ <biome>
                <...>  ID or #tag · registry:minecraft:worldgen/biome
                   ↳ command may end here
        └─ <pos>
            <...>  Block position x y z
            └─ <block>
                <...>  Block predicate (ID/tag, optional state predicate)
                   ↳ command may end here
        └─ <start>
            <...>  Block position x y z
            └─ <end>
                <...>  Block position x y z
                └─ <destination>
                    <...>  Block position x y z
                    └─ all | masked   …(deeper: use --depth=N)
        └─ block | entity | storage
            └─ <sourcePos>
                <...>  Block position x y z
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
            └─ <source>
                <...>  Entity / player selector · entities · single
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
            └─ <source>
                <...>  Resource location ID, e.g. minecraft:diamond
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
        └─ <dimension>
            <...>  Dimension ID, e.g. minecraft:overworld
               ↳ command may end here
        └─ <entities>
            <...>  Entity / player selector · entities · multiple allowed
               ↳ command may end here
        └─ <name>
            <...>  Function ID, e.g. minecraft:foo/bar
        └─ block | entity
            └─ <pos>
                <...>  Block position x y z
                └─ <slots>
                    <...>  Set of slots, comma-separated
                    └─ <item_predicate>   …(deeper: use --depth=N)
            └─ <entities>
                <...>  Entity / player selector · entities · multiple allowed
                └─ <slots>
                    <...>  Set of slots, comma-separated
                    └─ <item_predicate>   …(deeper: use --depth=N)
        └─ <pos>
            <...>  Block position x y z
               ↳ command may end here
        └─ <predicate>
            <...>  Loot predicate table ID
               ↳ command may end here
        └─ <target>
            <...>  Scoreboard holder entity/name (* = all) · single
            └─ <targetObjective>
                <...>  Scoreboard objective ID
                └─ < | <= | = | > | >= | matches
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <range>   …(deeper: use --depth=N)
        └─ <id>
            <...>  Resource location ID, e.g. minecraft:diamond
            └─ <range>
                <...>  Float range, e.g. 1.5..5
                   ↳ command may end here
    └─ <dimension>
        <...>  Dimension ID, e.g. minecraft:overworld
    └─ attacker | controller | leasher | origin | owner | passengers | target | vehicle
    └─ as | over | <pos>
        └─ <targets>
            <...>  Entity / player selector · entities · multiple allowed
        └─ <heightmap>
            <...>  Heightmap: world_surface|motion_blocking|ocean_floor|motion_blocking_no_leaves|ocean_floor_wg|world_surface_wg
        <...>  3D coordinates x y z
    └─ as | <rot>
        └─ <targets>
            <...>  Entity / player selector · entities · multiple allowed
        <...>  Rotation x y
    └─ result | success
        └─ block | bossbar | entity | score | storage
            └─ <targetPos>
                <...>  Block position x y z
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                    └─ byte | double | float | int | long | short   …(deeper: use --depth=N)
            └─ <id>
                <...>  Resource location ID, e.g. minecraft:diamond
                └─ max | value
            └─ <target>
                <...>  Entity / player selector · entities · single
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                    └─ byte | double | float | int | long | short   …(deeper: use --depth=N)
            └─ <targets>
                <...>  Scoreboard holder entity/name (* = all) · multiple allowed
                └─ <objective>
                    <...>  Scoreboard objective ID
            └─ <target>
                <...>  Resource location ID, e.g. minecraft:diamond
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                    └─ byte | double | float | int | long | short   …(deeper: use --depth=N)
        └─ block | bossbar | entity | score | storage
            └─ <targetPos>
                <...>  Block position x y z
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                    └─ byte | double | float | int | long | short   …(deeper: use --depth=N)
            └─ <id>
                <...>  Resource location ID, e.g. minecraft:diamond
                └─ max | value
            └─ <target>
                <...>  Entity / player selector · entities · single
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                    └─ byte | double | float | int | long | short   …(deeper: use --depth=N)
            └─ <targets>
                <...>  Scoreboard holder entity/name (* = all) · multiple allowed
                └─ <objective>
                    <...>  Scoreboard objective ID
            └─ <target>
                <...>  Resource location ID, e.g. minecraft:diamond
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                    └─ byte | double | float | int | long | short   …(deeper: use --depth=N)
    └─ <entity>
        <...>  Registry entry · registry:minecraft:entity_type
    └─ biome | block | blocks | data | dimension | entity | function | items | loaded | predicate | score | stopwatch
        └─ <pos>
            <...>  Block position x y z
            └─ <biome>
                <...>  ID or #tag · registry:minecraft:worldgen/biome
                   ↳ command may end here
        └─ <pos>
            <...>  Block position x y z
            └─ <block>
                <...>  Block predicate (ID/tag, optional state predicate)
                   ↳ command may end here
        └─ <start>
            <...>  Block position x y z
            └─ <end>
                <...>  Block position x y z
                └─ <destination>
                    <...>  Block position x y z
                    └─ all | masked   …(deeper: use --depth=N)
        └─ block | entity | storage
            └─ <sourcePos>
                <...>  Block position x y z
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
            └─ <source>
                <...>  Entity / player selector · entities · single
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
            └─ <source>
                <...>  Resource location ID, e.g. minecraft:diamond
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
        └─ <dimension>
            <...>  Dimension ID, e.g. minecraft:overworld
               ↳ command may end here
        └─ <entities>
            <...>  Entity / player selector · entities · multiple allowed
               ↳ command may end here
        └─ <name>
            <...>  Function ID, e.g. minecraft:foo/bar
        └─ block | entity
            └─ <pos>
                <...>  Block position x y z
                └─ <slots>
                    <...>  Set of slots, comma-separated
                    └─ <item_predicate>   …(deeper: use --depth=N)
            └─ <entities>
                <...>  Entity / player selector · entities · multiple allowed
                └─ <slots>
                    <...>  Set of slots, comma-separated
                    └─ <item_predicate>   …(deeper: use --depth=N)
        └─ <pos>
            <...>  Block position x y z
               ↳ command may end here
        └─ <predicate>
            <...>  Loot predicate table ID
               ↳ command may end here
        └─ <target>
            <...>  Scoreboard holder entity/name (* = all) · single
            └─ <targetObjective>
                <...>  Scoreboard objective ID
                └─ < | <= | = | > | >= | matches
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <source>   …(deeper: use --depth=N)
                    └─ <range>   …(deeper: use --depth=N)
        └─ <id>
            <...>  Resource location ID, e.g. minecraft:diamond
            └─ <range>
                <...>  Float range, e.g. 1.5..5
                   ↳ command may end here
```

## experience

```
Command path: experience
Next (3 alternatives): add | query | set

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ add | query | set
    └─ <target>
        <...>  Entity / player selector · players only · multiple allowed
        └─ <amount>
            <...>  Integer
            └─ levels | points
                   ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
    └─ <target>
        <...>  Entity / player selector · players only · single
        └─ levels | points
               ↳ command may end here
               ↳ command may end here
    └─ <target>
        <...>  Entity / player selector · players only · multiple allowed
        └─ <amount>
            <...>  Integer · ≥0
            └─ levels | points
                   ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
```

## fetchprofile

```
Command path: fetchprofile
Next (3 alternatives): entity | id | name

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ entity | id | name
    └─ <entity>
        <...>  Entity / player selector · entities · single
           ↳ command may end here
    └─ <id>
        <...>  UUID
           ↳ command may end here
    └─ <name>
        <...>  String · to end of line
           ↳ command may end here
```

## fill

```
Command path: fill
Next: <from>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <from>
    <...>  Block position x y z
    └─ <to>
        <...>  Block position x y z
        └─ <block>
            <...>  Block state, e.g. minecraft:stone[axis=y]
            └─ destroy | hollow | keep | outline | replace | strict
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                └─ <filter>
                    <...>  Block predicate (ID/tag, optional state predicate)
                    └─ destroy | hollow | outline | strict   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
```

## fillbiome

```
Command path: fillbiome
Next: <from>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <from>
    <...>  Block position x y z
    └─ <to>
        <...>  Block position x y z
        └─ <biome>
            <...>  Registry entry · registry:minecraft:worldgen/biome
            └─ replace
                └─ <filter>
                    <...>  ID or #tag · registry:minecraft:worldgen/biome
                       ↳ command may end here
               ↳ command may end here
```

## forceload

```
Command path: forceload
Next (3 alternatives): add | query | remove

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ add | query | remove
    └─ <from>
        <...>  Column position
        └─ <to>
            <...>  Column position
               ↳ command may end here
           ↳ command may end here
    └─ <pos>
        <...>  Column position
           ↳ command may end here
       ↳ command may end here
    └─ all | <from>
           ↳ command may end here
        <...>  Column position
        └─ <to>
            <...>  Column position
               ↳ command may end here
           ↳ command may end here
```

## function

```
Command path: function
Next: <name>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <name>
    <...>  Function ID, e.g. minecraft:foo/bar
    └─ with | <arguments>
        <...>  NBT compound tag, e.g. {id:"minecraft:stone"}
           ↳ command may end here
        └─ block | entity | storage
            └─ <sourcePos>
                <...>  Block position x y z
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
                   ↳ command may end here
            └─ <source>
                <...>  Entity / player selector · entities · single
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
                   ↳ command may end here
            └─ <source>
                <...>  Resource location ID, e.g. minecraft:diamond
                └─ <path>
                    <...>  NBT path, e.g. Items[0].tag
                       ↳ command may end here
                   ↳ command may end here
       ↳ command may end here
```

## gamemode

```
Command path: gamemode
Next: <gamemode>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <gamemode>
    <...>  Game mode: survival|creative|adventure|spectator
    └─ <target>
        <...>  Entity / player selector · players only · multiple allowed
           ↳ command may end here
       ↳ command may end here
```

## gamerule

```
Command path: gamerule
Next (118 alternatives): advance_time | advance_weather | allow_entering_nether_using_portals | block_drops | block_explosion_drop_decay | command_block_output | command_blocks_work | drowning_damage | elytra_movement_check | ender_pearls_vanish_on_death | entity_drops | fall_damage | fire_damage | fire_spread_radius_around_player | forgive_dead_players | freeze_damage | global_sound_events | immediate_respawn | keep_inventory | lava_source_conversion | limited_crafting | locator_bar | log_admin_commands | max_block_modifications | max_command_forks | max_command_sequence_length | max_entity_cramming | max_minecart_speed | max_snow_accumulation_height | minecraft:advance_time | minecraft:advance_weather | minecraft:allow_entering_nether_using_portals | minecraft:block_drops | minecraft:block_explosion_drop_decay | minecraft:command_block_output | minecraft:command_blocks_work | minecraft:drowning_damage | minecraft:elytra_movement_check | minecraft:ender_pearls_vanish_on_death | minecraft:entity_drops | minecraft:fall_damage | minecraft:fire_damage | minecraft:fire_spread_radius_around_player | minecraft:forgive_dead_players | minecraft:freeze_damage | minecraft:global_sound_events | minecraft:immediate_respawn | minecraft:keep_inventory | minecraft:lava_source_conversion | minecraft:limited_crafting | minecraft:locator_bar | minecraft:log_admin_commands | minecraft:max_block_modifications | minecraft:max_command_forks | minecraft:max_command_sequence_length | minecraft:max_entity_cramming | minecraft:max_minecart_speed | minecraft:max_snow_accumulation_height | minecraft:mob_drops | minecraft:mob_explosion_drop_decay | minecraft:mob_griefing | minecraft:natural_health_regeneration | minecraft:player_movement_check | minecraft:players_nether_portal_creative_delay | minecraft:players_nether_portal_default_delay | minecraft:players_sleeping_percentage | minecraft:projectiles_can_break_blocks | minecraft:pvp | minecraft:raids | minecraft:random_tick_speed | minecraft:reduced_debug_info | minecraft:respawn_radius | minecraft:send_command_feedback | minecraft:show_advancement_messages | minecraft:show_death_messages | minecraft:spawn_mobs | minecraft:spawn_monsters | minecraft:spawn_patrols | minecraft:spawn_phantoms | minecraft:spawn_wandering_traders | minecraft:spawn_wardens | minecraft:spawner_blocks_work | minecraft:spectators_generate_chunks | minecraft:spread_vines | minecraft:tnt_explodes | minecraft:tnt_explosion_drop_decay | minecraft:universal_anger | minecraft:water_source_conversion | mob_drops | mob_explosion_drop_decay | mob_griefing | natural_health_regeneration | player_movement_check | players_nether_portal_creative_delay | players_nether_portal_default_delay | players_sleeping_percentage | projectiles_can_break_blocks | pvp | raids | random_tick_speed | reduced_debug_info | respawn_radius | send_command_feedback | show_advancement_messages | show_death_messages | spawn_mobs | spawn_monsters | spawn_patrols | spawn_phantoms | spawn_wandering_traders | spawn_wardens | spawner_blocks_work | spectators_generate_chunks | spread_vines | tnt_explodes | tnt_explosion_drop_decay | universal_anger | water_source_conversion

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ advance_time | advance_weather | allow_entering_nether_using_portals | block_drops | block_explosion_drop_decay | command_block_output | command_blocks_work | drowning_damage | elytra_movement_check | ender_pearls_vanish_on_death | entity_drops | fall_damage | fire_damage | fire_spread_radius_around_player | forgive_dead_players | freeze_damage | global_sound_events | immediate_respawn | keep_inventory | lava_source_conversion | limited_crafting | locator_bar | log_admin_commands | max_block_modifications | max_command_forks | max_command_sequence_length | max_entity_cramming | max_minecart_speed | max_snow_accumulation_height | minecraft:advance_time | minecraft:advance_weather | minecraft:allow_entering_nether_using_portals | minecraft:block_drops | minecraft:block_explosion_drop_decay | minecraft:command_block_output | minecraft:command_blocks_work | minecraft:drowning_damage | minecraft:elytra_movement_check | minecraft:ender_pearls_vanish_on_death | minecraft:entity_drops | minecraft:fall_damage | minecraft:fire_damage | minecraft:fire_spread_radius_around_player | minecraft:forgive_dead_players | minecraft:freeze_damage | minecraft:global_sound_events | minecraft:immediate_respawn | minecraft:keep_inventory | minecraft:lava_source_conversion | minecraft:limited_crafting | minecraft:locator_bar | minecraft:log_admin_commands | minecraft:max_block_modifications | minecraft:max_command_forks | minecraft:max_command_sequence_length | minecraft:max_entity_cramming | minecraft:max_minecart_speed | minecraft:max_snow_accumulation_height | minecraft:mob_drops | minecraft:mob_explosion_drop_decay | minecraft:mob_griefing | minecraft:natural_health_regeneration | minecraft:player_movement_check | minecraft:players_nether_portal_creative_delay | minecraft:players_nether_portal_default_delay | minecraft:players_sleeping_percentage | minecraft:projectiles_can_break_blocks | minecraft:pvp | minecraft:raids | minecraft:random_tick_speed | minecraft:reduced_debug_info | minecraft:respawn_radius | minecraft:send_command_feedback | minecraft:show_advancement_messages | minecraft:show_death_messages | minecraft:spawn_mobs | minecraft:spawn_monsters | minecraft:spawn_patrols | minecraft:spawn_phantoms | minecraft:spawn_wandering_traders | minecraft:spawn_wardens | minecraft:spawner_blocks_work | minecraft:spectators_generate_chunks | minecraft:spread_vines | minecraft:tnt_explodes | minecraft:tnt_explosion_drop_decay | minecraft:universal_anger | minecraft:water_source_conversion | mob_drops | mob_explosion_drop_decay | mob_griefing | natural_health_regeneration | player_movement_check | players_nether_portal_creative_delay | players_nether_portal_default_delay | players_sleeping_percentage | projectiles_can_break_blocks | pvp | raids | random_tick_speed | reduced_debug_info | respawn_radius | send_command_feedback | show_advancement_messages | show_death_messages | spawn_mobs | spawn_monsters | spawn_patrols | spawn_phantoms | spawn_wandering_traders | spawn_wardens | spawner_blocks_work | spectators_generate_chunks | spread_vines | tnt_explodes | tnt_explosion_drop_decay | universal_anger | water_source_conversion
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥-1
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥1
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥1 · ≤1000
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0 · ≤8
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥-1
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥1
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥1 · ≤1000
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0 · ≤8
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Integer · ≥0
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
    └─ <value>
        <...>  Boolean
           ↳ command may end here
       ↳ command may end here
```

## give

```
Command path: give
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · players only · multiple allowed
    └─ <item>
        <...>  Item stack, e.g. minecraft:diamond_sword 1
        └─ <count>
            <...>  Integer · ≥1
               ↳ command may end here
           ↳ command may end here
```

## help

```
Command path: help
Next: <command>
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <command>
    <...>  String · to end of line
       ↳ command may end here
   ↳ command may end here
```

## item

```
Command path: item
Next (2 alternatives): modify | replace

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ modify | replace
    └─ block | entity
        └─ <pos>
            <...>  Block position x y z
            └─ <slot>
                <...>  Inventory slot, e.g. armor.head, weapon.mainhand
                └─ <modifier>
                    <...>  Loot modifier table ID
                       ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · entities · multiple allowed
            └─ <slot>
                <...>  Inventory slot, e.g. armor.head, weapon.mainhand
                └─ <modifier>
                    <...>  Loot modifier table ID
                       ↳ command may end here
    └─ block | entity
        └─ <pos>
            <...>  Block position x y z
            └─ <slot>
                <...>  Inventory slot, e.g. armor.head, weapon.mainhand
                └─ from | with
                    └─ block | entity   …(deeper: use --depth=N)
                    └─ <item>   …(deeper: use --depth=N)
        └─ <targets>
            <...>  Entity / player selector · entities · multiple allowed
            └─ <slot>
                <...>  Inventory slot, e.g. armor.head, weapon.mainhand
                └─ from | with
                    └─ block | entity   …(deeper: use --depth=N)
                    └─ <item>   …(deeper: use --depth=N)
```

## jfr

```
Command path: jfr
Next (2 alternatives): start | stop

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ start | stop
       ↳ command may end here
       ↳ command may end here
```

## kick

```
Command path: kick
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · players only · multiple allowed
    └─ <reason>
        <...>  Message text (supports @s etc. selectors)
           ↳ command may end here
       ↳ command may end here
```

## kill

```
Command path: kill
Next: <targets>
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · entities · multiple allowed
       ↳ command may end here
   ↳ command may end here
```

## list

```
Command path: list
Next: uuids
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ uuids
       ↳ command may end here
   ↳ command may end here
```

## locate

```
Command path: locate
Next (3 alternatives): biome | poi | structure

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ biome | poi | structure
    └─ <biome>
        <...>  ID or #tag · registry:minecraft:worldgen/biome
           ↳ command may end here
    └─ <poi>
        <...>  ID or #tag · registry:minecraft:point_of_interest_type
           ↳ command may end here
    └─ <structure>
        <...>  ID or #tag (key) · registry:minecraft:worldgen/structure
           ↳ command may end here
```

## loot

```
Command path: loot
Next (4 alternatives): give | insert | replace | spawn

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ give | insert | replace | spawn
    └─ <players>
        <...>  Entity / player selector · players only · multiple allowed
        └─ fish | kill | loot | mine
            └─ <loot_table>
                <...>  Loot table ID
                └─ <pos>
                    <...>  Block position x y z
                    └─ mainhand | offhand | <tool>   …(deeper: use --depth=N)
                       ↳ command may end here
            └─ <target>
                <...>  Entity / player selector · entities · single
                   ↳ command may end here
            └─ <loot_table>
                <...>  Loot table ID
                   ↳ command may end here
            └─ <pos>
                <...>  Block position x y z
                └─ mainhand | offhand | <tool>
                       ↳ command may end here
                       ↳ command may end here
                    <...>  Item stack, e.g. minecraft:diamond_sword 1
                       ↳ command may end here
                   ↳ command may end here
    └─ <targetPos>
        <...>  Block position x y z
        └─ fish | kill | loot | mine
            └─ <loot_table>
                <...>  Loot table ID
                └─ <pos>
                    <...>  Block position x y z
                    └─ mainhand | offhand | <tool>   …(deeper: use --depth=N)
                       ↳ command may end here
            └─ <target>
                <...>  Entity / player selector · entities · single
                   ↳ command may end here
            └─ <loot_table>
                <...>  Loot table ID
                   ↳ command may end here
            └─ <pos>
                <...>  Block position x y z
                └─ mainhand | offhand | <tool>
                       ↳ command may end here
                       ↳ command may end here
                    <...>  Item stack, e.g. minecraft:diamond_sword 1
                       ↳ command may end here
                   ↳ command may end here
    └─ block | entity
        └─ <targetPos>
            <...>  Block position x y z
            └─ <slot>
                <...>  Inventory slot, e.g. armor.head, weapon.mainhand
                └─ fish | kill | loot | mine | <count>
                    <...>  Integer · ≥0
                    └─ fish | kill | loot | mine   …(deeper: use --depth=N)
                    └─ <loot_table>   …(deeper: use --depth=N)
                    └─ <target>   …(deeper: use --depth=N)
                    └─ <loot_table>   …(deeper: use --depth=N)
                    └─ <pos>   …(deeper: use --depth=N)
        └─ <entities>
            <...>  Entity / player selector · entities · multiple allowed
            └─ <slot>
                <...>  Inventory slot, e.g. armor.head, weapon.mainhand
                └─ fish | kill | loot | mine | <count>
                    <...>  Integer · ≥0
                    └─ fish | kill | loot | mine   …(deeper: use --depth=N)
                    └─ <loot_table>   …(deeper: use --depth=N)
                    └─ <target>   …(deeper: use --depth=N)
                    └─ <loot_table>   …(deeper: use --depth=N)
                    └─ <pos>   …(deeper: use --depth=N)
    └─ <targetPos>
        <...>  3D coordinates x y z
        └─ fish | kill | loot | mine
            └─ <loot_table>
                <...>  Loot table ID
                └─ <pos>
                    <...>  Block position x y z
                    └─ mainhand | offhand | <tool>   …(deeper: use --depth=N)
                       ↳ command may end here
            └─ <target>
                <...>  Entity / player selector · entities · single
                   ↳ command may end here
            └─ <loot_table>
                <...>  Loot table ID
                   ↳ command may end here
            └─ <pos>
                <...>  Block position x y z
                └─ mainhand | offhand | <tool>
                       ↳ command may end here
                       ↳ command may end here
                    <...>  Item stack, e.g. minecraft:diamond_sword 1
                       ↳ command may end here
                   ↳ command may end here
```

## me

```
Command path: me
Next: <action>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <action>
    <...>  Message text (supports @s etc. selectors)
       ↳ command may end here
```

## msg

```
Command path: msg
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · players only · multiple allowed
    └─ <message>
        <...>  Message text (supports @s etc. selectors)
           ↳ command may end here
```

## op

```
Command path: op
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Player name or player selector
       ↳ command may end here
```

## pardon

```
Command path: pardon
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Player name or player selector
       ↳ command may end here
```

## pardon-ip

```
Command path: pardon-ip
Next: <target>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <target>
    <...>  String · word
       ↳ command may end here
```

## particle

```
Command path: particle
Next: <name>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <name>
    <...>  Particle ID, e.g. minecraft:crit
    └─ <pos>
        <...>  3D coordinates x y z
        └─ <delta>
            <...>  3D coordinates x y z
            └─ <speed>
                <...>  Float (floating-point number) · ≥0
                └─ <count>
                    <...>  Integer · ≥0
                    └─ force | normal   …(deeper: use --depth=N)
                       ↳ command may end here
           ↳ command may end here
       ↳ command may end here
```

## perf

```
Command path: perf
Next (2 alternatives): start | stop

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ start | stop
       ↳ command may end here
       ↳ command may end here
```

## place

```
Command path: place
Next (4 alternatives): feature | jigsaw | structure | template

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ feature | jigsaw | structure | template
    └─ <feature>
        <...>  Registry key (minecraft: prefix optional) · registry:minecraft:worldgen/configured_feature
        └─ <pos>
            <...>  Block position x y z
               ↳ command may end here
           ↳ command may end here
    └─ <pool>
        <...>  Registry key (minecraft: prefix optional) · registry:minecraft:worldgen/template_pool
        └─ <target>
            <...>  Resource location ID, e.g. minecraft:diamond
            └─ <max_depth>
                <...>  Integer · ≥1 · ≤20
                └─ <position>
                    <...>  Block position x y z
                       ↳ command may end here
                   ↳ command may end here
    └─ <structure>
        <...>  Registry key (minecraft: prefix optional) · registry:minecraft:worldgen/structure
        └─ <pos>
            <...>  Block position x y z
               ↳ command may end here
           ↳ command may end here
    └─ <template>
        <...>  Resource location ID, e.g. minecraft:diamond
        └─ <pos>
            <...>  Block position x y z
            └─ <rotation>
                <...>  Structure rotation: none|clockwise_90|counterclockwise_90|180
                └─ <mirror>
                    <...>  Structure mirror: none|left_right|front_back
                    └─ <integrity>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
```

## playsound

```
Command path: playsound
Next: <sound>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <sound>
    <...>  Resource location ID, e.g. minecraft:diamond
    └─ ambient | block | hostile | master | music | neutral | player | record | ui | voice | weather
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Entity / player selector · players only · multiple allowed
            └─ <pos>
                <...>  3D coordinates x y z
                └─ <volume>
                    <...>  Float (floating-point number) · ≥0
                    └─ <pitch>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
```

## publish

```
Command path: publish
Next: <allowCommands>
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <allowCommands>
    <...>  Boolean
    └─ <gamemode>
        <...>  Game mode: survival|creative|adventure|spectator
        └─ <port>
            <...>  Integer · ≥0 · ≤65535
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
   ↳ command may end here
```

## random

```
Command path: random
Next (3 alternatives): reset | roll | value

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ reset | roll | value
    └─ * | <sequence>
        └─ <seed>
            <...>  Integer
            └─ <includeWorldSeed>
                <...>  Boolean
                └─ <includeSequenceId>
                    <...>  Boolean
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        <...>  Resource location ID, e.g. minecraft:diamond
        └─ <seed>
            <...>  Integer
            └─ <includeWorldSeed>
                <...>  Boolean
                └─ <includeSequenceId>
                    <...>  Boolean
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
    └─ <range>
        <...>  Integer range, e.g. 1..5
        └─ <sequence>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
    └─ <range>
        <...>  Integer range, e.g. 1..5
        └─ <sequence>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
```

## recipe

```
Command path: recipe
Next (2 alternatives): give | take

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ give | take
    └─ <targets>
        <...>  Entity / player selector · players only · multiple allowed
        └─ * | <recipe>
               ↳ command may end here
            <...>  Registry key (minecraft: prefix optional) · registry:minecraft:recipe
               ↳ command may end here
    └─ <targets>
        <...>  Entity / player selector · players only · multiple allowed
        └─ * | <recipe>
               ↳ command may end here
            <...>  Registry key (minecraft: prefix optional) · registry:minecraft:recipe
               ↳ command may end here
```

## reload

```
Command path: reload
[command may end here]
```

## return

```
Command path: return
Next (3 alternatives): fail | run | <value>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ fail | run | <value>
       ↳ command may end here
    <...>  Integer
       ↳ command may end here
```

## ride

```
Command path: ride
Next: <target>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <target>
    <...>  Entity / player selector · entities · single
    └─ dismount | mount
           ↳ command may end here
        └─ <vehicle>
            <...>  Entity / player selector · entities · single
               ↳ command may end here
```

## rotate

```
Command path: rotate
Next: <target>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <target>
    <...>  Entity / player selector · entities · single
    └─ facing | <rotation>
        └─ entity | <facingLocation>
            └─ <facingEntity>
                <...>  Entity / player selector · entities · single
                └─ <facingAnchor>
                    <...>  Anchor: eyes | feet
                       ↳ command may end here
                   ↳ command may end here
            <...>  3D coordinates x y z
               ↳ command may end here
        <...>  Rotation x y
           ↳ command may end here
```

## save-all

```
Command path: save-all
Next: flush
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ flush
       ↳ command may end here
   ↳ command may end here
```

## save-off

```
Command path: save-off
[command may end here]
```

## save-on

```
Command path: save-on
[command may end here]
```

## say

```
Command path: say
Next: <message>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <message>
    <...>  Message text (supports @s etc. selectors)
       ↳ command may end here
```

## schedule

```
Command path: schedule
Next (2 alternatives): clear | function

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ clear | function
    └─ <function>
        <...>  String · to end of line
           ↳ command may end here
    └─ <function>
        <...>  Function ID, e.g. minecraft:foo/bar
        └─ <time>
            <...>  Game ticks · ≥0
            └─ append | replace
                   ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
```

## scoreboard

```
Command path: scoreboard
Next (2 alternatives): objectives | players

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ objectives | players
    └─ add | list | modify | remove | setdisplay
        └─ <objective>
            <...>  String · word
            └─ <criteria>
                <...>  Scoreboard criteria, e.g. minecraft:damage_taken
                └─ <displayName>
                    <...>  Data component ID, e.g. minecraft:damage, minecraft:food
                       ↳ command may end here
                   ↳ command may end here
           ↳ command may end here
        └─ <objective>
            <...>  Scoreboard objective ID
            └─ displayautoupdate | displayname | numberformat | rendertype
                └─ <value>
                    <...>  Boolean
                       ↳ command may end here
                └─ <displayName>
                    <...>  Data component ID, e.g. minecraft:damage, minecraft:food
                       ↳ command may end here
                └─ blank | fixed | styled
                       ↳ command may end here
                    └─ <contents>   …(deeper: use --depth=N)
                    └─ <style>   …(deeper: use --depth=N)
                   ↳ command may end here
                └─ hearts | integer
                       ↳ command may end here
                       ↳ command may end here
        └─ <objective>
            <...>  Scoreboard objective ID
               ↳ command may end here
        └─ <slot>
            <...>  Scoreboard slot, e.g. sidebar, red.green
            └─ <objective>
                <...>  Scoreboard objective ID
                   ↳ command may end here
               ↳ command may end here
    └─ add | display | enable | get | list | operation | remove | reset | set
        └─ <targets>
            <...>  Scoreboard holder entity/name (* = all) · multiple allowed
            └─ <objective>
                <...>  Scoreboard objective ID
                └─ <score>
                    <...>  Integer · ≥0
                       ↳ command may end here
        └─ name | numberformat
            └─ <targets>
                <...>  Scoreboard holder entity/name (* = all) · multiple allowed
                └─ <objective>
                    <...>  Scoreboard objective ID
                    └─ <name>   …(deeper: use --depth=N)
                       ↳ command may end here
            └─ <targets>
                <...>  Scoreboard holder entity/name (* = all) · multiple allowed
                └─ <objective>
                    <...>  Scoreboard objective ID
                    └─ blank | fixed | styled   …(deeper: use --depth=N)
                       ↳ command may end here
        └─ <targets>
            <...>  Scoreboard holder entity/name (* = all) · multiple allowed
            └─ <objective>
                <...>  Scoreboard objective ID
                   ↳ command may end here
        └─ <target>
            <...>  Scoreboard holder entity/name (* = all) · single
            └─ <objective>
                <...>  Scoreboard objective ID
                   ↳ command may end here
        └─ <target>
            <...>  Scoreboard holder entity/name (* = all) · single
               ↳ command may end here
           ↳ command may end here
        └─ <targets>
            <...>  Scoreboard holder entity/name (* = all) · multiple allowed
            └─ <targetObjective>
                <...>  Scoreboard objective ID
                └─ <operation>
                    <...>  Scoreboard operation: += -= *= /= %= = < > ><
                    └─ <source>   …(deeper: use --depth=N)
        └─ <targets>
            <...>  Scoreboard holder entity/name (* = all) · multiple allowed
            └─ <objective>
                <...>  Scoreboard objective ID
                └─ <score>
                    <...>  Integer · ≥0
                       ↳ command may end here
        └─ <targets>
            <...>  Scoreboard holder entity/name (* = all) · multiple allowed
            └─ <objective>
                <...>  Scoreboard objective ID
                   ↳ command may end here
               ↳ command may end here
        └─ <targets>
            <...>  Scoreboard holder entity/name (* = all) · multiple allowed
            └─ <objective>
                <...>  Scoreboard objective ID
                └─ <score>
                    <...>  Integer
                       ↳ command may end here
```

## seed

```
Command path: seed
[command may end here]
```

## setblock

```
Command path: setblock
Next: <pos>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <pos>
    <...>  Block position x y z
    └─ <block>
        <...>  Block state, e.g. minecraft:stone[axis=y]
        └─ destroy | keep | replace | strict
               ↳ command may end here
               ↳ command may end here
               ↳ command may end here
               ↳ command may end here
           ↳ command may end here
```

## setidletimeout

```
Command path: setidletimeout
Next: <minutes>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <minutes>
    <...>  Integer · ≥0
       ↳ command may end here
```

## setworldspawn

```
Command path: setworldspawn
Next: <pos>
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <pos>
    <...>  Block position x y z
    └─ <rotation>
        <...>  Rotation x y
           ↳ command may end here
       ↳ command may end here
   ↳ command may end here
```

## spawnpoint

```
Command path: spawnpoint
Next: <targets>
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · players only · multiple allowed
    └─ <pos>
        <...>  Block position x y z
        └─ <rotation>
            <...>  Rotation x y
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
   ↳ command may end here
```

## spectate

```
Command path: spectate
Next: <target>
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <target>
    <...>  Entity / player selector · entities · single
    └─ <player>
        <...>  Entity / player selector · players only · single
           ↳ command may end here
       ↳ command may end here
   ↳ command may end here
```

## spreadplayers

```
Command path: spreadplayers
Next: <center>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <center>
    <...>  2D coordinates x y
    └─ <spreadDistance>
        <...>  Float (floating-point number) · ≥0
        └─ <maxRange>
            <...>  Float (floating-point number) · ≥1
            └─ under | <respectTeams>
                <...>  Boolean
                └─ <targets>
                    <...>  Entity / player selector · entities · multiple allowed
                       ↳ command may end here
                └─ <maxHeight>
                    <...>  Integer
                    └─ <respectTeams>   …(deeper: use --depth=N)
```

## stop

```
Command path: stop
[command may end here]
```

## stopsound

```
Command path: stopsound
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · players only · multiple allowed
    └─ * | ambient | block | hostile | master | music | neutral | player | record | ui | voice | weather
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
        └─ <sound>
            <...>  Resource location ID, e.g. minecraft:diamond
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
```

## stopwatch

```
Command path: stopwatch
Next (4 alternatives): create | query | remove | restart

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ create | query | remove | restart
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
           ↳ command may end here
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
        └─ <scale>
            <...>  Double (floating-point number)
               ↳ command may end here
           ↳ command may end here
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
           ↳ command may end here
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
           ↳ command may end here
```

## summon

```
Command path: summon
Next: <entity>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <entity>
    <...>  Registry entry · registry:minecraft:entity_type
    └─ <pos>
        <...>  3D coordinates x y z
        └─ <nbt>
            <...>  NBT compound tag, e.g. {id:"minecraft:stone"}
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
```

## swing

```
Command path: swing
Next: <targets>
[command may end here]

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · entities · multiple allowed
    └─ mainhand | offhand
           ↳ command may end here
           ↳ command may end here
       ↳ command may end here
   ↳ command may end here
```

## tag

```
Command path: tag
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · entities · multiple allowed
    └─ add | list | remove
        └─ <name>
            <...>  String · word
               ↳ command may end here
           ↳ command may end here
        └─ <name>
            <...>  String · word
               ↳ command may end here
```

## team

```
Command path: team
Next (7 alternatives): add | empty | join | leave | list | modify | remove

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ add | empty | join | leave | list | modify | remove
    └─ <team>
        <...>  String · word
        └─ <displayName>
            <...>  Data component ID, e.g. minecraft:damage, minecraft:food
               ↳ command may end here
           ↳ command may end here
    └─ <team>
        <...>  Team ID
           ↳ command may end here
    └─ <team>
        <...>  Team ID
        └─ <members>
            <...>  Scoreboard holder entity/name (* = all) · multiple allowed
               ↳ command may end here
           ↳ command may end here
    └─ <members>
        <...>  Scoreboard holder entity/name (* = all) · multiple allowed
           ↳ command may end here
    └─ <team>
        <...>  Team ID
           ↳ command may end here
       ↳ command may end here
    └─ <team>
        <...>  Team ID
        └─ collisionRule | color | deathMessageVisibility | displayName | friendlyFire | nametagVisibility | prefix | seeFriendlyInvisibles | suffix
            └─ always | never | pushOtherTeams | pushOwnTeam
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
            └─ reset | <value>
                   ↳ command may end here
                <...>  Team color
                   ↳ command may end here
            └─ always | hideForOtherTeams | hideForOwnTeam | never
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
            └─ <displayName>
                <...>  Data component ID, e.g. minecraft:damage, minecraft:food
                   ↳ command may end here
            └─ <allowed>
                <...>  Boolean
                   ↳ command may end here
            └─ always | hideForOtherTeams | hideForOwnTeam | never
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
                   ↳ command may end here
            └─ <prefix>
                <...>  Data component ID, e.g. minecraft:damage, minecraft:food
                   ↳ command may end here
            └─ <allowed>
                <...>  Boolean
                   ↳ command may end here
            └─ <suffix>
                <...>  Data component ID, e.g. minecraft:damage, minecraft:food
                   ↳ command may end here
    └─ <team>
        <...>  Team ID
           ↳ command may end here
```

## teammsg

```
Command path: teammsg
Next: <message>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <message>
    <...>  Message text (supports @s etc. selectors)
       ↳ command may end here
```

## teleport

```
Command path: teleport
Next (3 alternatives): <destination> | <location> | <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <destination> | <location> | <targets>
    <...>  Entity / player selector · entities · single
       ↳ command may end here
    <...>  3D coordinates x y z
       ↳ command may end here
    <...>  Entity / player selector · entities · multiple allowed
    └─ <destination> | <location>
        <...>  Entity / player selector · entities · single
           ↳ command may end here
        <...>  3D coordinates x y z
        └─ facing | <rotation>
            └─ entity | <facingLocation>
                └─ <facingEntity>
                    <...>  Entity / player selector · entities · single
                    └─ <facingAnchor>   …(deeper: use --depth=N)
                       ↳ command may end here
                <...>  3D coordinates x y z
                   ↳ command may end here
            <...>  Rotation x y
               ↳ command may end here
           ↳ command may end here
```

## tell

```
Command path: tell
↻ then continue (redirect → msg): msg
```

## tellraw

```
Command path: tellraw
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · players only · multiple allowed
    └─ <message>
        <...>  Data component ID, e.g. minecraft:damage, minecraft:food
           ↳ command may end here
```

## test

```
Command path: test
Next (17 alternatives): clearall | clearthat | clearthese | create | locate | pos | resetclosest | resetthat | resetthese | run | runclosest | runfailed | runmultiple | runthat | runthese | stop | verify

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ clearall | clearthat | clearthese | create | locate | pos | resetclosest | resetthat | resetthese | run | runclosest | runfailed | runmultiple | runthat | runthese | stop | verify
    └─ <radius>
        <...>  Integer
           ↳ command may end here
       ↳ command may end here
       ↳ command may end here
       ↳ command may end here
    └─ <id>
        <...>  Resource location ID, e.g. minecraft:diamond
        └─ <width>
            <...>  Integer
            └─ <height>
                <...>  Integer
                └─ <depth>
                    <...>  Integer
                       ↳ command may end here
               ↳ command may end here
           ↳ command may end here
    └─ <tests>
        <...>  Resource selector · registry:minecraft:test_instance
           ↳ command may end here
    └─ <var>
        <...>  String · word
           ↳ command may end here
       ↳ command may end here
       ↳ command may end here
       ↳ command may end here
       ↳ command may end here
    └─ <tests>
        <...>  Resource selector · registry:minecraft:test_instance
        └─ <numberOfTimes>
            <...>  Integer · ≥0
            └─ <untilFailed>
                <...>  Boolean
                └─ <rotationSteps>
                    <...>  Integer
                    └─ <testsPerRow>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
    └─ <numberOfTimes>
        <...>  Integer · ≥0
        └─ <untilFailed>
            <...>  Boolean
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
    └─ <numberOfTimes> | <onlyRequiredTests>
        <...>  Integer · ≥0
        └─ <untilFailed>
            <...>  Boolean
            └─ <rotationSteps>
                <...>  Integer
                └─ <testsPerRow>
                    <...>  Integer
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
        <...>  Boolean
        └─ <numberOfTimes>
            <...>  Integer · ≥0
            └─ <untilFailed>
                <...>  Boolean
                └─ <rotationSteps>
                    <...>  Integer
                    └─ <testsPerRow>   …(deeper: use --depth=N)
                       ↳ command may end here
                   ↳ command may end here
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
    └─ <tests>
        <...>  Resource selector · registry:minecraft:test_instance
        └─ <amount>
            <...>  Integer
               ↳ command may end here
           ↳ command may end here
    └─ <numberOfTimes>
        <...>  Integer · ≥0
        └─ <untilFailed>
            <...>  Boolean
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
    └─ <numberOfTimes>
        <...>  Integer · ≥0
        └─ <untilFailed>
            <...>  Boolean
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
       ↳ command may end here
    └─ <tests>
        <...>  Resource selector · registry:minecraft:test_instance
           ↳ command may end here
```

## tick

```
Command path: tick
Next (6 alternatives): freeze | query | rate | sprint | step | unfreeze

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ freeze | query | rate | sprint | step | unfreeze
       ↳ command may end here
       ↳ command may end here
    └─ <rate>
        <...>  Float (floating-point number) · ≥1 · ≤10000
           ↳ command may end here
    └─ stop | <time>
           ↳ command may end here
        <...>  Game ticks · ≥1
           ↳ command may end here
    └─ stop | <time>
           ↳ command may end here
        <...>  Game ticks · ≥1
           ↳ command may end here
       ↳ command may end here
       ↳ command may end here
```

## time

```
Command path: time
Next (7 alternatives): add | of | pause | query | rate | resume | set

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ add | of | pause | query | rate | resume | set
    └─ <time>
        <...>  Game ticks · ≥-2147483648
           ↳ command may end here
    └─ <clock>
        <...>  Registry entry · registry:minecraft:world_clock
        └─ add | pause | query | rate | resume | set
            └─ <time>
                <...>  Game ticks · ≥-2147483648
                   ↳ command may end here
               ↳ command may end here
            └─ time | <timeline>
                   ↳ command may end here
                <...>  Registry entry · registry:minecraft:timeline
                └─ repetition
                       ↳ command may end here
                   ↳ command may end here
            └─ <rate>
                <...>  Float (floating-point number) · ≥0.00001 · ≤1000
                   ↳ command may end here
               ↳ command may end here
            └─ <time> | <timemarker>
                <...>  Game ticks · ≥0
                   ↳ command may end here
                <...>  Resource location ID, e.g. minecraft:diamond
                   ↳ command may end here
       ↳ command may end here
    └─ gametime | time | <timeline>
           ↳ command may end here
           ↳ command may end here
        <...>  Registry entry · registry:minecraft:timeline
        └─ repetition
               ↳ command may end here
           ↳ command may end here
    └─ <rate>
        <...>  Float (floating-point number) · ≥0.00001 · ≤1000
           ↳ command may end here
       ↳ command may end here
    └─ <time> | <timemarker>
        <...>  Game ticks · ≥0
           ↳ command may end here
        <...>  Resource location ID, e.g. minecraft:diamond
           ↳ command may end here
```

## title

```
Command path: title
Next: <targets>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <targets>
    <...>  Entity / player selector · players only · multiple allowed
    └─ actionbar | clear | reset | subtitle | times | title
        └─ <title>
            <...>  Data component ID, e.g. minecraft:damage, minecraft:food
               ↳ command may end here
           ↳ command may end here
           ↳ command may end here
        └─ <title>
            <...>  Data component ID, e.g. minecraft:damage, minecraft:food
               ↳ command may end here
        └─ <fadeIn>
            <...>  Game ticks · ≥0
            └─ <stay>
                <...>  Game ticks · ≥0
                └─ <fadeOut>
                    <...>  Game ticks · ≥0
                       ↳ command may end here
        └─ <title>
            <...>  Data component ID, e.g. minecraft:damage, minecraft:food
               ↳ command may end here
```

## tm

```
Command path: tm
↻ then continue (redirect → teammsg): teammsg
```

## tp

```
Command path: tp
↻ then continue (redirect → teleport): teleport
```

## transfer

```
Command path: transfer
Next: <hostname>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <hostname>
    <...>  String · phrase (quotable)
    └─ <port>
        <...>  Integer · ≥1 · ≤65535
        └─ <players>
            <...>  Entity / player selector · players only · multiple allowed
               ↳ command may end here
           ↳ command may end here
       ↳ command may end here
```

## trigger

```
Command path: trigger
Next: <objective>

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ <objective>
    <...>  Scoreboard objective ID
    └─ add | set
        └─ <value>
            <...>  Integer
               ↳ command may end here
        └─ <value>
            <...>  Integer
               ↳ command may end here
       ↳ command may end here
```

## unpublish

```
Command path: unpublish
[command may end here]
```

## version

```
Command path: version
[command may end here]
```

## w

```
Command path: w
↻ then continue (redirect → msg): msg
```

## waypoint

```
Command path: waypoint
Next (2 alternatives): list | modify

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ list | modify
       ↳ command may end here
    └─ <waypoint>
        <...>  Entity / player selector · entities · single
        └─ color | style
            └─ hex | reset | <color>
                <...>  Team color
                   ↳ command may end here
                └─ <color>
                    <...>  Hex color #rrggbb
                       ↳ command may end here
                   ↳ command may end here
            └─ reset | set
                   ↳ command may end here
                └─ <style>
                    <...>  Resource location ID, e.g. minecraft:diamond
                       ↳ command may end here
```

## weather

```
Command path: weather
Next (3 alternatives): clear | rain | thunder

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ clear | rain | thunder
    └─ <duration>
        <...>  Game ticks · ≥1
           ↳ command may end here
       ↳ command may end here
    └─ <duration>
        <...>  Game ticks · ≥1
           ↳ command may end here
       ↳ command may end here
    └─ <duration>
        <...>  Game ticks · ≥1
           ↳ command may end here
       ↳ command may end here
```

## whitelist

```
Command path: whitelist
Next (6 alternatives): add | list | off | on | reload | remove

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ add | list | off | on | reload | remove
    └─ <targets>
        <...>  Player name or player selector
           ↳ command may end here
       ↳ command may end here
       ↳ command may end here
       ↳ command may end here
       ↳ command may end here
    └─ <targets>
        <...>  Player name or player selector
           ↳ command may end here
```

## worldborder

```
Command path: worldborder
Next (6 alternatives): add | center | damage | get | set | warning

— expansion (depth=4, redirects not followed to avoid cycles) —
└─ add | center | damage | get | set | warning
    └─ <distance>
        <...>  Double (floating-point number) · ≥-59999968 · ≤59999968
        └─ <time>
            <...>  Game ticks · ≥0
               ↳ command may end here
           ↳ command may end here
    └─ <pos>
        <...>  2D coordinates x y
           ↳ command may end here
    └─ amount | buffer
        └─ <damagePerBlock>
            <...>  Float (floating-point number) · ≥0
               ↳ command may end here
        └─ <distance>
            <...>  Float (floating-point number) · ≥0
               ↳ command may end here
       ↳ command may end here
    └─ <distance>
        <...>  Double (floating-point number) · ≥-59999968 · ≤59999968
        └─ <time>
            <...>  Game ticks · ≥0
               ↳ command may end here
           ↳ command may end here
    └─ distance | time
        └─ <distance>
            <...>  Integer · ≥0
               ↳ command may end here
        └─ <time>
            <...>  Game ticks · ≥0
               ↳ command may end here
```

## xp

```
Command path: xp
↻ then continue (redirect → experience): experience
```
