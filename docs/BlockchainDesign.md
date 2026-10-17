# Blockchain v1 Design

状态：Step 3 已实现 seller Master NFT minting、content snapshots、signature approval、独立 mint 状态与 recovery worker。2026-10-17 真实 Devnet SDK smoke mint 已 finalized，并通过 transfer、burn、metadata update、thaw 被拒绝的 simulation；网页 listing / Phantom 完整流程仍待手动验收。SOL checkout、License NFT、entitlement integration 与购买 smart contract 尚未实现。运行与验证记录见 [项目 README](../README.md#blockchain)。

本文件细化 [Functional Requirements](FunctionalRequirement.md) 的 FR-2.5、FR-3.3–3.5 和 FR-5，供后续实现使用。以下规则以 Solana Devnet 为范围。

## 1. NFT standard 与 ownership

采用 **Metaplex Core**，后续通过 Rust / Anchor program 调用 Core。数据库和 API 使用 `assetAddress` 表示 Core NFT 的链上地址。

| 概念 | v1 规则 |
|---|---|
| Marketplace listing | Main API 的 Asset；`listingType = BLOCKCHAIN` |
| Master NFT | 一个 listing 对应一个 Core Asset，由 seller 的已验证 wallet 持有 |
| License NFT | 每个成功购买的 OrderItem 对应一个 Core Asset，由 buyer 的已验证 wallet 持有 |
| Master → License | 一个 Master 可对应多个 License；通过平台 program 的 listing / purchase receipt accounts 验证关联 |
| NFT ownership | 表示该 NFT 的持有关系及平台签发记录；不自动转让作品 copyright |
| Collection | v1 无需依赖 Collection；metadata 中写入相同名称或 master address 不足以证明真实性 |

`Master NFT` 是本项目的业务名称；v1 不使用 Master Edition / print-edition 机制。License NFT 独立创建，能绑定不同 license tier 和 terms snapshot。

每个 listing 只能有一个 Master NFT。Mint retry 必须恢复同一 mint operation；不能因为 timeout 就创建第二个 Master。

Authority 分工：seller / buyer 是 NFT owner。Step 3 的 Master 通过 backend 调用 Core 创建，seller 先签署绑定内容的 approval；同一个 transaction 创建 NFT、添加冻结 plugin 并将 update authority 设为 `None`，锁定 metadata。此流程不添加 `ImmutableMetadata` plugin，因为它会拒绝后续移除 authority 的 Update instruction，已由真实 Devnet simulation 确认。这使 Master 不依赖尚未部署的购买 program。Step 4 再由 marketplace program PDA 约束 License 签发、分账和 Master 关联。Platform fee payer 不获得用户 wallet 的转账权限。未来 program 不提供修改旧 NFT metadata、添加 bypass delegates 或迁移 NFT 的 instruction。

## 2. License 类型与销售规则

| License type | 使用范围 | NFT 数量 |
|---|---|---|
| `PERSONAL` | 非商业个人项目；不允许把原始素材作为独立商品转售或分发 | 每次有效购买一个 |
| `COMMERCIAL` | 允许用于商业项目；不允许把原始素材作为独立商品转售或分发 | 每次有效购买一个 |

两种 tier 都是 non-exclusive usage licenses。Seller 保留作品权利，可以向多个 buyer 销售；购买 Master 或 License 的概念不能被 UI 描述成买断作品版权。

- Seller 至少启用一个 tier，各 tier 独立设置 SOL price；未启用的 tier 不可购买。
- 价格使用正整数 lamports，1 SOL = 1,000,000,000 lamports；v1 blockchain purchase 不提供免费 mint。
- Backend / contract 使用 integer arithmetic；API 的 lamports 用十进制 string，不能用 floating-point SOL 计算付款。
- 同一 buyer account 对同一 listing、同一 tier 只保留一份有效 license。允许购买另一 tier，Commercial 按完整价格购买，不做差价 upgrade。
- 不允许购买自己的 listing；一次 SOL checkout 只购买一个 listing 的一个 tier，不经过 cart。
- 重复点击或重新提交同一个 purchase intent 不得产生第二次付款或第二个 License NFT。
- 完整 license 文本发布后必须有固定的 `termsVersion`、`termsUri` 和 SHA-256 `termsHash`。上表定义产品范围，不代替购买时展示并保存的完整文本。

现有 `priceSol` 不能表达两个 tier；后续 schema migration 必须显式迁移或要求 seller 重新选择 tier，不能自动把旧价格解释为两个 tier 都可购买。

## 3. Transfer、burn 与 wallet 规则

v1 将 Master NFT 和 License NFT 都固定在初始接收 wallet：Master 保持 seller 归属，License 保持 buyer 归属。

每个 NFT 使用 asset-level `PermanentFreezeDelegate`，`frozen = true`、plugin authority 为 `None`。Master 的 transaction builder 已实现此配置，且不加入 Permanent Transfer / Permanent Burn delegates。2026-10-17 已在真实 Devnet NFT 上验证 owner transfer / burn 和 sponsor thaw 的 simulation 被拒绝；项目配置示例默认 `MINT_ENABLED=false`。

冻结规则在链上执行；只隐藏 UI 的 Transfer 按钮不足以实现不可转让。v1 不提供 resale、gift、burn、thaw 或 NFT wallet migration。

- 每个 account 最多绑定一个 wallet，同一个 wallet 最多绑定一个 account，绑定前必须验证 wallet signature。
- 浏览器 Disconnect 不删除 account binding，也不改变 NFT owner。
- 没有 NFT、没有未结算 blockchain operation 的 account 可以通过重新验证流程更换 wallet。
- 一旦存在 Master / License NFT，v1 不允许更换绑定 wallet；存在 pending operation 时同样禁止更换。
- Wallet 丢失时，v1 没有 NFT recovery / reissue 功能。Account password reset 不会改变链上 owner。

这些限制来自不可转让的设计；未来若需要 wallet recovery，必须另行设计迁移协议，不能直接修改数据库中的 address。

## 4. Metadata 与内容版本

NFT 创建前先生成 immutable snapshot，再 mint。所有引用的公开内容都应使用稳定、可长期读取的 URI。

| Snapshot | 必须保存的内容 |
|---|---|
| Master | `schemaVersion`、公开 `listingRef`、title、seller wallet、公开 preview URI、`contentManifestUri`、`contentManifestHash` |
| License | `schemaVersion`、Master asset address、buyer wallet、license type、`termsVersion`、`termsUri`、`termsHash`、`contentManifestHash`、公开 `purchaseRef` |
| Purchase receipt | Master / License addresses、buyer / seller wallets、tier、terms / content commitments、实际 lamports、commission、唯一 purchase reference |

所有新 NFT 的展示图片统一使用 PasarPixel logo，在 mint 前保存为 immutable PNG snapshot，不使用 listing cover。已生成的 snapshots 和已 mint NFT 保留原图片。

`listingRef` / `purchaseRef` 使用无敏感信息的 opaque identifiers。链上 receipt 是真实性依据；metadata 字段只是可读说明。单独向平台 collection 外 mint 一个相似 NFT 不会获得 entitlement。

Content manifest 使用固定的 schema 和 canonical JSON encoding：original files 按稳定 file reference 排序，记录各文件的 byte size 和 SHA-256 hash，再计算 manifest hash。S3 URL、临时 query string 和 storage key 不作为内容身份。

- Original files 保持 private S3 存储；公开 manifest 只包含无敏感信息的 file references、sizes 和 hashes。
- Metadata 不包含原始文件 download URL、signed URL、email、真实姓名、内部 user ID、内部 order ID 或现有 license key。
- 在 NFT 创建 transaction 内移除 update authority（设为 `None`），锁定 name、URI 和 authority-managed plugins；用于业务验证的 commitments 写入 program accounts，不能只依赖可变 attributes。
- 锁定 URI 不会锁定远端 JSON bytes。Step 3 的 metadata、preview、manifest 使用 content-addressed 数据库记录，数据库 trigger 禁止 UPDATE / DELETE；公开 API 从固定 hash 读取。Original snapshots 使用 private S3 的 hash keys 和 conditional writes，应用拒绝删除该 prefix；AWS/IAM 仍应限制外部覆盖或删除。Terms 的固定存储在 License 流程实现。
- Mint 后不可替换 original files 或 license terms snapshot。素材或授权范围发生变化时创建新 listing，重新审核及 mint。
- 可以调整未来销售价格、暂停销售，或修改 marketplace description；这些变化不修改已签发 NFT 或旧订单 snapshot。

## 5. Mint 与 purchase 生命周期

Seller 流程：

```text
Draft → Pending Review → Admin Approved → Master Mint Pending → Master Ready
```

沿用 Main API 的 `AssetStatus` 管理 moderation，另设 `mintStatus` 管理链上进度。`PUBLISHED` 本身不足以开放购买：还需要 Master finalized、链上 listing active、seller 有效且至少一个 tier 可售。

Buyer 流程：

```text
选择 tier / 接受 terms → 创建 purchase intent → Buyer 签名
→ 平台验证、签名及提交 → Finalized → Order COMPLETED → 开放 download
```

- Smart contract 在同一个 transaction 中验证 purchase、分账、创建 License NFT 并记录唯一 receipt；业务操作必须全部成功或回滚。
- Platform commission = `floor(priceLamports × 500 / 10000)`；seller 收到剩余部分。二者之和必须等于商品价格。5% 是首次销售分账，不是 NFT resale royalty。
- Buyer 只支付商品价格。平台承担 network fee、account rent 和 Metaplex protocol fee；失败交易仍可能消耗平台 network fee。
- 平台只为经过业务验证且符合成本上限的 transaction 提供 sponsorship，不能签署任意 client transaction。
- RPC timeout 表示结果未知；必须继续查询 signature / receipt。确认旧交易不可落链且不存在 receipt 后，才可重新构建交易，并保留同一个业务 purchase reference。
- 重试、并发请求和重复 event 都必须受到链上唯一 receipt 与数据库 uniqueness 约束。
- Seller 修改价格或 admin 下架后，旧 purchase authorization 必须通过 listing revision / expiry 检查失效。平台暂停操作以链上确认生效为准；已 finalized 的购买仍需正常入账。

Master transaction builder 和 recovery worker 已实现；购买 program accounts、License NFT 和分账在后续步骤实现。

## 6. Entitlement、verification 与 moderation

Blockchain-service 管理 wallet binding、链上 NFT / receipt 验证及其数据库投影；Main API 管理 order、账户权限及 download entitlement。所有跨服务关联使用业务 references，不建立跨服务数据库 FK。

一个 blockchain order item 只有同时满足以下条件才开放新 download link：

1. 已认证 account 是该订单 buyer，绑定 wallet 与购买记录一致。
2. 后端已验证 finalized program receipt、对应 License NFT、Master 关联、owner、tier 和 terms / content commitments。
3. Order 已设为 `COMPLETED`，entitlement 没有被明确撤销，account 没有被 suspend / delete。

Download 是站内操作，不要求每次弹出 Phantom 签名。链上验证结果可以保存为可追溯的投影；未知或冲突状态先 reconciliation，不提前发放新 download link。沿用现有 15 分钟 signed download token，并在签发和兑换时检查 entitlement。

| 事件 | 新购买 | 既有记录 / entitlement |
|---|---|---|
| Seller 隐藏 listing、删除 listing 或被撤销 SELLER role | 停止 | 保留已完成购买及 download；保护已购买的 original files |
| Admin takedown | 停止，并同步暂停链上 listing | 单独决定是否基于内容违规撤销 access，记录 reason；不能通过删除 NFT 实现 |
| Buyer 被 suspend / delete | 阻止站内操作 | 历史链上 NFT 不会因此消失，保留必要 reconciliation / audit references |
| 未来发生已确认 refund / entitlement revocation | 按单独流程处理 | NFT 保留为历史凭证；current entitlement 单独标记失效 |

v1 不新增自动 SOL refund、chargeback 或自动 NFT revocation 功能。需要返款时必须先设计独立的资金与 entitlement 流程；更改数据库 payment status 不会退回 SOL。

Public `/verify` 区分“购买凭证已验证”和“当前授权状态”，返回必要的 NFT / transaction references，避免公开 buyer 的站内身份及付款明细。NFT 存在本身不代表当前 entitlement 有效。

SOL 已直接进入 seller wallet，不计入现有 fiat withdrawal balance；seller / admin dashboard 单独显示 SOL 金额与平台 commission。

## 7. 后续实现验收依据

| 场景 | 预期 |
|---|---|
| 一个 seller listing 重复 mint / timeout retry | 最多一个 Master NFT |
| 两个 buyer 购买同一个 listing | 各自收到不同 License NFT，引用相同 Master |
| 同一 buyer 重复购买相同 tier | 返回已有 license / pending intent，不重复付款 |
| Buyer 购买另一 tier | 新 license，保存该次 tier / terms / price snapshot |
| 尝试直接 transfer / burn，或移除冻结规则 | 链上拒绝，包括通过外部 client 发起的操作 |
| 使用伪造 metadata、错误 owner 或其他 program 的 receipt | 拒绝 entitlement |
| License NFT 创建失败 | Seller / platform 不收到商品款项；平台可能承担失败 fee |
| 旧 quote、重复 purchase reference、并发购买 | 过期授权被拒绝；相同业务购买最多结算一次 |
| 链上成功后 service restart / event 重复 | 恢复同一 order / NFT，正确完成一次 fulfillment |
| 试图覆盖已引用 metadata / original file / terms | 存储及应用规则拒绝；hash 可检测内容不一致 |
| 新价格或新 listing version | 不修改旧购买的内容、terms 或金额 |
| SOL order 出现在 seller dashboard | 不增加 fiat 可提现余额 |

这些是后续 automated / Devnet tests 的 acceptance criteria；Step 1 不表示它们已经通过。

## 8. 官方技术依据

- [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core)：Core NFT standard。
- [Using Core in Anchor](https://www.metaplex.com/docs/smart-contracts/core/using-core-in-anchor)：后续 program 的 CPI integration。
- [Soulbound Assets](https://www.metaplex.com/docs/smart-contracts/core/guides/create-soulbound-nft-asset)：永久冻结及 authority `None` 的配置依据。
- [Permanent Freeze Delegate](https://www.metaplex.com/docs/smart-contracts/core/plugins/permanent-freeze-delegate)：创建时配置及 delegate 行为。
- [Immutability](https://www.metaplex.com/docs/smart-contracts/core/guides/immutability)：移除 update authority 和 plugin authority 后的不可变性边界。
- [Solana Transactions](https://solana.com/docs/core/transactions)：transaction atomicity 和失败 fee。
