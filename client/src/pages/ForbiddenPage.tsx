import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export default function ForbiddenPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
                <h1 className="text-6xl font-bold text-gray-800">403</h1>
                <h2 className="text-2xl font-semibold">Access Denied</h2>
                <p className="text-gray-500">
                    You don't have permission to view this page.
                </p>
                <div className="flex gap-2 justify-center pt-2">
                    <Button asChild>
                        <Link to="/dashboard">Go to Dashboard</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/">Home</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
