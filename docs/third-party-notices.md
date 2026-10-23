# 原生补充依赖许可

`net.jafama:jafama:2.3.2`，Jeff Hain，Apache License 2.0。

高德组合 SDK `11.2.000_loc11.2.000_sea9.8.0` 的 APS 请求字段直接调用
`net.jafama.FastMath.min/max(int,int)`，但其 POM 未声明此依赖。
`plugins/with-amap-android-dependencies.js` 在 Expo prebuild 时补入该精确版本。
该插件同时把 [许可与版权声明](../licenses/jafama-2.3.2.txt) 复制到 APK 的
`assets/third-party/jafama-2.3.2.txt`，其中保留上游 FastMath 的 fdlibm 声明。

- 项目与版权：https://github.com/jeffhain/jafama
- 发布 POM：https://repo.maven.apache.org/maven2/net/jafama/jafama/2.3.2/jafama-2.3.2.pom
- 许可正文：https://www.apache.org/licenses/LICENSE-2.0

Jafama 的 Apache 2.0 许可不替代高德 SDK 自身的服务与许可条款。
