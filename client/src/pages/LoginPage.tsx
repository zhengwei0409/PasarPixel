export default function LoginPage() {

    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:3001/auth/google'
    }

    return (
        <div>
            <h1>Login</h1>
            <button onClick={handleGoogleLogin}>Login with Google</button>
        </div>
    )
}