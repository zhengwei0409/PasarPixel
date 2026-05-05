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
- WALLET owns many MASTER_NFTs (one-to-many).
- WALLET receives many LICENSE_NFTs (one-to-many).
- MASTER_NFT issues many LICENSE_NFTs (one-to-many).
- BLOCKCHAIN_TRANSACTION creates exactly one LICENSE_NFT (one-to-one).
- BLOCKCHAIN_TRANSACTION references both a seller WALLET and a buyer WALLET.