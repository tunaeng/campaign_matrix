"""Helpers for idempotent migrations on databases with legacy migration history."""

from django.db import migrations


def table_exists(schema_editor, table_name):
    return table_name in schema_editor.connection.introspection.table_names()


def column_exists(schema_editor, table_name, column_name):
    with schema_editor.connection.cursor() as cursor:
        columns = schema_editor.connection.introspection.get_table_description(
            cursor, table_name
        )
    return any(col.name == column_name for col in columns)


def constraint_exists(schema_editor, table_name, constraint_name):
    with schema_editor.connection.cursor() as cursor:
        constraints = schema_editor.connection.introspection.get_constraints(
            cursor, table_name
        )
    return constraint_name in constraints


def unique_together_exists(schema_editor, model, field_names):
    table = model._meta.db_table
    if not table_exists(schema_editor, table):
        return False
    expected = tuple(model._meta.get_field(field).column for field in field_names)
    with schema_editor.connection.cursor() as cursor:
        constraints = schema_editor.connection.introspection.get_constraints(
            cursor, table
        )
    for meta in constraints.values():
        if not meta.get("unique"):
            continue
        if tuple(meta.get("columns") or ()) == expected:
            return True
    return False


class CreateModelIfNotExists(migrations.CreateModel):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.name)
        if table_exists(schema_editor, model._meta.db_table):
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)


class AddFieldIfNotExists(migrations.AddField):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        field = model._meta.get_field(self.name)
        if column_exists(schema_editor, model._meta.db_table, field.column):
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)


class AddConstraintIfNotExists(migrations.AddConstraint):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        if constraint_exists(schema_editor, model._meta.db_table, self.constraint.name):
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)


class AlterUniqueTogetherIfNotExists(migrations.AlterUniqueTogether):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.name)
        for fields in self.unique_together or ():
            if unique_together_exists(schema_editor, model, fields):
                return
        super().database_forwards(app_label, schema_editor, from_state, to_state)
