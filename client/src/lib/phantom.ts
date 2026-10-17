import type { WalletChallenge, WalletStatus } from "../types/wallet";

interface PublicKey { toString(): string }
type PhantomListener = (publicKey?: PublicKey | null) => void;
export interface PhantomProvider {
    isPhantom: boolean;
    isConnected: boolean;
    publicKey: PublicKey | null;
    connect(): Promise<{ publicKey: PublicKey }>;
    disconnect(): Promise<void>;
    signMessage(message: Uint8Array, display?: "utf8"): Promise<{ signature: Uint8Array; publicKey: PublicKey }>;
    on(event: "connect" | "disconnect" | "accountChanged", listener: PhantomListener): void;
    removeListener(event: "connect" | "disconnect" | "accountChanged", listener: PhantomListener): void;
}

const DISCONNECTED_KEY = "pasarpixel.phantom.disconnected";
const CONNECTION_CHANGED_EVENT = "pasarpixel:phantom-connection-changed";
let disconnected = false;

function isDisconnected() {
    try { return disconnected || window.sessionStorage.getItem(DISCONNECTED_KEY) === "true"; }
    catch { return disconnected; }
}

function setDisconnected(value: boolean) {
    disconnected = value;
    try {
        if (value) window.sessionStorage.setItem(DISCONNECTED_KEY, "true");
        else window.sessionStorage.removeItem(DISCONNECTED_KEY);
    } catch { /* The in-memory preference still works when storage is unavailable. */ }
    window.dispatchEvent(new Event(CONNECTION_CHANGED_EVENT));
}

export function getPhantom(): PhantomProvider | undefined {
    const provider = (window as Window & { phantom?: { solana?: PhantomProvider } }).phantom?.solana;
    return provider?.isPhantom ? provider : undefined;
}

export function getConnectedAddress(): string | null {
    // A stale provider flag or unsolicited reconnect must not undo Disconnect.
    if (isDisconnected()) return null;
    const provider = getPhantom();
    return provider?.isConnected ? provider.publicKey?.toString() ?? null : null;
}

export function subscribeToPhantom(listener: () => void) {
    const provider = getPhantom();
    const onDisconnect = () => setDisconnected(true);
    const onAccountChanged: PhantomListener = (publicKey) => {
        if (!publicKey) setDisconnected(true);
        else listener();
    };
    provider?.on("connect", listener);
    provider?.on("disconnect", onDisconnect);
    provider?.on("accountChanged", onAccountChanged);
    window.addEventListener("focus", listener);
    window.addEventListener(CONNECTION_CHANGED_EVENT, listener);
    return () => {
        provider?.removeListener("connect", listener);
        provider?.removeListener("disconnect", onDisconnect);
        provider?.removeListener("accountChanged", onAccountChanged);
        window.removeEventListener("focus", listener);
        window.removeEventListener(CONNECTION_CHANGED_EVENT, listener);
    };
}

export async function connectPhantom(provider: PhantomProvider) {
    const result = await provider.connect();
    // Only a successful, user-initiated request clears the disconnect preference.
    setDisconnected(false);
    return result;
}

export async function disconnectPhantom() {
    const wasDisconnected = isDisconnected();
    setDisconnected(true);
    try { await getPhantom()?.disconnect(); }
    catch (error) { setDisconnected(wasDisconnected); throw error; }
}

// Keep the signed bytes exactly as issued by the backend, and stop if the
// user switches accounts or wallets while either approval prompt is open.
export async function bindPhantomWallet(
    provider: PhantomProvider,
    api: {
        challenge(address: string): Promise<WalletChallenge>;
        verify(challengeId: string, signature: string): Promise<WalletStatus>;
    },
    assertSession: () => void,
    origin: string,
): Promise<WalletStatus> {
    assertSession();
    const { publicKey } = await connectPhantom(provider);
    const address = publicKey.toString();
    const assertWallet = () => {
        assertSession();
        if (isDisconnected() || !provider.isConnected || provider.publicKey?.toString() !== address) {
            throw new Error("Your Phantom account changed. Please connect and verify again.");
        }
    };
    assertWallet();
    const challenge = await api.challenge(address);
    assertWallet();
    if (challenge.address !== address || challenge.network !== "solana:devnet" ||
        !Number.isFinite(Date.parse(challenge.expiresAt)) || Date.parse(challenge.expiresAt) <= Date.now() ||
        !challenge.message.startsWith("PasarPixel wallet binding\n") ||
        !challenge.message.includes(`\nDomain: ${new URL(origin).host}\n`) ||
        !challenge.message.includes(`\nURI: ${origin}/settings\n`)) {
        throw new Error("The wallet request does not match this site or has expired. Please try again.");
    }
    const signed = await provider.signMessage(new TextEncoder().encode(challenge.message), "utf8");
    assertWallet();
    if (signed.publicKey.toString() !== address || signed.signature.length !== 64) {
        throw new Error("Phantom signed with a different wallet. Please try again.");
    }
    const signature = btoa(String.fromCharCode(...signed.signature));
    return api.verify(challenge.challengeId, signature);
}
