/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { useMemo } from 'react';
import type { DocView, DocViewRenderProps } from '@kbn/unified-doc-viewer/types';
import { getUnifiedDocViewerServices } from '../../plugin';

/**
 * Resolves the doc views to render: a profile-provided registry (or registry transform) when one is
 * passed, otherwise the default registry. Shared by the standalone viewer and the flyout.
 */
export const useResolvedDocViews = (
  docViewsRegistry: DocViewRenderProps['docViewsRegistry']
): DocView[] => {
  const { unifiedDocViewer } = getUnifiedDocViewerServices();

  return useMemo(() => {
    if (docViewsRegistry) {
      const registry =
        typeof docViewsRegistry === 'function'
          ? docViewsRegistry(unifiedDocViewer.registry.clone())
          : docViewsRegistry;
      return registry.getAll();
    }
    return unifiedDocViewer.registry.getAll();
  }, [docViewsRegistry, unifiedDocViewer.registry]);
};
