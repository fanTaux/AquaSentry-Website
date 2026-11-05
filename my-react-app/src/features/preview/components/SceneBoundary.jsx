import { Component } from 'react';
import UnavailableViewer from './UnavailableViewer';

export default class SceneBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure?.();
  }

  render() {
    if (this.state.failed) {
      return <UnavailableViewer />;
    }
    return this.props.children;
  }
}
