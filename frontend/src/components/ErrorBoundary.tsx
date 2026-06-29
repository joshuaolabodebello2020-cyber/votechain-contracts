import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
children: ReactNode;
fallback?: ReactNode;
}

interface State {
hasError: boolean;
error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
constructor(props: Props) {
super(props);
this.state = { hasError: false, error: null };
}

static getDerivedStateFromError(error: Error): State {
return { hasError: true, error };
}

componentDidCatch(error: Error, info: ErrorInfo) {
console.error("[ErrorBoundary] Caught error:", error, info);
}

handleReset = () => {
this.setState({ hasError: false, error: null });
};

render() {
if (this.state.hasError) {
return this.props.fallback ?? (
<div role="alert" className="flex flex-col items-center justify-center p-8 text-center">
<h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h2>
<p className="text-sm text-gray-600 mb-4">An unexpected error occurred. Please try again.</p>
<button onClick={this.handleReset} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
Try again
</button>
</div>
);
}
return this.props.children;
}
}
