# The Matrix View

The matrix view shares the same query as the list page, but allows the user to select a custom field or other value within the issues to group the issues by.

Upon visiting the matrix view page, the user selects a column. If a query paramater "matrix_field" is already provided, that column will be used.

The page remembers the last matrix_field used and will re-use that.

All field are using as column, including custom fields in the case of Jira.

Using that matrix_field, a column is shown for every possible value of that field within the issues that matched the query. The columns are sorted alphanumerically, left to right.

Each column then contains the issues whose custom field match that column value.

## Drag and drop

The user should be able to drag and drop the item into a separate column, changing the field on issue to the top column.
