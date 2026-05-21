export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface Credentials {
    email: string;
    password: string;
}

export interface ResetPasswordPayload {
    token: string;
    newPassword: string;
}
