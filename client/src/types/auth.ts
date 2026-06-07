export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

// When the account has 2FA on, login returns this instead of tokens.
export interface TwoFactorChallenge {
    twoFactorRequired: true;
    tempToken: string;
}

// login can resolve to either real tokens or a 2FA challenge.
export type LoginResult = AuthTokens | TwoFactorChallenge;

export interface Credentials {
    email: string;
    password: string;
}

export interface ResetPasswordPayload {
    token: string;
    newPassword: string;
}
