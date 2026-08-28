import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../../core';
import { useAppStore } from '../../store/appStore';
import { WorkspaceContent } from '../WorkspaceContent';

describe('WorkspaceContent accessibility', () => {
  beforeEach(() => {
    state.messages = [];
    state.providers = [];
    state.selectedProvider = null;
    state.selectedModel = null;
    state.conversations = [];
    state.memories = [];
    state.selectedAssetIds = new Set();
    useAppStore.setState({ ready: true, actions: {}, revision: 0 });
  });

  it('has no detectable axe violations on the home workspace', async () => {
    const { container } = render(<WorkspaceContent />);
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
