/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ComponentProps, ComponentPropsWithoutRef, ComponentRef, ReactElement } from 'react';
import React, { forwardRef, useMemo } from 'react';
import type { EuiTabbedContentTab } from '@elastic/eui';
import { EuiTabbedContent } from '@elastic/eui';
import type { DocView, DocViewerRestorableState, DocViewerShareableState } from '../../types';
import {
  useDocViewerTabs,
  type InternalDocViewerApi,
  type InternalDocViewerProps,
  type UseDocViewerTabsResult,
} from './use_doc_viewer_tabs';
import { withRestorableState } from './restorable_state';
import { mergeShareableStateIntoRestorable } from './shareable_state';

export { INITIAL_TAB } from './use_doc_viewer_tabs';
export type {
  InternalDocViewerApi,
  InternalDocViewerProps,
  DocViewerTabDescriptor,
  UseDocViewerTabsResult,
} from './use_doc_viewer_tabs';

/** Standalone doc viewer: renders the shared tab model with `EuiTabbedContent`. */
const InternalDocViewer = forwardRef<InternalDocViewerApi, InternalDocViewerProps>((props, ref) => {
  const { tabs, selectedTab, selectTab } = useDocViewerTabs(props, ref);

  if (!tabs.length) {
    // There's a minimum of 2 tabs active in Discover.
    // This condition takes care of unit tests with 0 tabs.
    return null;
  }

  const euiTabs: EuiTabbedContentTab[] = tabs.map((tab) => ({
    id: tab.id,
    name: tab.name,
    prepend: tab.prepend,
    content: tab.content,
    'data-test-subj': tab['data-test-subj'],
    ...tab.ebtProps,
  }));

  return (
    <div className="kbnDocViewer" data-test-subj="kbnDocViewer">
      <EuiTabbedContent
        size="s"
        tabs={euiTabs}
        selectedTab={euiTabs.find(({ id }) => id === selectedTab?.id)}
        onTabClick={(tab) => selectTab(tab.id)}
      />
    </div>
  );
});

// Render-prop variant: owns the same tab model and state as `InternalDocViewer`, but hands it to its
// child instead of rendering, so a host can present the tabs with its own UI. The props type is
// inlined (not a named interface) so the public `DocViewerTabsProps` references only exported types.
const InternalDocViewerTabs = forwardRef<
  InternalDocViewerApi,
  InternalDocViewerProps & { children: (tabs: UseDocViewerTabsResult) => ReactElement }
>(({ children, ...props }, ref) => children(useDocViewerTabs(props, ref)));

const RestorableDocViewer = withRestorableState(InternalDocViewer);
const RestorableDocViewerTabs = withRestorableState(InternalDocViewerTabs);

/** Builds the restorable state from both the local initial state and the URL shareable state. */
const useRestoredInitialState = (
  docViews: DocView[],
  initialState: DocViewerRestorableState | undefined,
  initialShareableState: DocViewerShareableState | undefined
) =>
  useMemo(
    () => mergeShareableStateIntoRestorable(docViews, initialState, initialShareableState),
    [docViews, initialState, initialShareableState]
  );

export const DocViewer = forwardRef<
  ComponentRef<typeof RestorableDocViewer>,
  ComponentPropsWithoutRef<typeof RestorableDocViewer> & {
    initialShareableState?: DocViewerShareableState;
  }
>(({ docViews, initialTabId, initialState, initialShareableState, ...props }, ref) => {
  const restoredInitialState = useRestoredInitialState(
    docViews,
    initialState,
    initialShareableState
  );

  return (
    <RestorableDocViewer
      ref={ref}
      {...props}
      docViews={docViews}
      initialTabId={initialTabId ?? initialShareableState?.selectedTabId}
      initialState={restoredInitialState}
    />
  );
});

/**
 * Same tab model and state as `DocViewer`, but instead of rendering the tabs it exposes
 * `{ tabs, selectedTab, selectTab }` to its render-prop child. A host can then present the tabs
 * with its own UI (e.g. the flyout template's tab API) while reusing all of the doc viewer's tab
 * state — selected-tab persistence, initial-tab resolution, and restorable/shareable state.
 */
export const DocViewerTabs = forwardRef<
  ComponentRef<typeof RestorableDocViewerTabs>,
  ComponentPropsWithoutRef<typeof RestorableDocViewerTabs> & {
    initialShareableState?: DocViewerShareableState;
  }
>(({ docViews, initialTabId, initialState, initialShareableState, ...props }, ref) => {
  const restoredInitialState = useRestoredInitialState(
    docViews,
    initialState,
    initialShareableState
  );

  return (
    <RestorableDocViewerTabs
      ref={ref}
      {...props}
      docViews={docViews}
      initialTabId={initialTabId ?? initialShareableState?.selectedTabId}
      initialState={restoredInitialState}
    />
  );
});

export type DocViewerProps = ComponentProps<typeof DocViewer>;
export type DocViewerApi = ComponentRef<typeof DocViewer>;
export type DocViewerTabsProps = ComponentProps<typeof DocViewerTabs>;
export type DocViewerTabsApi = ComponentRef<typeof DocViewerTabs>;
