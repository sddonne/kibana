/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { EuiDataGridColumn } from '@elastic/eui';
import { CustomGridColumnProps, type EuiDataGridRefProps } from '@kbn/unified-data-table';
import { EuiFieldText, EuiButtonEmpty, EuiForm, EuiToolTip, useEuiTheme } from '@elastic/eui';
import React, { useState, KeyboardEvent, FocusEvent, RefObject } from 'react';
import { FormattedMessage } from '@kbn/i18n-react';
import { IndexUpdateService } from '../../index_update_service';
import { useAddColumnName } from '../../hooks/use_add_column_name';
import { COLUMN_PLACEHOLDER_PREFIX } from '../../constants';

export const getColumnInputRenderer = (
  columnName: string,
  indexUpdateService: IndexUpdateService,
  dataTableRef: RefObject<EuiDataGridRefProps>
): ((props: CustomGridColumnProps) => EuiDataGridColumn) => {
  const isPlaceholderColumn = columnName.startsWith(COLUMN_PLACEHOLDER_PREFIX);

  return ({ column }) => ({
    ...column,
    display: (
      <AddColumnHeader
        initialColumnName={columnName}
        containerId={column.id}
        dataTableRef={dataTableRef}
      />
    ),
    displayHeaderCellProps: {
      'data-column-id': column.id,
    },
    actions: {
      showHide: false,
      additional: isPlaceholderColumn
        ? [
            {
              label: (
                <FormattedMessage
                  id="indexEditor.flyout.grid.columnHeader.deleteAction"
                  defaultMessage="Delete field and values"
                />
              ),
              size: 'xs',
              iconType: 'trash',
              onClick: () => {
                indexUpdateService.deleteColumn(columnName);
              },
            },
          ]
        : [],
    },
  });
};

interface AddColumnHeaderProps {
  initialColumnName?: string;
  containerId: string;
  dataTableRef: RefObject<EuiDataGridRefProps>;
}

export const AddColumnHeader = ({
  initialColumnName,
  containerId,
  dataTableRef,
}: AddColumnHeaderProps) => {
  const { euiTheme } = useEuiTheme();
  const { columnName, setColumnName, saveColumn, validationError } =
    useAddColumnName(initialColumnName);

  const [isEditing, setIsEditing] = useState(false);

  const focusContainer = (focusContainerId: string) =>
    requestAnimationFrame(() => {
      // HD needed?
      const containerElement = document.querySelector<HTMLElement>(
        `[data-column-id="${focusContainerId}"]`
      );
      containerElement?.focus();
    });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!validationError) {
      await saveColumn();
      setColumnName('');
      setIsEditing(false);

      focusContainer(columnName);
    }
  };

  const isPlaceholderColumn = initialColumnName?.startsWith(COLUMN_PLACEHOLDER_PREFIX); // HD extract to helper

  const columnLabel = isPlaceholderColumn ? (
    <FormattedMessage id="indexEditor.flyout.grid.columnHeader.add" defaultMessage="Add a field…" />
  ) : (
    columnName
  );

  if (isEditing) {
    return (
      <EuiForm component="form" onSubmit={onSubmit}>
        <EuiToolTip
          position="top"
          content={validationError}
          anchorProps={{ css: { width: '100%' } }}
        >
          <EuiFieldText
            value={columnName}
            autoFocus
            fullWidth
            controlOnly
            compressed
            required
            isInvalid={!!validationError}
            onChange={(e) => {
              setColumnName(e.target.value);
            }}
            onBlur={() => {
              setIsEditing(false);
            }}
            onKeyDown={(e: KeyboardEvent) => {
              // e.stopPropagation();
              if (['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
                e.stopPropagation();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setColumnName('');
                setIsEditing(false);
                focusContainer(containerId);
              }
            }}
            css={{
              '&:focus-within': {
                outline: 'none',
              },
            }}
          />
        </EuiToolTip>
      </EuiForm>
    );
  }

  return (
    <EuiButtonEmpty
      // autoFocus
      css={{
        color: euiTheme.colors.textSubdued,
        width: '100%',
        height: euiTheme.size.xl,
      }}
      flush="left"
      contentProps={{
        css: {
          justifyContent: 'left',
        },
      }}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Enter') {
          setIsEditing(true);
        } else {
          focusContainer(containerId);
        }
      }}
      onFocus={(e: FocusEvent) => {
        // setIsEditing(true);
      }}
    >
      {columnLabel}
    </EuiButtonEmpty>
  );
};
