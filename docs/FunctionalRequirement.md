
## FR-1 — Auth & User System

| ID | Requirement Description |
|---|---|
| FR-1.1 | Users shall be able to register for an account using email and password, or via Google OAuth. |
| FR-1.2 | Users shall be able to log in using email and password, or Google OAuth, authenticated via JWT. |
| FR-1.3 | Users with email and password login shall be able to enable Two-Factor Authentication (2FA) using a TOTP authenticator app, with QR code setup and recovery codes. |
| FR-1.4 | Users shall be able to log out of the system, which clears their JWT token. |
| FR-1.5 | Users shall be able to reset their password through an email-based reset link. |
| FR-1.6 | Users shall be able to view and edit their profile, including name, avatar, bio, email, phone, and social links. |
| FR-1.7 | The system shall enforce role-based access control for three roles: Admin, Seller, and Buyer. |
| FR-1.8 | Buyers shall be able to submit a seller application with store name, reason, portfolio, and ID verification for admin approval. |
| FR-1.9 | The system shall send email notifications (welcome, password reset, application result) and in-app notifications for key user events. |

---

## FR-2 — Marketplace & Assets

| ID | Requirement Description |
|---|---|
| FR-2.1 | Sellers shall be able to upload digital assets in six categories (3D Models, Images, Videos, Sound Effects, Fonts, Animations), with a single file limit of 100MB and total listing limit of 500MB. |
| FR-2.2 | Sellers shall declare whether their uploaded content is AI-generated, which will be displayed as a badge and used as a search filter. |
| FR-2.3 | The system shall provide category-specific previews, including watermarked images, 3D viewer, video/audio clips, font samples, and animation previews. |
| FR-2.4 | Sellers shall be able to manage their listings through a status flow (Draft → Pending Review → Published → Taken Down) with soft delete only. |
| FR-2.5 | Sellers shall be able to set Personal and Commercial license tiers, with pricing in USD or MYR (auto-conversion) or SOL for blockchain listings. |
| FR-2.6 | Sellers shall have access to a dashboard displaying revenue, sales, products, pending reviews, charts, and a withdrawal request system. |
| FR-2.7 | Buyers shall be able to browse and search assets by keyword, with filters for category, price, and file type, including sorting and pagination. |
| FR-2.8 | Buyers shall be able to view asset details including preview, license selector, seller info, ratings and reviews, and related assets. |

---

## FR-3 — Transaction & Order

| ID | Requirement Description |
|---|---|
| FR-3.1 | Buyers shall be able to add assets to a shopping cart (max 50 items, no duplicates) and switch license type per item. |
| FR-3.2 | Buyers shall be able to checkout and pay using Stripe, with a currency selector for USD or MYR. |
| FR-3.3 | Buyers shall be able to view their complete purchase history with search, filter, and order detail views. |
| FR-3.4 | Buyers shall be able to download purchased assets bundled as ZIP files through secure signed URLs (15-minute expiry), with unlimited re-downloads. |
| FR-3.5 | The system shall auto-generate a License Key and a downloadable PDF certificate for each purchase, verifiable through a public `/verify` page. |

---

## FR-4 — Admin Panel

| ID | Requirement Description |
|---|---|
| FR-4.1 | Admins shall have access to a dashboard displaying total users, assets, revenue, pending items, growth charts, and CSV export functionality. |
| FR-4.2 | Admins shall be able to manage users by viewing, searching, suspending/unsuspending (with reason), and soft deleting accounts, except for other admins. |
| FR-4.3 | Admins shall be able to remove the Seller role from users (with reason), which auto-hides their listings and logs the role change history. |
| FR-4.4 | Admins shall be able to review pending asset listings (approve/reject) and handle reported content (take down/dismiss). |
| FR-4.5 | Admins shall be able to view all transactions (read-only) and process seller withdrawal requests (approve/reject/mark as paid). |
| FR-4.6 | The system shall maintain an activity log tracking all admin and core user actions, with search, filter, and CSV export capabilities. |

---

## FR-5 — Blockchain / NFT

| ID | Requirement Description |
|---|---|
| FR-5.1 | Users shall be able to connect a Phantom Wallet (one per account) on Solana Devnet, which is required for all blockchain actions. |
| FR-5.2 | Sellers shall be able to mint NFTs for blockchain listings, creating a Master NFT (seller ownership) and License NFT (per buyer), with platform-paid gas fees. |
| FR-5.3 | Buyers shall be able to purchase blockchain listings directly using SOL, with 95% sent to the seller and 5% platform commission handled via smart contract. |

---
