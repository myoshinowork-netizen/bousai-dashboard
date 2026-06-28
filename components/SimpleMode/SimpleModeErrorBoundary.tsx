'use client';

import React from 'react';

type State = { error: string | null };

export class SimpleModeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(err: unknown): State {
    return { error: String(err) };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ flex: 1, padding: 20, background: '#fff5f5', overflowY: 'auto' }}>
          <h2 style={{ fontSize: 18, color: '#dc2626', marginBottom: 12 }}>
            簡易モードの表示エラー
          </h2>
          <pre style={{ fontSize: 11, color: '#7f1d1d', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
