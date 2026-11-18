import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { IconAlert } from "./Icons";

interface ErrorBoundaryProps {
  children: ReactNode;
  onClose: () => void;
  resetKey: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ViewerErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Viewer crashed", error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="viewer-status is-error">
          <span className="status-icon">
            <IconAlert size={24} />
          </span>
          <p>This document viewer ran into a problem.</p>
          <span className="viewer-status-detail">{this.state.error.message}</span>
          <div className="status-actions">
            <button className="btn-secondary" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button className="btn-primary" onClick={this.props.onClose}>
              Back to workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
