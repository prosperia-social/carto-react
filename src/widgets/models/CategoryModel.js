import { minify } from 'pgsql-minify';

import { executeSQL } from '../../api';
import { filtersToSQL } from '../../api/FilterQueryBuilder';
import { applyFilter } from '../../api/Filter';
import { groupValuesByColumn } from '../operations/groupby';
import { LayerTypes } from '../LayerTypes';

export const getCategories = async (props) => {
  const {
    data,
    credentials,
    column,
    operation,
    filters,
    viewportFilter,
    viewportFeatures,
    type,
    opts
  } = props;

  if (Array.isArray(data)) {
    throw new Error('Array is not a valid type to get categories');
  }

  if (type === LayerTypes.BQ && !viewportFilter) {
    throw new Error(
      'Category Widget error: BigQuery layers need "viewportFilter" prop set to true.'
    );
  }

  const operationColumn = props.operationColumn || column;

  if (viewportFilter) {
    return filterViewportFeaturesToGetCategories({
      viewportFilter,
      viewportFeatures,
      filters,
      operation,
      column,
      operationColumn
    });
  }

  const query = buildSqlQueryToGetCategories({
    data,
    column,
    operation,
    operationColumn,
    filters
  });
  return await executeSQL(credentials, query, opts);
};

/**
 * Build a SQL sentence to get the Categories defined by props
 */
export const buildSqlQueryToGetCategories = ({
  data,
  column,
  operation,
  operationColumn,
  filters
}) => {
  const query = `
    WITH all_categories as (
      SELECT
        ${column} as category
      FROM
        (${data}) as q
      GROUP BY category
    ),
    categories as (
      SELECT
        ${column} as category, ${operation}(${operationColumn}) as value
      FROM
        (${data}) as q
      ${filtersToSQL(filters)}
      GROUP BY category
    )
    SELECT
      a.category, b.value
    FROM
      all_categories a
    LEFT JOIN categories b ON a.category=b.category
  `;

  return minify(query);
};

/**
 * Filter viewport features to get the Categories defined by props
 */
export const filterViewportFeaturesToGetCategories = ({
  viewportFeatures,
  filters,
  operation,
  column,
  operationColumn
}) => {
  if (viewportFeatures) {
    const filteredFeatures = viewportFeatures.filter(applyFilter({ filters }));

    const groups = groupValuesByColumn(
      filteredFeatures,
      operationColumn,
      column,
      operation
    );

    return groups;
  }

  return [];
};
