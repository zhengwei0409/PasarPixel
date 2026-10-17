# ERD Database Information

### Authentication Service Relationships
- USER is assigned to ROLE through USER_ROLE (many-to-many).
- USER has one TWO_FACTOR_AUTH record (one-to-one).
- TWO_FACTOR_AUTH generates many RECOVERY_CODEs (one-to-many).
- USER produces many LOGIN_ATTEMPTs (one-to-many).
- USER requests many PASSWORD_RESETs (one-to-many).
- USER holds many REFRESH_TOKENs (one-to-many).

### Main API Service Relationships
- USER_PROFILE submits many SELLER_APPLICATIONs (one-to-many).
- USER_PROFILE lists many ASSETs as a seller (one-to-many).
- ASSET contains many ASSET_FILEs (one-to-many).
- ASSET is tagged with many TAGs through ASSET_TAG (many-to-many).
- USER_PROFILE adds many CART_ITEMs (one-to-many).
- USER_PROFILE places many ORDERs (one-to-many).
- ORDER contains many ORDER_ITEMs (one-to-many).
- USER_PROFILE writes many REVIEWs on ASSETs (one-to-many on both sides).
- USER_PROFILE submits many REPORTs on ASSETs (one-to-many on both sides).
- USER_PROFILE submits many WITHDRAWAL_REQUESTs (one-to-many).
- USER_PROFILE receives many NOTIFICATIONs (one-to-many).
- USER_PROFILE generates many ACTIVITY_LOGs (one-to-many).

### Blockchain Service Relationships

The following describes the Prisma models. Wallet binding and Master mint operations are implemented; License NFT and purchase models remain a scaffold:

- WALLET owns many MASTER_NFTs (one-to-many).
- Each account has at most one current WALLET_CHALLENGE, with a unique nonce, expiry, and consumption timestamp. Issuing a new challenge replaces the previous one.
- WALLET receives many LICENSE_NFTs (one-to-many).
- MASTER_NFT issues many LICENSE_NFTs (one-to-many).
- Each listing has at most one MASTER_NFT record, including preparation, approval and mint state; a record can exist before the on-chain NFT.
- A MASTER_NFT has many MASTER_MINT_ATTEMPTs, storing signed bytes and signatures before broadcast. Pending operations block wallet replacement.
- Immutable NFT_METADATA records are addressed by SHA-256. Main API separately stores ASSET_MINT_SNAPSHOT and NFT_PUBLIC_OBJECT records; database triggers protect all three immutable tables from updates/deletes.
- BLOCKCHAIN_TRANSACTION creates exactly one LICENSE_NFT (one-to-one).
- BLOCKCHAIN_TRANSACTION references both a seller WALLET and a buyer WALLET.

### Blockchain v1 Target Relationships (Planned)

See [Blockchain v1 Design](BlockchainDesign.md). Master operation tracking and snapshot migrations are implemented; the purchase / License changes below still require future migrations.

- A USER account has at most one verified WALLET binding; a WALLET address belongs to at most one account.
- A Main API ASSET references at most one MASTER_NFT; a ready blockchain listing must reference exactly one.
- A MASTER_NFT references one seller WALLET and issues many LICENSE_NFTs.
- A Main API ORDER_ITEM references at most one LICENSE_NFT; a completed blockchain purchase must reference exactly one.
- A LICENSE_NFT references one MASTER_NFT and one buyer WALLET, plus fixed terms and content commitments.
- A PURCHASE_INTENT references one ORDER_ITEM and has multiple transaction attempts, but at most one successful on-chain purchase receipt / LICENSE_NFT.
- A transaction attempt can exist before a signature or LICENSE_NFT is available, and includes failure / recovery state. Master mint operations also need independent retry tracking.
- One active entitlement is allowed per buyer account, listing and license tier; pending intents must also prevent concurrent duplicate purchases.
- Cross-service IDs are logical references, without cross-service database foreign keys. Public chain references use opaque identifiers.
